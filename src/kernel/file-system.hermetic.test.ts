import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { accept } from "./fixtures/accept.ts";
import { readEveryEntry, type FileSystemError, type TreeReading } from "./file-system-port.ts";
import { createNodeFileSystem } from "./file-system.ts";
import type { Result } from "./result.ts";
import { sourcePath } from "./values.ts";

const fileSystem = createNodeFileSystem();
const scratch = { root: "" };

beforeAll(async () => {
  scratch.root = await mkdtemp(join(tmpdir(), "aidlc-file-system-"));
  await mkdir(join(scratch.root, "skills", "aidlc-knowledge", "assets"), { recursive: true });
  await writeFile(join(scratch.root, "skills", "aidlc-knowledge", "SKILL.md"), "knowledge");
  await writeFile(join(scratch.root, "skills", "aidlc-knowledge", "assets", "logo.png"), new Uint8Array([137, 80]));
  await symlink(join(scratch.root, "absent"), join(scratch.root, "skills", "dangling"), "junction");
});

afterAll(async () => {
  await rm(scratch.root, { recursive: true, force: true });
});

const below = (...segments: readonly string[]): URL => pathToFileURL(join(scratch.root, ...segments));

describe("createNodeFileSystem on a real folder", () => {
  test("reads a tree's files as bytes and names the entry it cannot read", async () => {
    expect(await fileSystem.readTree({ folder: below("skills"), select: readEveryEntry }))
      .toEqual<Result<TreeReading, FileSystemError>>({
      ok: true,
      value: {
        files: [
          { path: accept(sourcePath("aidlc-knowledge/SKILL.md")),
            content: { kind: "bytes", bytes: new TextEncoder().encode("knowledge") } },
          { path: accept(sourcePath("aidlc-knowledge/assets/logo.png")),
            content: { kind: "bytes", bytes: new Uint8Array([137, 80]) } },
        ],
        unreadable: [{ within: "dangling", code: "not-a-file" }],
      },
    });
  });

  test("returns a missing file as not found", async () => {
    expect(await fileSystem.readFile({ file: below("skills", "absent.md") }))
      .toEqual({ ok: false, refusal: { kind: "unreadable", code: "not-found" } });
  });

  test("makes a scratch folder, writes into it, reads it back and removes it", async () => {
    const folder = accept(await fileSystem.makeScratchFolder({ parent: below("work") }));
    await fileSystem.writeFile({ file: new URL("sources/mvp.md", folder), content: { kind: "text", text: "mvp" } });
    await fileSystem.makeFolder({ folder: new URL("output", folder) });
    const written = await fileSystem.readTree({ folder, select: readEveryEntry });
    await fileSystem.removeFolder({ folder });

    expect({ written, afterRemoval: await fileSystem.listFolder({ folder }) }).toEqual({
      written: { ok: true, value: { unreadable: [], files: [{ path: accept(sourcePath("sources/mvp.md")),
        content: { kind: "bytes", bytes: new TextEncoder().encode("mvp") } }] } },
      afterRemoval: { ok: false, refusal: { kind: "unreadable", code: "not-found" } },
    });
  });

  test("returns a missing folder as not found", async () => {
    expect(await fileSystem.readTree({ folder: below("scopes"), select: readEveryEntry }))
      .toEqual({ ok: false, refusal: { kind: "unreadable", code: "not-found" } });
  });
});
