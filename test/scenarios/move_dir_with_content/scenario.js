/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'parent/'},
    {ref: 2, path: 'parent/dst/'},
    {ref: 3, path: 'parent/src/'},
    {ref: 4, path: 'parent/src/dir/'},
    {ref: 5, path: 'parent/src/dir/empty-subdir/'},
    {ref: 6, path: 'parent/src/dir/subdir/'},
    {ref: 7, path: 'parent/src/dir/subdir/file'}
  ],
  actions: [
    {type: 'mv', src: 'parent/src/dir', dst: 'parent/dst/dir'}
  ],
  expected: {
    prepCalls: [
      {method: 'moveFolderAsync', dst: 'parent/dst/dir', src: 'parent/src/dir'}
    ],
    tree: [
      {path: 'parent/', ref: 1},
      {path: 'parent/dst/', ref: 2},
      {path: 'parent/dst/dir/', ref: 4},
      {path: 'parent/dst/dir/empty-subdir/', ref: 5},
      {path: 'parent/dst/dir/subdir/', ref: 6},
      {path: 'parent/dst/dir/subdir/file', ref: 7},
      {path: 'parent/src/', ref: 3}
    ],
    remoteTrash: []
  }
}: Scenario)
