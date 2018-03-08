const Promise = require('bluebird')
const fs = require('fs-extra')
const glob = require('glob')
const _ = require('lodash')
const path = require('path')

const metadata = require('../../../core/metadata')

const { cozy } = require('./cozy')

const debug = process.env.DEBUG ? console.log : () => {}

const disabledExtension = '.DISABLED'

const scenarioByPath = module.exports.scenarioByPath = scenarioPath => {
  // $FlowFixMe
  const scenario = require(scenarioPath)
  scenario.name = path.basename(path.dirname(scenarioPath), disabledExtension)
  scenario.path = scenarioPath
  scenario.disabled = scenarioPath.endsWith(disabledExtension) && 'scenario disabled'

  if (process.platform === 'win32' && scenario.expected && scenario.expected.prepCalls) {
    for (let prepCall of scenario.expected.prepCalls) {
      if (prepCall.src) {
        prepCall.src = prepCall.src.split('/').join('\\')
        // @TODO why is src in maj
      }
      if (prepCall.path) prepCall.path = prepCall.path.split('/').join('\\')
      if (prepCall.dst) prepCall.dst = prepCall.dst.split('/').join('\\')
    }
  }

  return scenario
}

const scenariosDir = path.resolve(__dirname, '../../scenarios')

// TODO: Refactor to function
module.exports.scenarios =
  glob.sync(path.join(scenariosDir, '**/scenario.js*'), {})
    .map(scenarioByPath)

if (module.exports.scenarios.length === 0) {
  throw new Error(`No scenario found! Please check scenariosDir: ${scenariosDir}`)
}

module.exports.loadFSEventFiles = (scenario) => {
  const eventFiles = glob.sync(path.join(path.dirname(scenario.path), 'local', '*.json*'))
  const disabledEventsFile = (name) => {
    if (process.platform === 'win32' && name.indexOf('win32') === -1) {
      return 'darwin/linux test'
    } else if (name.endsWith(disabledExtension)) {
      return 'disabled case'
    }
  }
  return eventFiles
    .map(f => {
      const name = path.basename(f)
      const disabled = scenario.disabled || disabledEventsFile(name)
      const events = fs.readJsonSync(f).map(e => {
        if (e.stats) {
          e.stats.mtime = new Date(e.stats.mtime)
          e.stats.ctime = new Date(e.stats.ctime)
        }
        if (name.indexOf('win32') !== -1 && process.platform !== 'win32') {
          e.path = e.path && e.path.replace(/\\/g, '/')
        }
        if (name.indexOf('win32') === -1 && process.platform === 'win32') {
          e.path = e.path && e.path.replace(/\//g, '\\')
        }
        return e
      })

      return {name, events, disabled}
    })
}

module.exports.loadRemoteChangesFiles = (scenario) => {
  const pattern = path.join(path.dirname(scenario.path), 'remote', '*.json*')

  return glob.sync(pattern).map(f => {
    const name = path.basename(f)
    const disabled = scenario.disabled || f.endsWith(disabledExtension)
    const changes = fs.readJsonSync(f)
    return {name, disabled, changes}
  })
}

module.exports.init = async (scenario, pouch, abspath, relpathFix, trueino) => {
  debug('[init]')
  const refToInoMap = {}
  const refToRemoteID = {}
  const refToPouchID = {}

  const remoteDocsToTrash = []
  for (let {path: relpath, ref, trashed} of scenario.init) {
    let ino = ref
    debug(relpath)
    const isOutside = relpath.startsWith('../outside')
    let remoteParent
    if (!isOutside) {
      const remoteParentPath = path.posix.join('/', path.posix.dirname(relpath))
      debug(`- retrieve remote parent: ${remoteParentPath}`)
      remoteParent = await cozy.files.statByPath(remoteParentPath)
    }
    const remoteName = path.posix.basename(relpath)
    const remotePath = path.posix.join(_.get(remoteParent, 'attributes.path', ''), remoteName)
    const localPath = relpathFix(_.trimEnd(relpath, '/'))
    const lastModifiedDate = new Date('2011-04-11T10:20:30Z')
    const id = metadata.id(localPath)
    if (relpath.endsWith('/')) {
      if (!trashed) {
        debug(`- create local dir: ${localPath}`)
        await fs.ensureDir(abspath(localPath))
        const stats = await fs.stat(abspath(localPath))
        if (trueino) ino = stats.ino
        else refToInoMap[ref] = stats.ino
      }

      const doc = {
        _id: id,
        docType: 'folder',
        updated_at: lastModifiedDate,
        path: localPath,
        ino,
        tags: [],
        sides: {local: 1, remote: 1}
      }

      if (!isOutside) {
        debug(`- create${trashed ? ' and trash' : ''} remote dir: ${remotePath}`)
        const remoteDir = await cozy.files.createDirectory({
          name: remoteName,
          dirID: remoteParent._id,
          lastModifiedDate
        })
        doc.remote = _.pick(remoteDir, ['_id', '_rev'])
        if (trashed) remoteDocsToTrash.push(remoteDir)
        else {
          debug(`- create dir metadata: ${doc._id}`)
          refToRemoteID[ref] = remoteDir._id
          refToPouchID[ref] = doc._id
          await pouch.put(doc)
        }
      }
    } else {
      const content = 'foo'
      const md5sum = 'rL0Y20zC+Fzt72VPzMSk2A=='
      const id = metadata.id(localPath)

      if (!trashed) {
        debug(`- create local file: ${localPath}`)
        await fs.outputFile(abspath(localPath), content)
        const stats = await fs.stat(abspath(localPath))
        if (trueino) ino = stats.ino
        else refToInoMap[ref] = stats.ino
      }

      const doc = {
        _id: id,
        md5sum,
        class: 'text',
        docType: 'file',
        executable: false,
        updated_at: lastModifiedDate,
        mime: 'text/plain',
        path: localPath,
        ino,
        size: 0,
        tags: [],
        sides: {local: 1, remote: 1}
      }
      if (!isOutside) {
        debug(`- create${trashed ? ' and trash' : ''} remote file: ${remotePath}`)
        const remoteFile = await cozy.files.create(content, {
          name: remoteName,
          dirID: remoteParent._id,
          checksum: md5sum,
          contentType: 'text/plain',
          lastModifiedDate
        })
        doc.remote = _.pick(remoteFile, ['_id', '_rev'])
        if (trashed) remoteDocsToTrash.push(remoteFile)
        else {
          debug(`- create file metadata: ${doc._id}`)
          refToRemoteID[ref] = remoteFile._id
          refToPouchID[ref] = doc._id
          await pouch.put(doc)
        }
      }
    } // if relpath ...
  } // for (... of scenario.init)
  for (let remoteDoc of remoteDocsToTrash) {
    await cozy.files.trashById(remoteDoc._id)
  }

  return {refToInoMap, refToPouchID, refToRemoteID}
}

module.exports.runActions = (scenario, abspath) => {
  debug('[actions]')
  return Promise.each(scenario.actions, action => {
    switch (action.type) {
      case 'mkdir':
        debug('- mkdir', action.path)
        return fs.ensureDir(abspath(action.path))

      case '>':
        debug('- >', action.path)
        return fs.outputFile(abspath(action.path), 'whatever')

      case '>>':
        debug('- >>', action.path)
        return fs.appendFile(abspath(action.path), ' blah')

      case 'trash':
        debug('- trash', action.path)
        return fs.remove(abspath(action.path))

      case 'delete':
        debug('- delete', action.path)
        return fs.remove(abspath(action.path))

      case 'mv':
        debug('- mv', action.src, action.dst)
        return fs.rename(abspath(action.src), abspath(action.dst))

      case 'wait':
        debug('- wait', action.ms)
        return Promise.delay(action.ms)

      default:
        return Promise.reject(new Error(`Unknown action ${action.type} for scenario ${scenario.name}`))
    }
  })
}
