/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'parent/'},
    {ref: 2, path: 'parent/dir/'},
    {ref: 3, path: 'parent/dir/empty-subdir/'},
    {ref: 4, path: 'parent/dir/subdir/'},
    {ref: 5, path: 'parent/dir/subdir/file'},
    {ref: 6, path: 'parent/other_dir/'}
  ],
  actions: [
    {type: 'trash', path: 'parent/dir'}
  ],
  expected: {
    prepCalls: [
      {method: 'trashFileAsync', path: 'parent/dir/subdir/file'},
      {method: 'trashFolderAsync', path: 'parent/dir/subdir'},
      {method: 'trashFolderAsync', path: 'parent/dir/empty-subdir'},
      {method: 'trashFolderAsync', path: 'parent/dir'}
    ],
    tree: [
      {path: 'parent/', ref: 1},
      {path: 'parent/other_dir/', ref: 6}
    ],
    remoteTrash: [
      'file'
      // TODO: Trash with ancestor dir:
      // 'dir/',
      // 'dir/empty-subdir/',
      // 'dir/subdir/',
      // 'dir/subdir/file'
    ]
  }
}: Scenario)
