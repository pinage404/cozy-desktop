/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'dir1/'}
  ],
  actions: [
    {type: 'mkdir', path: 'dir2'},
    {type: 'mv', src: 'dir1', dst: 'dir2/dir1'}
  ],
  expected: {
    prepCalls: [
      {method: 'putFolderAsync', path: 'dir2'},
      {method: 'moveFolderAsync', src: 'dir1', dst: 'dir2/dir1'}
    ],
    tree: [
      {path: 'dir2/'},
      {path: 'dir2/dir1/', ref: 1}
    ],
    remoteTrash: []
  }
}: Scenario)
