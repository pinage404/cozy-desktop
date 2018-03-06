/* @flow */

// Replace the date with an ellipsis in a conflict file name.
// Useful to write test assertions checking the local/remote filesystem.
export function ellipsizeDate<T: string|{path: string}> (obj: T): T {
  const transform = p => p.replace(/-conflict-[^/]+/, '-conflict-...')
  if (typeof obj === 'string') return transform(obj)
  else return {...obj, path: transform(obj.path)}
}
