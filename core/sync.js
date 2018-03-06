/* @flow */

import Promise from 'bluebird'
import EventEmitter from 'events'
import { dirname } from 'path'

import Ignore from './ignore'
import Local from './local'
import logger from './logger'
import { extractRevNumber, isUpToDate } from './metadata'
import Pouch from './pouch'
import Remote from './remote'
import { HEARTBEAT } from './remote/watcher'
import { PendingMap } from './utils/pending'
import measureTime from './perftools'

import type { SideName, Metadata } from './metadata'
import type { Side } from './side' // eslint-disable-line

const log = logger({
  component: 'Sync'
})

export const TRASHING_DELAY = 1000

type MetadataChange = {
  changes: {rev: string}[],
  doc: Metadata,
  id: string,
  seq: number
};

export type SyncMode =
  | "pull"
  | "push"
  | "full";

// Sync listens to PouchDB about the metadata changes, and calls local and
// remote sides to apply the changes on the filesystem and remote CouchDB
// respectively.
class Sync {
  changes: any
  events: EventEmitter
  ignore: Ignore
  local: Local
  pending: PendingMap
  pouch: Pouch
  remote: Remote
  stopped: ?boolean
  moveFrom: ?Metadata
  moveTo: ?string

  diskUsage: () => Promise<*>

  constructor (pouch: Pouch, local: Local, remote: Remote, ignore: Ignore, events: EventEmitter) {
    this.pouch = pouch
    this.local = local
    this.remote = remote
    this.ignore = ignore
    this.events = events
    // $FlowFixMe
    this.local.other = this.remote
    // $FlowFixMe
    this.remote.other = this.local
    this.pending = new PendingMap()
  }

  // Start to synchronize the remote cozy with the local filesystem
  // First, start metadata synchronization in pouch, with the watchers
  // Then, when a stable state is reached, start applying changes from pouch
  //
  // The mode can be:
  // - pull if only changes from the remote cozy are applied to the fs
  // - push if only changes from the fs are applied to the remote cozy
  // - full for the full synchronization of the both sides
  async start (mode: SyncMode): Promise<*> {
    this.stopped = false
    await this.pouch.addAllViewsAsync()
    if (mode !== 'pull') {
      await this.local.start()
    }
    let running = Promise.resolve()
    if (mode !== 'push') {
      const res = this.remote.start()
      running = res.running
      await res.started
    }
    await new Promise(async function (resolve, reject) {
      running.catch((err) => reject(err))
      try {
        while (true) {
          await this.sync()
        }
      } catch (err) {
        reject(err)
      }
    }.bind(this)).catch((err) => {
      this.stop()
      throw err
    })
  }

  // Stop the synchronization
  stop () {
    this.stopped = true
    if (this.changes) {
      this.changes.cancel()
      this.changes = null
    }
    return Promise.all([this.local.stop(), this.remote.stop()])
  }

  // TODO: remove waitForNewChanges to .start while(true)
  async sync (waitForNewChanges:boolean = true): Promise<*> {
    let seq = await this.pouch.getLocalSeqAsync()
    log.trace({seq}, 'Waiting for changes since seq')
    if (waitForNewChanges) await this.waitForNewChanges(seq)
    this.events.emit('sync-start')
    const release = await this.pouch.lock(this)
    try {
      let lastSeq = null
      while (true) {
        if (this.stopped) break
        seq = await this.pouch.getLocalSeqAsync()
        // TODO: if (seq === lastSeq) throw new Error('Infinite loop!')
        if (seq === lastSeq) log.warn({seq}, 'Seq was already synced!')
        else lastSeq = seq

        let change = await this.getNextChange(seq)
        if (change == null) break
        this.events.emit('sync-current', change.seq)
        try {
          await this.apply(change)
          // XXX: apply should call setLocalSeqAsync
        } catch (err) {
          if (!this.stopped) throw err
        }
      }
    } finally {
      release()
      this.events.emit('sync-end')
    }
    log.debug('No more metadata changes for now')
  }

  // We filter with the byPath view to reject design documents
  //
  // Note: it is difficult to pick only one change at a time because pouch can
  // emit several docs in a row, and `limit: 1` seems to be not effective!
  async baseChangeOptions (seq: number) : Object {
    return {
      limit: 1,
      since: seq,
      filter: '_view',
      view: 'byPath',
      returnDocs: false
    }
  }

  async waitForNewChanges (seq: number) {
    const opts = await this.baseChangeOptions(seq)
    opts.live = true
    return new Promise((resolve, reject) => {
      this.changes = this.pouch.db.changes(opts)
        .on('change', () => {
          if (this.changes) {
            this.changes.cancel()
            this.changes = null
            resolve()
          }
        })
        .on('error', err => {
          if (this.changes) {
            this.changes = null
            reject(err)
          }
        })
    })
  }

  async getNextChange (seq: number) : Promise<?MetadataChange> {
    const stopMeasure = measureTime('Sync#getNextChange')
    const opts = await this.baseChangeOptions(seq)
    opts.include_docs = true
    const p = new Promise((resolve, reject) => {
      this.pouch.db.changes(opts)
        .on('change', info => resolve(info))
        .on('error', err => reject(err))
        .on('complete', info => {
          if (info.results == null || info.results.length === 0) {
            resolve(null)
          }
        })
    })
    stopMeasure()
    return p
  }

  // Apply a change to both local and remote
  // At least one side should say it has already this change
  // In some cases, both sides have the change
  async apply (change: MetadataChange): Promise<*> {
    let { doc, seq } = change
    const changeInfo = {
      path: doc.path,
      seq,
      sides: doc.sides,
      moveTo: doc.moveTo,
      moveFrom: this.moveFrom && this.moveFrom._id
    }
    log.debug(changeInfo, 'Applying change...')
    log.trace({change})

    if (this.ignore.isIgnored(doc)) {
      return this.pouch.setLocalSeqAsync(change.seq)
    }

    // FIXME: Acquire lock for as many changes as possible to prevent next huge
    // remote/local batches to acquite it first
    let stopMeasure = () => {}
    try {
      let [side, sideName, rev] = this.selectSide(doc)
      stopMeasure = measureTime('Sync#applyChange:' + sideName)

      if (!side) {
        log.info({path: doc.path}, 'up to date')
        return this.pouch.setLocalSeqAsync(change.seq)
      } else if (sideName === 'remote' && doc.trashed) {
        // File or folder was just deleted locally
        const byItself = await this.trashWithParentOrByItself(doc, side)
        if (!byItself) { return }
      } else {
        await this.applyDoc(doc, side, sideName, rev)
      }

      log.trace(changeInfo, `Applied change on ${sideName} side`)
      await this.pouch.setLocalSeqAsync(change.seq)
      if (!change.doc._deleted) {
        await this.updateRevs(change.doc, sideName)
      }
    } catch (err) {
      await this.handleApplyError(change, err)
    } finally {
      stopMeasure()
    }
  }

  async applyDoc (doc: Metadata, side: Side, sideName:string, rev: number): Promise<*> {
    if (doc.incompatibilities && sideName === 'local' && doc.moveTo == null) {
      const was = doc.moveFrom
      if (was != null && was.incompatibilities == null) {
        // Move compatible -> incompatible
        if (was.childMove == null) {
          log.warn({path: doc.path, oldpath: was.path, incompatibilities: doc.incompatibilities},
            `Trashing ${sideName} ${doc.docType} since new remote one is incompatible`)
          await side.trashAsync(was)
        } else {
          log.debug({path: doc.path, incompatibilities: doc.incompatibilities},
            `incompatible ${doc.docType} should have been trashed with parent`)
        }
      } else {
        log.warn({path: doc.path, incompatibilities: doc.incompatibilities},
          `Not syncing incompatible ${doc.docType}`)
      }
    } else if (doc.docType !== 'file' && doc.docType !== 'folder') {
      throw new Error(`Unknown docType: ${doc.docType}`)
    } else if (doc._deleted && (rev === 0)) {
      // do nothing
    } else if (doc.moveTo != null) {
      log.debug({path: doc.path}, `Ignoring deleted ${doc.docType} metadata as move source`)
    } else if (doc.moveFrom != null) {
      const from = (doc.moveFrom: Metadata)
      // XXX: if (from.md5sum === doc.md5sum) ?
      if (from.incompatibilities) {
        if (doc.docType === 'file') await side.addFileAsync(doc)
        else await side.addFolderAsync(doc)
      } else if (from.childMove) {
        await side.assignNewRev(doc)
      } else {
        if (doc.docType === 'file') await side.moveFileAsync(doc, from)
        else await side.moveFolderAsync(doc, from)
      }
    } else if (doc._deleted) {
      if (doc.docType === 'file') await side.trashAsync(doc)
      else side.deleteFolderAsync(doc)
    } else if (rev === 0) {
      if (doc.docType === 'file') await side.addFileAsync(doc)
      else await side.addFolderAsync(doc)
    } else {
      let old
      try {
        old = await this.pouch.getPreviousRevAsync(doc._id, rev)
      } catch (_) {
        if (doc.docType === 'file') await side.overwriteFileAsync(doc, null)
        else await side.addFolderAsync(doc)
      }

      if (old) {
        if (doc.docType === 'folder') {
          await side.updateFolderAsync(doc, old)
        // $FlowFixMe
        } else if (old.md5sum === doc.md5sum) {
          await side.updateFileMetadataAsync(doc, old)
        } else {
          await side.overwriteFileAsync(doc, old)
        }
      }
    }
  }

  // Select which side will apply the change
  // It returns the side, its name, and also the last rev applied by this side
  selectSide (doc: Metadata) {
    let localRev = doc.sides.local || 0
    let remoteRev = doc.sides.remote || 0
    if (localRev > remoteRev) {
      return [this.remote, 'remote', remoteRev]
    } else if (remoteRev > localRev) {
      return [this.local, 'local', localRev]
    } else {
      return []
    }
  }

  // Make the error explicit (offline, local disk full, quota exceeded, etc.)
  // and keep track of the number of retries
  async handleApplyError (change: MetadataChange, err: Error) {
    const {path} = change.doc
    log.error({path, err, change})
    if (err.code === 'ENOSPC') {
      throw new Error('No more disk space')
    } else if (err.status === 413) {
      throw new Error('Cozy is full')
    }
    try {
      await this.diskUsage()
    } catch (err) {
      if (err.status === 400) {
        log.error({err}, 'Client has been revoked')
        throw new Error('Client has been revoked')
      } else if (err.status === 403) {
        log.error({err}, 'Client has wrong permissions (lack disk-usage)')
        throw new Error('Client has wrong permissions (lack disk-usage)')
      } else {
        // The client is offline, wait that it can connect again to the server
        log.warn({path}, 'Client is offline')
        this.events.emit('offline')
        while (true) {
          try {
            await Promise.delay(60000)
            await this.diskUsage()
            this.events.emit('online')
            log.warn({path}, 'Client is online')
            return
          } catch (_) {}
        }
      }
    }
    await this.updateErrors(change)
  }

  // Increment the counter of errors for this document
  async updateErrors (change: MetadataChange): Promise<void> {
    let { doc } = change
    if (!doc.errors) doc.errors = 0
    doc.errors++
    // Don't try more than 3 times for the same operation
    if (doc.errors >= 3) {
      await this.pouch.setLocalSeqAsync(change.seq)
      return
    }
    try {
      // The sync error may be due to the remote cozy being overloaded.
      // So, it's better to wait a bit before trying the next operation.
      // TODO: Wait for some increasing delay before saving errors
      await this.pouch.db.put(doc)
    } catch (err) {
      // If the doc can't be saved, it's because of a new revision.
      // So, we can skip this revision
      log.info(`Ignored ${change.seq}`, err)
      await this.pouch.setLocalSeqAsync(change.seq)
    }
  }

  // Update rev numbers for both local and remote sides
  async updateRevs (doc: Metadata, side: SideName): Promise<*> {
    let rev = extractRevNumber(doc) + 1
    for (let s of ['local', 'remote']) {
      doc.sides[s] = rev
    }
    delete doc.errors
    try {
      await this.pouch.put(doc)
    } catch (err) {
      // Conflicts can happen here, for example if the cozy-stack has generated
      // a thumbnail before apply has finished. In that case, we try to
      // reconciliate the documents.
      if (err && err.status === 409) {
        doc = await this.pouch.db.get(doc._id)
        doc.sides[side] = rev
        await this.pouch.put(doc)
      } else {
        log.warn({path: doc.path, err}, 'Race condition')
      }
    }
  }

  // Trash a file or folder. If a folder was deleted on local, we try to trash
  // only this folder on the remote, not every files and folders inside it, to
  // preserve the tree in the trash.
  async trashWithParentOrByItself (doc: Metadata, side: Side): Promise<boolean> {
    let parentId = dirname(doc._id)
    if (parentId !== '.') {
      let parent = await this.pouch.db.get(parentId)

      if (!parent.trashed) {
        await Promise.delay(TRASHING_DELAY)
        parent = await this.pouch.db.get(parentId)
      }

      if (parent.trashed && !isUpToDate('remote', parent)) {
        log.info(`${doc.path}: will be trashed with parent directory`)
        await this.trashWithParentOrByItself(parent, side)
        // Wait long enough that the remote has fetched one changes feed
        // TODO find a way to trigger the changes feed instead of waiting for it
        await Promise.delay(HEARTBEAT)
        return false
      }
    }

    log.info(`${doc.path}: should be trashed by itself`)
    await side.trashAsync(doc)
    return true
  }
}

export default Sync
