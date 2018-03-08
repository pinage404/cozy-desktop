// TODO: add a scenario with actions in reverse order

module.exports = {
  init: [
    {ref: 1, path: 'parent/'},
    {ref: 3, path: 'parent/dst/'},
    {ref: 4, path: 'parent/src/'},
    {ref: 5, path: 'parent/src/dir/'},
    {ref: 6, path: 'parent/src/dir/empty-subdir/'},
    {ref: 7, path: 'parent/src/dir/subdir/'},
    {ref: 8, path: 'parent/src/dir/subdir/file'},
    {ref: 9, path: 'parent/src/dir/subdir/file2'}
  ],
  actions: [
    {type: 'mv', src: 'parent/src/dir/subdir/file', dst: 'parent/src/dir/subdir/filerenamed'},
    {type: 'mv', src: 'parent/src/dir', dst: 'parent/dst/dir'},
    {type: 'mv', src: 'parent/dst/dir/subdir/file2', dst: 'parent/dst/dir/subdir/filerenamed2'}
  ],
  expected: {
    prepCalls: [
      {method: 'moveFolderAsync', dst: 'parent/dst/dir', src: 'parent/src/dir'},
      {method: 'moveFileAsync', dst: 'parent/dst/dir/subdir/filerenamed', src: 'parent/dst/dir/subdir/file'},
      {method: 'moveFileAsync', dst: 'parent/dst/dir/subdir/filerenamed2', src: 'parent/dst/dir/subdir/file2'}
    ],
    tree: [
      {path: 'parent/', ref: 1},
      {path: 'parent/dst/', ref: 3},
      {path: 'parent/dst/dir/', ref: 5},
      {path: 'parent/dst/dir/empty-subdir/', ref: 6},
      {path: 'parent/dst/dir/subdir/', ref: 7},
      {path: 'parent/dst/dir/subdir/filerenamed', ref: 8},
      {path: 'parent/dst/dir/subdir/filerenamed2', ref: 9},
      {path: 'parent/src/', ref: 4}
    ],
    remoteTrash: []
  }
}
