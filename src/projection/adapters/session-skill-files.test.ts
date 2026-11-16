import { expect, mock, test } from "bun:test";
import type { ReadTreeArgs } from "../../kernel/file-system-port.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { createSessionSkillSource } from "./session-skill-files.ts";

const folder = new URL("file:///fixture/core/skills/");
const rootSource = source("skills");

test("five named session skills include recursive sidecars and binary files with core-relative paths", async () => {
  const tree = createInMemoryFileSystem({ files: {
    "file:///fixture/core/skills/aidlc-session-cost/SKILL.md": "C",
    "file:///fixture/core/skills/aidlc-replay/SKILL.md": "R",
    "file:///fixture/core/skills/aidlc-outcomes-pack/SKILL.md": "O",
    "file:///fixture/core/skills/aidlc-knowledge/SKILL.md": "K",
    "file:///fixture/core/skills/aidlc-issue-report/SKILL.md": "I",
    "file:///fixture/core/skills/aidlc-issue-report/references/data.md": "D",
    "file:///fixture/core/skills/aidlc-issue-report/scripts/report.ts": "run",
    "file:///fixture/core/skills/aidlc-issue-report/assets/icon.bin": new Uint8Array([0, 255, 10]),
  } });
  expect(await createSessionSkillSource({ folder, source: rootSource, tree }).read()).toEqual({
    ok: true, value: [
      { name: "aidlc-issue-report", files: [
        { source: source("skills/aidlc-issue-report/SKILL.md"),
          content: { kind: "bytes", bytes: new Uint8Array([73]) } },
        { source: source("skills/aidlc-issue-report/assets/icon.bin"),
          content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } },
        { source: source("skills/aidlc-issue-report/references/data.md"),
          content: { kind: "bytes", bytes: new Uint8Array([68]) } },
        { source: source("skills/aidlc-issue-report/scripts/report.ts"),
          content: { kind: "bytes", bytes: new Uint8Array([114, 117, 110]) } },
      ] },
      { name: "aidlc-knowledge", files: [{ source: source("skills/aidlc-knowledge/SKILL.md"),
        content: { kind: "bytes", bytes: new Uint8Array([75]) } }] },
      { name: "aidlc-outcomes-pack", files: [{ source: source("skills/aidlc-outcomes-pack/SKILL.md"),
        content: { kind: "bytes", bytes: new Uint8Array([79]) } }] },
      { name: "aidlc-replay", files: [{ source: source("skills/aidlc-replay/SKILL.md"),
        content: { kind: "bytes", bytes: new Uint8Array([82]) } }] },
      { name: "aidlc-session-cost", files: [{ source: source("skills/aidlc-session-cost/SKILL.md"),
        content: { kind: "bytes", bytes: new Uint8Array([67]) } }] },
    ],
  });
});

test("one snapshot copies the source bytes before a later source mutation", async () => {
  const original = new Uint8Array([0, 255, 10]);
  const fileSystem = createInMemoryFileSystem({ files: {
    "file:///fixture/core/skills/aidlc-replay/nested/icon.bin": original,
  } });
  const readTree = mock((request: ReadTreeArgs) => fileSystem.readTree(request));
  const reader = createSessionSkillSource({ folder, source: rootSource, tree: { readTree } });
  expect(await reader.read()).toEqual({ ok: true, value: [{ name: "aidlc-replay", files: [{
    source: source("skills/aidlc-replay/nested/icon.bin"),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
  }] }] });
  original.set([9, 8, 7]);
  expect(await reader.read()).toEqual({ ok: true, value: [{ name: "aidlc-replay", files: [{
    source: source("skills/aidlc-replay/nested/icon.bin"),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
  }] }] });
  expect(readTree).toHaveBeenCalledTimes(1);
  expect(readTree.mock.calls[0]?.[0].folder).toEqual(folder);
});

test("every failed file and folder keeps its own portable source and fault", async () => {
  const tree = createInMemoryFileSystem({ files: {}, faults: {
    "file:///fixture/core/skills/aidlc-knowledge/b.md": "failed",
    "file:///fixture/core/skills/aidlc-knowledge/a.md": "permission-denied",
    "file:///fixture/core/skills/aidlc-replay/": "permission-denied",
  }, others: ["file:///fixture/core/skills/aidlc-session-cost/link"] });
  expect(await createSessionSkillSource({ folder, source: rootSource, tree }).read()).toEqual({
    ok: false, refusal: [
      { kind: "neutral-source-unreadable", source: source("skills/aidlc-knowledge/a.md"), reason: "permission-denied" },
      { kind: "neutral-source-unreadable", source: source("skills/aidlc-knowledge/b.md"), reason: "failed" },
      { kind: "neutral-source-unreadable", source: source("skills/aidlc-replay"), reason: "permission-denied" },
      { kind: "neutral-source-unreadable", source: source("skills/aidlc-session-cost/link"), reason: "not-a-file" },
    ],
  });
});

test("unportable names are retained in the reason without branding an invalid source", async () => {
  const tree = createInMemoryFileSystem({ files: {
    "file:///fixture/core/skills/aidlc-knowledge/notes.": "not portable",
  } });
  expect(await createSessionSkillSource({ folder, source: rootSource, tree }).read()).toEqual({
    ok: false, refusal: [{ kind: "neutral-source-unreadable", source: rootSource,
      reason: "unportable-name: skills/aidlc-knowledge/notes." }],
  });
});

test("an absent skills root stays empty while denied access names the source", async () => {
  expect(await createSessionSkillSource({ folder, source: rootSource,
    tree: createInMemoryFileSystem({ files: {} }) }).read()).toEqual({
    ok: true, value: [],
  });
  expect(await createSessionSkillSource({ folder, source: rootSource,
    tree: createInMemoryFileSystem({ files: {}, faults: {
      "file:///fixture/core/skills/": "permission-denied",
    } }) }).read()).toEqual({
    ok: false, refusal: [{ kind: "neutral-source-unreadable", source: rootSource, reason: "permission-denied" }],
  });
});

test("loose files at the skills root do not become skill identities", async () => {
  const tree = createInMemoryFileSystem({ files: {
    "file:///fixture/core/skills/README.md": "not a skill folder",
    "file:///fixture/core/skills/aidlc-replay/SKILL.md": "E",
  }, faults: { "file:///fixture/core/skills/README.md": "permission-denied" } });
  expect(await createSessionSkillSource({ folder, source: rootSource, tree }).read()).toEqual({
    ok: true, value: [{ name: "aidlc-replay", files: [{
      source: source("skills/aidlc-replay/SKILL.md"),
      content: { kind: "bytes", bytes: new Uint8Array([69]) },
    }] }],
  });
});

test("unselected future skills and their faults are skipped before source validation", async () => {
  const tree = createInMemoryFileSystem({ files: {
    "file:///fixture/core/skills/aidlc-replay/SKILL.md": "R",
    "file:///fixture/core/skills/future-skill/notes.": "not selected",
  }, faults: { "file:///fixture/core/skills/future-skill/": "permission-denied" } });
  expect(await createSessionSkillSource({ folder, source: rootSource, tree }).read()).toEqual({
    ok: true, value: [{ name: "aidlc-replay", files: [{
      source: source("skills/aidlc-replay/SKILL.md"), content: { kind: "bytes", bytes: new Uint8Array([82]) },
    }] }],
  });
});