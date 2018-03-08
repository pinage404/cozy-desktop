/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'src/'},
    {ref: 2, path: 'src/file1'},
    {ref: 3, path: 'src/file2'},
    {ref: 4, path: 'dst/'}
  ],
  actions: [
    {type: 'mv', src: 'src/file1', dst: 'dst/file1'},
    {type: 'wait', ms: 1500},
    {type: 'mv', src: 'src/file2', dst: 'dst/file2'}
  ],
  expected: {
    prepCalls: [
      {method: 'moveFileAsync', src: 'src/file1', dst: 'dst/file1'},
      {method: 'moveFileAsync', src: 'src/file2', dst: 'dst/file2'}
    ],
    tree: [
      {path: 'dst/', ref: 4},
      {path: 'dst/file1', ref: 2},
      {path: 'dst/file2', ref: 3},
      {path: 'src/', ref: 1}
    ],
    remoteTrash: []
  }
}: Scenario)
