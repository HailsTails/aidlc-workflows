import { describe, expect, test } from "bun:test";
import { commandFilePath, ENTRY_SHORTCUTS, nativeCommandName } from "./native-command.ts";
import type { Accepted } from "../../kernel/result.ts";

describe("ENTRY_SHORTCUTS", () => {
  test("lists the door's fixed entry shortcuts", () => {
    expect(ENTRY_SHORTCUTS).toEqual(["aidlc-init", "aidlc-compose"]);
  });
});

describe("nativeCommandName", () => {
  test("accepts one portable path segment", () => {
    expect(nativeCommandName("aidlc-requirements-analysis")).toEqual<Accepted<string>>({
      ok: true,
      value: "aidlc-requirements-analysis",
    });
  });

  test("refuses a name that would nest the command a folder deeper", () => {
    expect(nativeCommandName("aidlc/requirements")).toEqual({
      ok: false,
      refusal: { kind: "invalid-path", base: "project", raw: "aidlc/requirements" },
    });
  });

  test("refuses a name that climbs out of its folder", () => {
    expect(nativeCommandName("..")).toEqual({
      ok: false,
      refusal: { kind: "invalid-path", base: "project", raw: ".." },
    });
  });
});

describe("commandFilePath", () => {
  test("accepts a portable path inside the command's folder", () => {
    expect(commandFilePath("references/guards.md")).toEqual<Accepted<string>>({
      ok: true,
      value: "references/guards.md",
    });
  });

  test("refuses a path that climbs out of the command's folder", () => {
    expect(commandFilePath("../SKILL.md")).toEqual({
      ok: false,
      refusal: { kind: "invalid-path", base: "project", raw: "../SKILL.md" },
    });
  });
});
