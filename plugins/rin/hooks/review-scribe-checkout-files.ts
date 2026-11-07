import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import type { ScribeCheckoutFiles } from "./review-scribe-replay.ts";

type NodeFileSystem = {
  readonly temporaryDirectory: () => string;
  readonly makeTemporaryDirectory: (prefix: string) => string;
  readonly makeDirectory: (
    path: string,
    options: { readonly recursive: true },
  ) => unknown;
  readonly writeFile: (path: string, text: string, encoding: "utf-8") => void;
  readonly readFile: (path: string, encoding: "utf-8") => string;
  readonly remove: (
    path: string,
    options: { readonly recursive: true; readonly force: true },
  ) => void;
};

const NODE_FILE_SYSTEM: NodeFileSystem = {
  temporaryDirectory: tmpdir,
  makeTemporaryDirectory: mkdtempSync,
  makeDirectory: mkdirSync,
  writeFile: writeFileSync,
  readFile: readFileSync,
  remove: rmSync,
};

const SCRATCH_PREFIX = "rin-scribe-replay-";

const defaultScribeCheckoutFiles = (
  { fileSystem }: { readonly fileSystem: NodeFileSystem } = {
    fileSystem: NODE_FILE_SYSTEM,
  },
): ScribeCheckoutFiles => ({
  makeScratchDirectory: () =>
    fileSystem.makeTemporaryDirectory(
      `${fileSystem.temporaryDirectory()}/${SCRATCH_PREFIX}`,
    ),
  makeDirectory: ({ path }) => {
    fileSystem.makeDirectory(path, { recursive: true });
  },
  writeText: ({ path, text }) => {
    fileSystem.writeFile(path, text, "utf-8");
  },
  readText: ({ path }) => fileSystem.readFile(path, "utf-8"),
  removeTree: ({ path }) => {
    fileSystem.remove(path, { recursive: true, force: true });
  },
});

export { defaultScribeCheckoutFiles, type NodeFileSystem };
