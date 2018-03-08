/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'parent/'},
    {ref: 2, path: 'parent/dst/'},
    {ref: 3, path: 'parent/dst2/'},
    {ref: 4, path: 'parent/src/'},
    {ref: 5, path: 'parent/src/dir/'},
    {ref: 6, path: 'parent/src/dir/empty-subdir/'},
    {ref: 7, path: 'parent/src/dir/subdir/'},
    {ref: 8, path: 'parent/src/dir/subdir/file'}
  ],
  actions: [
    {type: 'mv', src: 'parent/src/dir', dst: 'parent/dst/dir'},
    {type: 'mv', src: 'parent/dst/dir/subdir', dst: 'parent/dst2/subdir'}
  ],
  expected: {
    prepCalls: [
      {method: 'moveFolderAsync', dst: 'parent/dst2/subdir', src: 'parent/src/dir/subdir'},
      {method: 'moveFolderAsync', dst: 'parent/dst/dir', src: 'parent/src/dir'}
    ],
    tree: [
      {path: 'parent/', ref: 1},
      {path: 'parent/dst/', ref: 2},
      {path: 'parent/dst/dir/', ref: 5},
      {path: 'parent/dst/dir/empty-subdir/', ref: 6},
      {path: 'parent/dst2/', ref: 3},
      {path: 'parent/dst2/subdir/', ref: 7},
      {path: 'parent/dst2/subdir/file', ref: 8},
      {path: 'parent/src/', ref: 4}
    ],
    remoteTrash: []
  }
}: Scenario)
