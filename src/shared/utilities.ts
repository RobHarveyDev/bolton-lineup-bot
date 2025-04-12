export function hasOwnProperty<T, K extends PropertyKey>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

export function assertStringArray(input: any): input is string[] {
  return Array.isArray(input) && input.every((element) => typeof element === 'string')
}