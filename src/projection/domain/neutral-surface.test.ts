import { describe, expect, test } from "bun:test";
import { NEUTRAL_DOCUMENT_ROLES, RUNTIME_FOLDERS, SESSION_SKILL_NAMES } from "./neutral-surface.ts";

describe("NEUTRAL_DOCUMENT_ROLES", () => {
  test("lists the roles of every core document a host places: protocols, templates, the conductor, stages and knowledge", () => {
    expect(NEUTRAL_DOCUMENT_ROLES).toEqual(["protocol", "template", "conductor", "stage", "knowledge"]);
  });
});

describe("SESSION_SKILL_NAMES", () => {
  test("names the five session skills every host ships", () => {
    expect(SESSION_SKILL_NAMES).toEqual([
      "aidlc-session-cost",
      "aidlc-replay",
      "aidlc-outcomes-pack",
      "aidlc-knowledge",
      "aidlc-issue-report",
    ]);
  });
});

describe("RUNTIME_FOLDERS", () => {
  test("names the core folders every host copies under its own directory: tools, hooks, sensors and scopes", () => {
    expect(RUNTIME_FOLDERS).toEqual(["tools", "hooks", "sensors", "scopes"]);
  });
});
