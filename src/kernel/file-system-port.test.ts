import { describe, expect, test } from "bun:test";
import { accept } from "./fixtures/accept.ts";
import { createInMemoryFileSystem, selectFoldersAndFiles } from "./fixtures/file-system.fake.ts";
import { readEveryEntry, walkTree, type FileSystemError, type TreeReading } from "./file-system-port.ts";
import type { Result } from "./result.ts";
import { sourcePath } from "./values.ts";

const bytes = (text: string) => ({ kind: "bytes" as const, bytes: new TextEncoder().encode(text) });

const skills = createInMemoryFileSystem({
  files: {
    "file:///core/skills/aidlc-replay/SKILL.md": "replay",
    "file:///core/skills/aidlc-knowledge/SKILL.md": "knowledge",
    "file:///core/skills/aidlc-knowledge/assets/logo.png": new Uint8Array([137, 80]),
    "file:///core/skills/aidlc-knowledge/notes.": "trailing dot",
  },
  faults: {
    "file:///core/skills/aidlc-replay/locked.md": "permission-denied",
    "file:///core/skills/aidlc-session-cost/": "permission-denied",
  },
  others: ["file:///core/skills/aidlc-replay/link"],
});

describe("walkTree", () => {
  test("reads every file below the folder as bytes, sorted by its path within the folder", async () => {
    const reading = await walkTree({ fileSystem: skills, folder: new URL("file:///core/skills/aidlc-knowledge"), select: readEveryEntry });

    expect(reading).toEqual<Result<TreeReading, FileSystemError>>({ ok: true, value: {
      files: [
        { path: accept(sourcePath("SKILL.md")), content: bytes("knowledge") },
        { path: accept(sourcePath("assets/logo.png")), content: { kind: "bytes", bytes: new Uint8Array([137, 80]) } },
      ],
      unreadable: [{ within: "notes.", code: "unportable-name" }],
    } });
  });

  test("names each file and folder it cannot read and carries on with the rest", async () => {
    const reading = await walkTree({ fileSystem: skills, folder: new URL("file:///core/skills/"), select: readEveryEntry });

    expect(reading).toEqual<Result<TreeReading, FileSystemError>>({ ok: true, value: {
      files: [
        { path: accept(sourcePath("aidlc-knowledge/SKILL.md")), content: bytes("knowledge") },
        { path: accept(sourcePath("aidlc-knowledge/assets/logo.png")), content: { kind: "bytes", bytes: new Uint8Array([137, 80]) } },
        { path: accept(sourcePath("aidlc-replay/SKILL.md")), content: bytes("replay") },
      ],
      unreadable: [
        { within: "aidlc-knowledge/notes.", code: "unportable-name" },
        { within: "aidlc-replay/link", code: "not-a-file" },
        { within: "aidlc-replay/locked.md", code: "permission-denied" },
        { within: "aidlc-session-cost/", code: "permission-denied" },
      ],
    } });
  });

  test("refuses the whole read when the folder itself cannot be listed", async () => {
    const reading = await walkTree({ fileSystem: skills, folder: new URL("file:///core/scopes/"), select: readEveryEntry });

    expect(reading).toEqual({ ok: false, refusal: { kind: "unreadable", code: "not-found" } });
  });

  test("never reads, descends into or reports an entry the consumer skips", async () => {
    const reading = await walkTree({ fileSystem: skills, folder: new URL("file:///core/skills/"),
      select: selectFoldersAndFiles({ files: ["aidlc-knowledge/SKILL.md", "aidlc-replay/SKILL.md",
        "aidlc-replay/locked.md"] }) });

    expect(reading).toEqual<Result<TreeReading, FileSystemError>>({ ok: true, value: {
      files: [
        { path: accept(sourcePath("aidlc-knowledge/SKILL.md")), content: bytes("knowledge") },
        { path: accept(sourcePath("aidlc-replay/SKILL.md")), content: bytes("replay") },
      ],
      unreadable: [
        { within: "aidlc-replay/locked.md", code: "permission-denied" },
        { within: "aidlc-session-cost/", code: "permission-denied" },
      ],
    } });
  });
});
