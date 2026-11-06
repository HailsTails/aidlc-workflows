import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPluginRuntimePort, preparePluginRuntimeArtifacts } from "../../scripts/plugin-runtime.ts";

/** Test-only source injection: the installed hook closes its allocator at build time. */
export async function installCollisionHook(input: {
  readonly projectDir: string;
  readonly messageId: string;
}): Promise<void> {
  if (!/^[0-9a-f]{8}$/.test(input.messageId)) throw new Error("Invalid fixture message ID");
  const repository = join(import.meta.dir, "..", "..");
  const fixture = mkdtempSync(join(repository, "tmp-collision-hook-"));
  const sourceRoot = join(fixture, "core");
  try {
    cpSync(join(repository, "core"), sourceRoot, { recursive: true });
    const store = join(sourceRoot, "tools", "aidlc-message-store.ts");
    const source = readFileSync(store, "utf8");
    const allocation = "const id = candidate();";
    if (source.split(allocation).length !== 2) throw new Error("Fixture allocator source seam changed");
    writeFileSync(store, source.replace(allocation, `const id = ${JSON.stringify(input.messageId)};`));
    const file = "hooks/aidlc-record-human-turn.ts";
    const prepared = await preparePluginRuntimeArtifacts({
      pluginRoot: sourceRoot,
      files: [file],
      sources: [{ file, source: readFileSync(join(sourceRoot, file), "utf8") }],
      closedModules: [file],
      port: createPluginRuntimePort({ projectRoot: repository }),
    });
    if (prepared.kind === "refused") throw new Error(prepared.message);
    const artifact = prepared.artifacts[0];
    if (prepared.artifacts.length !== 1 || artifact?.file !== file) throw new Error("Unexpected collision hook products");
    const destination = join(input.projectDir, ".claude", file);
    mkdirSync(join(input.projectDir, ".claude", "hooks"), { recursive: true });
    writeFileSync(destination, artifact.content);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
