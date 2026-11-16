import { describe, expect, test } from "bun:test";
import type { Accepted } from "./result.ts";
import {
  contentHash,
  distributionId,
  frameworkVersion,
  projectPath,
  sourcePath,
  timestamp,
} from "./values.ts";

const UNPORTABLE_PATHS = [
  { shape: "a backslash", raw: ".claude\\agents\\aidlc-developer-agent.md" },
  { shape: "a colon stream suffix", raw: "folder/file:stream" },
  { shape: "an asterisk", raw: "notes/draft*.md" },
  { shape: "a question mark", raw: "notes/draft?.md" },
  { shape: "a double quote", raw: 'notes/"draft".md' },
  { shape: "a less-than sign", raw: "notes/<draft.md" },
  { shape: "a greater-than sign", raw: "notes/draft>.md" },
  { shape: "a pipe", raw: "notes/draft|final.md" },
  { shape: "a control character", raw: "notes/draft\u0007.md" },
  { shape: "a trailing dot", raw: "notes/draft." },
  { shape: "a trailing space", raw: "notes/draft " },
  { shape: "a bare device name", raw: "con" },
  { shape: "a device name with an extension", raw: "notes/NUL.txt" },
  { shape: "a numbered device name", raw: "notes/com1" },
  { shape: "an empty path", raw: "" },
  { shape: "an empty segment", raw: "notes//draft.md" },
  { shape: "a trailing slash", raw: "notes/" },
  { shape: "a leading slash", raw: "/notes/draft.md" },
  { shape: "a dot segment", raw: "./notes/draft.md" },
  { shape: "a dot-dot segment", raw: "notes/../draft.md" },
];

describe("projectPath", () => {
  test("accepts a portable relative path", () => {
    expect(projectPath(".claude/agents/aidlc-developer-agent.md")).toEqual<Accepted<string>>({
      ok: true,
      value: ".claude/agents/aidlc-developer-agent.md",
    });
  });

  test("accepts a segment that only contains a device name", () => {
    expect(projectPath("docs/console.md")).toEqual<Accepted<string>>({
      ok: true,
      value: "docs/console.md",
    });
  });

  test.each(UNPORTABLE_PATHS)("refuses $shape", ({ raw }) => {
    expect(projectPath(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-path", base: "project", raw },
    });
  });
});

describe("sourcePath", () => {
  test("accepts a portable relative path", () => {
    expect(sourcePath("src/cli/main.ts")).toEqual<Accepted<string>>({
      ok: true,
      value: "src/cli/main.ts",
    });
  });

  test.each(UNPORTABLE_PATHS)("refuses $shape", ({ raw }) => {
    expect(sourcePath(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-path", base: "source", raw },
    });
  });
});

describe("contentHash", () => {
  test("accepts a sha256 hash in lower-case hex", () => {
    expect(
      contentHash("sha256:a730e4d4268c7906dd85885f4c2de66d3af4f045d2eb0ac03ddd48c08d3c5326"),
    ).toEqual<Accepted<string>>({
      ok: true,
      value: "sha256:a730e4d4268c7906dd85885f4c2de66d3af4f045d2eb0ac03ddd48c08d3c5326",
    });
  });

  test.each([
    { shape: "a hash without its algorithm", raw: "a730e4d4268c7906dd85885f4c2de66d" },
    {
      shape: "upper-case hex",
      raw: "sha256:A730E4D4268C7906DD85885F4C2DE66D3AF4F045D2EB0AC03DDD48C08D3C5326",
    },
    { shape: "a short digest", raw: "sha256:a730e4d4" },
    {
      shape: "another algorithm",
      raw: "sha1:a730e4d4268c7906dd85885f4c2de66d3af4f045d2eb0ac03ddd48c08d3c5326",
    },
  ])("refuses $shape", ({ raw }) => {
    expect(contentHash(raw)).toEqual({ ok: false, refusal: { kind: "invalid-content-hash", raw } });
  });
});

describe("frameworkVersion", () => {
  test("accepts a stable release version", () => {
    expect(frameworkVersion("2.12.0")).toEqual<Accepted<string>>({ ok: true, value: "2.12.0" });
  });

  test("accepts a preview version", () => {
    expect(frameworkVersion("2.12.0-preview.20261108.1")).toEqual<Accepted<string>>({
      ok: true,
      value: "2.12.0-preview.20261108.1",
    });
  });

  test.each([
    { shape: "a leading v", raw: "v2.12.0" },
    { shape: "a missing patch number", raw: "2.12" },
    { shape: "a leading zero", raw: "2.012.0" },
    { shape: "a preview with a short date", raw: "2.12.0-preview.2026118.1" },
    { shape: "a preview numbered zero", raw: "2.12.0-preview.20261108.0" },
    { shape: "another pre-release label", raw: "2.12.0-beta.1" },
  ])("refuses $shape", ({ raw }) => {
    expect(frameworkVersion(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-framework-version", raw },
    });
  });
});

describe("distributionId", () => {
  test("accepts a kebab-case distribution name", () => {
    expect(distributionId("kiro-ide")).toEqual<Accepted<string>>({ ok: true, value: "kiro-ide" });
  });

  test.each([
    { shape: "an upper-case letter", raw: "Claude" },
    { shape: "a leading digit", raw: "1claude" },
    { shape: "an underscore", raw: "kiro_ide" },
    { shape: "an empty name", raw: "" },
  ])("refuses $shape", ({ raw }) => {
    expect(distributionId(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-distribution-id", raw },
    });
  });
});

describe("timestamp", () => {
  test("accepts a UTC timestamp to the second", () => {
    expect(timestamp("2026-11-08T09:30:00Z")).toEqual<Accepted<string>>({
      ok: true,
      value: "2026-11-08T09:30:00Z",
    });
  });

  test("accepts a UTC timestamp to the millisecond", () => {
    expect(timestamp("2026-11-08T09:30:00.123Z")).toEqual<Accepted<string>>({
      ok: true,
      value: "2026-11-08T09:30:00.123Z",
    });
  });

  test.each([
    { shape: "an offset instead of Z", raw: "2026-11-08T09:30:00+01:00" },
    { shape: "a date alone", raw: "2026-11-08" },
    { shape: "more than three fraction digits", raw: "2026-11-08T09:30:00.1234Z" },
    { shape: "a space instead of T", raw: "2026-11-08 09:30:00Z" },
  ])("refuses $shape", ({ raw }) => {
    expect(timestamp(raw)).toEqual({ ok: false, refusal: { kind: "invalid-timestamp", raw } });
  });
});
