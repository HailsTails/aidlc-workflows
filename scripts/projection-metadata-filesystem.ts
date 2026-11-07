import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { sha256Bytes } from "../core/tools/aidlc-distribution.ts";
import type { HarnessManifest } from "./manifest-types.ts";
import { createProjectionMetadataRules, planProjectionMetadata, prepareProjectionMetadata } from "./projection/native/projection-metadata.ts";

// Generic assembly observes the actual callback-finalized tree. The retained
// producer owns classification, root blocks, signatures and metadata bytes.
// Observation/preparation failure publishes no metadata; writes are ordinary IO.
export function writeProjectionMetadata({ root, declaration, buildVersion }: {
  readonly root: string;
  readonly declaration: HarnessManifest;
  readonly buildVersion: string;
}): void {
  const files: string[] = [], directories: string[] = [];
  const visit = (directory: string): void => {
    for (const name of readdirSync(join(root, directory))) {
      const path = directory ? directory + "/" + name : name;
      if (statSync(join(root, path)).isDirectory()) {
        directories.push(path);
        visit(path);
      } else files.push(path);
    }
  };
  visit("");
  const observedRootPaths = declaration.rootIntegrations.filter(integration => existsSync(join(root, integration.path))).map(integration => integration.path);
  const samePath = ({ left, right }: { readonly left: string; readonly right: string }): boolean => {
    const a = join(root, left), b = join(root, right);
    if (!existsSync(a) || !existsSync(b)) return false;
    if (realpathSync(a) === realpathSync(b)) return true;
    const first = statSync(a, { bigint: true }), second = statSync(b, { bigint: true });
    return first.ino !== 0n && first.dev === second.dev && first.ino === second.ino;
  };
  const rules = { ...createProjectionMetadataRules(), samePath };
  const planned = planProjectionMetadata({ declaration, files, directories, observedRootPaths, rules });
  if (planned.kind === "refused") throw new Error(planned.message);
  const rootFiles = planned.rootPathsToRead.map(path => {
    const bytes = readFileSync(join(root, path));
    return { path, fileName: basename(path), bytes, sha256: sha256Bytes(bytes) };
  });
  const prepared = prepareProjectionMetadata({ declaration, files, directories, observedRootPaths, rootFiles, buildVersion, rules });
  if (prepared.kind === "refused") throw new Error(prepared.message);
  for (const artifact of prepared.artifacts) {
    const destination = join(root, artifact.file);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, artifact.bytes);
  }
}
