/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'parent/'},
    {ref: 2, path: 'parent/dst1/'},
    {ref: 3, path: 'parent/dst2/'},
    {ref: 4, path: 'parent/src/'},
    {ref: 5, path: 'parent/src/dir/'},
    {ref: 6, path: 'parent/src/dir/empty-subdir/'},
    {ref: 7, path: 'parent/src/dir/subdir/'},
    {ref: 8, path: 'parent/src/dir/subdir/file'}
  ],
  actions: [
    {type: 'mv', src: 'parent/src/dir', dst: 'parent/dst1/dir'},
    {type: 'mv', src: 'parent/dst1/dir', dst: 'parent/dst2/dir'}
  ],
  eventsBreakpoints: [0, 1, 5],
  expected: {
    prepCalls: [
      {method: 'moveFolderAsync', dst: 'parent/dst2/dir', src: 'parent/src/dir'}
    ],
    tree: [
      {path: 'parent/', ref: 1},
      {path: 'parent/dst1/', ref: 2},
      {path: 'parent/dst2/', ref: 3},
      {path: 'parent/dst2/dir/', ref: 5},
      {path: 'parent/dst2/dir/empty-subdir/', ref: 6},
      {path: 'parent/dst2/dir/subdir/', ref: 7},
      {path: 'parent/dst2/dir/subdir/file', ref: 8},
      {path: 'parent/src/', ref: 4}
    ],
    remoteTrash: []
  }
}: Scenario)
