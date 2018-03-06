/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'dst/'},
    {ref: 2, path: 'src/'},
    {ref: 3, path: 'src/dir1/'}
  ],
  actions: [
    {type: 'mv', src: 'src/dir1', dst: 'dst/dir1'},
    {type: 'mkdir', path: 'dst/dir1/dir2'}
  ],
  expected: {
    prepCalls: [
      {method: 'moveFolderAsync', src: 'src/dir1', dst: 'dst/dir1'},
      {method: 'putFolderAsync', path: 'dst/dir1/dir2'}
    ],
    tree: [
      {path: 'dst/', ref: 1},
      {path: 'dst/dir1/', ref: 3},
      {path: 'dst/dir1/dir2/'},
      {path: 'src/', ref: 2}
    ],
    remoteTrash: []
  }
}: Scenario)
