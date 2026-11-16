import { assert } from "vitest";
import {
  defaultTypeScriptModule,
  loadParsePort,
  type TypeScriptParsePort,
} from "../mechanisms/audit/runner/typescript-parse.ts";

const loaded = await loadParsePort({ typescript: defaultTypeScriptModule });

assert(loaded.outcome === "ok", "typescript loads from the development install");

export const defaultParsePort: TypeScriptParsePort = loaded.value;
