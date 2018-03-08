/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'dst/'},
    {ref: 2, path: 'src/'},
    {ref: 3, path: 'src/file'}
  ],
  actions: [
    {type: 'mv', src: 'src/file', dst: 'dst/file'}
  ],
  expected: {
    prepCalls: [
      {method: 'moveFileAsync', dst: 'dst/file', src: 'src/file'}
    ],
    tree: [
      {path: 'dst/', ref: 1},
      {path: 'dst/file', ref: 3},
      {path: 'src/', ref: 2}
    ],
    remoteTrash: []
  }
}: Scenario)
