import { expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { projectionModes } from "../../scripts/projection-process.ts";
import { prepareDistributionStructure } from "../../scripts/projection/src/domain/distribution-structure.ts";
import { pathStatus } from "../../scripts/projection/src/domain/model.ts";
import { createTarGz } from "../../core/tools/aidlc-archive.ts";

test.each([
  { platform: "linux", umask: 0o022, file: 0o644, directory: 0o755 },
  { platform: "darwin", umask: 0o077, file: 0o600, directory: 0o700 },
  { platform: "linux", umask: 0o002, file: 0o664, directory: 0o775 },
  { platform: "win32", umask: 0, file: 0o666, directory: 0o777 },
])("archive directory permissions retain traversal independently of file permissions: %j", (input) => {
  const modes = projectionModes(input);
  expect(modes).toEqual({ fileMode: input.file, directoryMode: input.directory });
  const structure = prepareDistributionStructure({ files: [{ path: ".claude/tools/example.ts" }], retained: [], mode: modes.directoryMode, rules: { path: pathStatus } });
  expect(structure.status).toBe("ok");
  if (structure.status !== "ok") throw new Error("Expected directory metadata");
  expect(structure.value.every(directory => directory.mode === input.directory && (directory.mode & 0o100) !== 0)).toBe(true);
  const archive = createTarGz(structure.value.map(directory => ({ path: directory.path, type: "directory" as const, mode: directory.mode, data: Buffer.alloc(0) })));
  const tar = gunzipSync(archive);
  for (let offset = 0; offset < structure.value.length * 512; offset += 512) {
    expect(tar.toString("utf8", offset + 156, offset + 157)).toBe("5");
    const mode = Number.parseInt(tar.toString("utf8", offset + 100, offset + 108).replace(/\0.*$/, "").trim(), 8);
    expect(mode).toBe(input.directory);
    expect(mode & 0o100).toBe(0o100);
  }
});
