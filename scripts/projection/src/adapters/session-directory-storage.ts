import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { OwnedDirectoryStorage } from "./owned-directory.ts";

export type SessionDirectoryPurpose = "runtime" | "distribution";
export type SessionDirectoryStorage = OwnedDirectoryStorage & { readonly temporaryParent: () => string };
const directoryPrefixes = { runtime: "aidlc-runtime-", distribution: "aidlc-distribution-" };

export const createSessionDirectoryStorage = ({ purpose }: { readonly purpose: SessionDirectoryPurpose }): SessionDirectoryStorage => ({
  temporaryParent: tmpdir,
  create: parent => mkdtempSync(join(parent, directoryPrefixes[purpose])),
  remove: root => rmSync(root, { recursive: true, force: true }),
});
