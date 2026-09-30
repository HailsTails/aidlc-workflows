import { describe, expect, test } from "vitest";
import { GUARD_MANIFEST, guardManifestFrom } from "./guard-manifest.ts";

const manifestWith = (claudeRows: unknown): string =>
  JSON.stringify({ aidlc: { hooks: { claude: claudeRows } } });

const PRE_TOOL_USE_ROW = {
  event: "PreToolUse",
  matcher: "Bash|PowerShell",
  target: "rin-guard-navigation",
  hookFile: "guard-navigation.mjs",
};

describe("guards are derived from the plugin manifest", () => {
  test("a PreToolUse row with a matcher becomes a guard entry", () => {
    expect(guardManifestFrom(manifestWith([PRE_TOOL_USE_ROW]))).toEqual([
      {
        id: "rin-guard-navigation",
        runtimePath: ".claude/hooks/guard-navigation.mjs",
        matcher: "Bash|PowerShell",
      },
    ]);
  });

  test("a row for a different event is not a PreToolUse guard", () => {
    expect(
      guardManifestFrom(
        manifestWith([{ ...PRE_TOOL_USE_ROW, event: "SubagentStop" }]),
      ),
    ).toEqual([]);
  });

  // A matcher-less PreToolUse row is a real shape on the faces that have no
  // matcher concept. Admitting one here would give it an empty matcher, and the
  // install's registration check compares matchers for equality — so every such
  // guard would read as drifted against a settings.json that is correct.
  test("a PreToolUse row without a matcher is not a guard entry", () => {
    const { matcher, ...withoutMatcher } = PRE_TOOL_USE_ROW;
    expect(matcher).toBe("Bash|PowerShell");
    expect(guardManifestFrom(manifestWith([withoutMatcher]))).toEqual([]);
  });
});

// Every branch below returns an empty manifest. That is the dangerous direction:
// the install's rinGuardRegistrationFailures iterates the manifest, so an empty
// one reports zero failures and the guard-registration assertion passes on a
// settings.json registering nothing at all. These pin that a malformed manifest
// cannot be mistaken for a well-formed empty one by anything downstream.
describe("a manifest it cannot read yields nothing rather than guessing", () => {
  test("claude rows absent", () => {
    expect(guardManifestFrom(JSON.stringify({ aidlc: { hooks: {} } }))).toEqual(
      [],
    );
  });

  test("hooks absent", () => {
    expect(guardManifestFrom(JSON.stringify({ aidlc: {} }))).toEqual([]);
  });

  test("aidlc absent", () => {
    expect(guardManifestFrom(JSON.stringify({}))).toEqual([]);
  });

  test("claude rows are not an array", () => {
    expect(guardManifestFrom(manifestWith({ event: "PreToolUse" }))).toEqual(
      [],
    );
  });

  test("a row missing its target is skipped rather than admitted partial", () => {
    const { target, ...withoutTarget } = PRE_TOOL_USE_ROW;
    expect(target).toBe("rin-guard-navigation");
    expect(guardManifestFrom(manifestWith([withoutTarget]))).toEqual([]);
  });
});

describe("the shipped manifest is not empty", () => {
  // The floor that stops every consumer of GUARD_MANIFEST from passing
  // vacuously. Without it, a parse that silently returned [] would make the
  // install's registration check, the settings-registration test, and the
  // coverage test all report success while asserting nothing.
  test("GUARD_MANIFEST resolves real guards from the real plugin manifest", () => {
    expect(GUARD_MANIFEST.length).toBeGreaterThan(0);
  });

  test("every derived guard carries an id, a runtime path and a matcher", () => {
    expect(
      GUARD_MANIFEST.filter(
        (guard) =>
          guard.id.length === 0 ||
          guard.runtimePath.length === 0 ||
          guard.matcher.length === 0,
      ),
    ).toEqual([]);
  });
});
