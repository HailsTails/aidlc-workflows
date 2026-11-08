import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { besideMainCheckout } from "./directory-lock.ts";

export type RunTemp = {
  readonly path: string;
  readonly dispose: () => void;
};

export type TemporaryEnvironment = {
  readonly TEMP: string;
  readonly TMP: string;
  readonly TMPDIR: string;
};

export const temporaryEnvironment = (path: string): TemporaryEnvironment => ({
  TEMP: path,
  TMP: path,
  TMPDIR: path,
});

export const runTemp = (root: string): RunTemp => {
  const parent = besideMainCheckout(root, join(".cache", "tmp"));
  mkdirSync(parent, { recursive: true });
  const path = mkdtempSync(join(parent, "gate-"));
  return { path, dispose: () => rmSync(path, { recursive: true, force: true }) };
};
