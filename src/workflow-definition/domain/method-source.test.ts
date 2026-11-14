import { describe, expect, test } from "bun:test";
import type { Accepted } from "../../kernel/result.ts";
import {
  METHOD_SOURCE_FOLDERS,
  methodSourcePath,
  methodSourceRoot,
  type MethodSourceKind,
} from "./method-source.ts";

const LOCATIONS: {
  readonly kind: MethodSourceKind;
  readonly within: string;
  readonly path: string;
}[] = [
  {
    kind: "stage",
    within: "construction/code-generation.md",
    path: "aidlc-common/stages/construction/code-generation.md",
  },
  {
    kind: "agent",
    within: "aidlc-developer-agent.md",
    path: "aidlc-common/agents/aidlc-developer-agent.md",
  },
  { kind: "scope", within: "aidlc-feature.md", path: "scopes/aidlc-feature.md" },
  { kind: "sensor", within: "aidlc-linter.md", path: "sensors/aidlc-linter.md" },
  {
    kind: "knowledge",
    within: "aidlc-shared/ai-dlc-principles.md",
    path: "knowledge/aidlc-shared/ai-dlc-principles.md",
  },
  { kind: "rule", within: "phases/inception.md", path: "memory/phases/inception.md" },
  { kind: "hook", within: "aidlc-record-human-turn.ts", path: "hooks/aidlc-record-human-turn.ts" },
  {
    kind: "overlay",
    within: "agents/aidlc-quality-agent.md",
    path: "contributions/agents/aidlc-quality-agent.md",
  },
];

describe("METHOD_SOURCE_FOLDERS", () => {
  test("names the folder each kind of method source lives in", () => {
    expect(METHOD_SOURCE_FOLDERS).toEqual({
      stage: "aidlc-common/stages",
      agent: "aidlc-common/agents",
      scope: "scopes",
      sensor: "sensors",
      knowledge: "knowledge",
      rule: "memory",
      hook: "hooks",
      overlay: "contributions",
    });
  });
});

describe("methodSourcePath", () => {
  test.each(LOCATIONS)("puts a $kind source under its folder", ({ kind, within, path }) => {
    expect(methodSourcePath({ kind, within })).toEqual<Accepted<string>>({ ok: true, value: path });
  });

  test.each([
    {
      shape: "climbs out of its folder",
      within: "../agents/aidlc-developer-agent.md",
      raw: "aidlc-common/stages/../agents/aidlc-developer-agent.md",
    },
    {
      shape: "uses a backslash",
      within: "construction\\code-generation.md",
      raw: "aidlc-common/stages/construction\\code-generation.md",
    },
    { shape: "ends in a slash", within: "construction/", raw: "aidlc-common/stages/construction/" },
    { shape: "is empty", within: "", raw: "aidlc-common/stages/" },
  ])("refuses a location that $shape, reporting the whole path", ({ within, raw }) => {
    expect(methodSourcePath({ kind: "stage", within })).toEqual({
      ok: false,
      refusal: { kind: "invalid-method-source-location", raw },
    });
  });
});

describe("methodSourceRoot", () => {
  test("accepts a harness directory as the root", () => {
    expect(methodSourceRoot(".claude")).toEqual<Accepted<string>>({ ok: true, value: ".claude" });
  });

  test("accepts a plugin folder in a source checkout", () => {
    expect(methodSourceRoot("plugins/test-pro")).toEqual<Accepted<string>>({
      ok: true,
      value: "plugins/test-pro",
    });
  });

  test.each([
    { shape: "a trailing slash", raw: ".claude/" },
    { shape: "a drive letter", raw: "C:/project/.claude" },
    { shape: "a dot-dot segment", raw: "../.claude" },
  ])("refuses a root with $shape", ({ raw }) => {
    expect(methodSourceRoot(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-method-source-location", raw },
    });
  });
});
