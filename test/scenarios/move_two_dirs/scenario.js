/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'src/'},
    {ref: 2, path: 'src/dir1/'},
    {ref: 3, path: 'src/dir2/'},
    {ref: 4, path: 'dst/'}
  ],
  actions: [
    {type: 'mv', src: 'src/dir1', dst: 'dst/dir1'},
    {type: 'wait', ms: 1500},
    {type: 'mv', src: 'src/dir2', dst: 'dst/dir2'}
  ],
  expected: {
    prepCalls: [
      {method: 'moveFolderAsync', src: 'src/dir1', dst: 'dst/dir1'},
      {method: 'moveFolderAsync', src: 'src/dir2', dst: 'dst/dir2'}
    ],
    tree: [
      {path: 'dst/', ref: 4},
      {path: 'dst/dir1/', ref: 2},
      {path: 'dst/dir2/', ref: 3},
      {path: 'src/', ref: 1}
    ],
    remoteTrash: []
  }
}: Scenario)
