/* @flow */

import type { Scenario } from '..'

module.exports = ({
  init: [
    {ref: 1, path: 'file'}
  ],
  actions: [
    {type: '>>', path: 'file'}
  ],
  expected: {
    prepCalls: [
      {method: 'updateFileAsync', path: 'file'}
    ],
    tree: [
      {path: 'file', ref: 1}
    ],
    remoteTrash: []
  }
}: Scenario)
