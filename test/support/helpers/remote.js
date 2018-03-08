/* @flow */

import cozy from 'cozy-client-js'
import _ from 'lodash'
import path from 'path'

import * as conflictHelpers from './conflict'

import Pouch from '../../../core/pouch'
import Remote from '../../../core/remote'
import { TRASH_DIR_NAME } from '../../../core/remote/constants'

import type { RemoteDoc } from '../../../core/remote/document'

export class RemoteTestHelpers {
  remote: Remote

  constructor (remote: Remote) {
    this.remote = remote
  }

  get cozy (): cozy.Client { return this.remote.remoteCozy.client }
  get pouch (): Pouch { return this.remote.pouch }

  async ignorePreviousChanges () {
    const {last_seq} = await this.remote.remoteCozy.changes()
    await this.pouch.setRemoteSeqAsync(last_seq)
  }

  async pullChanges () {
    await this.remote.watcher.watch()
  }

  async createTree (paths: Array<string>): Promise<{ [string]: RemoteDoc}> {
    const docsByPath = {}
    for (const p of paths) {
      const name = path.posix.basename(p)
      const parentPath = path.posix.dirname(p)
      const dirID = (docsByPath[parentPath + '/'] || {})._id
      if (p.endsWith('/')) {
        docsByPath[p] = await this.cozy.files.createDirectory(
          {name, dirID, lastModifiedDate: new Date()})
      } else {
        docsByPath[p] = await this.cozy.files.create(`Content of file ${p}`,
          {name, dirID, lastModifiedDate: new Date()})
      }
    }

    return docsByPath
  }

  // TODO: Extract reusable #scan() method from tree*()

  async treeWithId () {
    const pathsToScan = ['/', `/${TRASH_DIR_NAME}`]
    const relPaths: Array<{path: string, id?: ?string}> = [{path: `${TRASH_DIR_NAME}/`}]

    while (true) {
      const dirPath = pathsToScan.shift()
      if (dirPath == null) break

      let dir
      try {
        dir = await this.cozy.files.statByPath(dirPath)
      } catch (err) {
        if (err.status !== 404) throw err
        // $FlowFixMe
        dir = {relations: () => [{_id: null, attributes: {name: '<BROKEN>', type: '<BROKEN>'}}]}
      }
      for (const content: * of dir.relations('contents')) {
        const {name, type} = content.attributes
        const remotePath = path.posix.join(dirPath, name)
        let relPath = remotePath.slice(1)

        if (type === 'directory') {
          relPath += '/'
          pathsToScan.push(remotePath)
        }

        relPaths.push({path: relPath, id: content._id})
      }
    }

    return relPaths
      .sort()
      .map(conflictHelpers.ellipsizeDate)
  }

  async treeWithoutTrashWithId () {
    return (await this.treeWithId())
      .filter(item => !item.path.startsWith(`${TRASH_DIR_NAME}/`))
  }

  async treeWithoutTrash () {
    return (await this.treeWithoutTrashWithId())
      .map(({path}) => path)
  }

  async trashWithId () {
    const TRASH_REGEXP = new RegExp(`^${TRASH_DIR_NAME}/(.+)$`)
    return _.chain(await this.treeWithId())
      .map(obj => {
        const relPath = _.nth(obj.path.match(TRASH_REGEXP), 1)
        return relPath ? {...obj, path: relPath} : null
      })
      .compact()
      .value()
  }

  async trash () {
    return (await this.trashWithId())
      .map(({path}) => path)
  }

  async simulateChanges (docs: *) {
    await this.remote.watcher.pullMany(docs)
  }
}
