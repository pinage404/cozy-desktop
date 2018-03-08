/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'dst1/'},
    {ref: 2, path: 'dst2/'},
    {ref: 3, path: 'src/'},
    {ref: 4, path: 'src/file'}
  ],
  actions: [
    {type: 'mv', src: 'src/file', dst: 'dst1/file'},
    {type: 'wait', ms: 1500},
    {type: 'mv', src: 'dst1/file', dst: 'dst2/file'}
  ],
  expected: {
    prepCalls: [
      {method: 'moveFileAsync', dst: 'dst2/file', src: 'src/file'}
    ],
    tree: [
      {path: 'dst1/', ref: 1},
      {path: 'dst2/', ref: 2},
      {path: 'dst2/file', ref: 4},
      {path: 'src/', ref: 3}
    ],
    remoteTrash: []
  }
}: Scenario)
