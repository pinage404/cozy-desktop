/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'src/'},
    {ref: 2, path: 'src/dir1/'},
    {ref: 3, path: 'src/dir12/'},
    {ref: 4, path: 'dst/'}
  ],
  actions: [
    {type: 'mv', src: 'src/dir1', dst: 'dst/dir1'},
    {type: 'wait', ms: 1500},
    {type: 'mv', src: 'src/dir12', dst: 'dst/dir12'}
  ],
  expected: {
    prepCalls: [
      {method: 'moveFolderAsync', src: 'src/dir1', dst: 'dst/dir1'},
      {method: 'moveFolderAsync', src: 'src/dir12', dst: 'dst/dir12'}
    ],
    tree: [
      {path: 'dst/', ref: 4},
      {path: 'dst/dir1/', ref: 2},
      {path: 'dst/dir12/', ref: 3},
      {path: 'src/', ref: 1}
    ],
    remoteTrash: []
  }
}: Scenario)
