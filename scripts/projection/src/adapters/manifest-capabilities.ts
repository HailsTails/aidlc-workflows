import { types } from "node:util";
import { assertPlainSourceData } from "./plain-source-data.ts";
import type { EmitContext } from "../../../manifest-types.ts";

// The authored emitter is a source capability, never a transport value.
export function manifestEmitter(value: unknown): ((context: EmitContext) => void) | null {
  if (value === null || typeof value !== "object" || types.isProxy(value)) throw new Error("Manifest requires an ordinary source record");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null || Object.getOwnPropertySymbols(value).length !== 0) throw new Error("Manifest requires an ordinary source record");
  const fields = Object.getOwnPropertyDescriptors(value);
  const declaration = Object.create(null);
  let emit: ((context: EmitContext) => void) | null = null;
  for (const [key, field] of Object.entries(fields)) {
    if (!("value" in field) || !field.enumerable) throw new Error("Manifest requires enumerable data fields");
    if (key === "emit") {
      if (field.value === null || field.value === undefined) continue;
      if (typeof field.value !== "function" || types.isProxy(field.value)) throw new Error("Manifest emit requires an authored callable capability");
      emit = field.value;
    } else Object.defineProperty(declaration, key, { value: field.value, enumerable: true });
  }
  assertPlainSourceData(declaration);
  return emit;
}
