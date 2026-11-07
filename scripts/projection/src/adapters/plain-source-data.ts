import { types } from "node:util";
const isProxy = types.isProxy;
// Validate before JSON can call getters/toJSON or erase unsupported values.
export function assertPlainSourceData(value: unknown, ancestors: readonly object[] = []): void {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || isProxy(value) || ancestors.includes(value)) throw new Error("Source policy must return finite plain data");
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("Source policy must return plain records or arrays");
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new Error("Source policy must not return symbol fields");
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const [key, field] of Object.entries(fields)) {
    if (!("value" in field) || !field.enumerable && !(Array.isArray(value) && key === "length")) throw new Error("Source policy must return enumerable data fields");
    if (Array.isArray(value) && key !== "length" && (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) throw new Error("Source policy array has non-index fields");
    if (key !== "length" || !Array.isArray(value)) assertPlainSourceData(field.value, [...ancestors, value]);
  }
  if (Array.isArray(value) && Object.keys(fields).length !== value.length + 1) throw new Error("Source policy arrays must not be sparse");
}
