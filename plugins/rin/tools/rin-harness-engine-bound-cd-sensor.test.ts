import { describe, expect, test } from "vitest";
import { cdSensorWireOf } from "./rin-harness-cd-enforcement.ts";
import {
  DELEGATED_SCANNED_TEXT,
  delegatedCdSensorResultOf,
  projectDirOf,
  unreadableEngineCdWireLineOf,
} from "./rin-harness-engine-bound-cd-sensor.ts";

describe("delegatedCdSensorResultOf", () => {
  test("a CD sensor under discipline-core passes, not evaluated, naming the disciplines sensor", () => {
    expect(cdSensorWireOf({ result: delegatedCdSensorResultOf({ cdId: "CD-15", scanned: DELEGATED_SCANNED_TEXT }) })).toEqual({
      pass: true,
      cd: "CD-15",
      findings_count: 0,
      findings: [],
      scanned: "(constitution.engine is discipline-core: the disciplines sensor applies)",
      stale_authorised_paths: [],
      stale_carved_paths: [],
      doubly_held_paths: [],
    });
  });
});

describe("unreadableEngineCdWireLineOf", () => {
  test("an unreadable engine fails the CD sensor and names why, instead of running the walker", () => {
    expect(JSON.parse(unreadableEngineCdWireLineOf({ cdId: "CD-15", reason: "bad engine" }))).toMatchObject({
      pass: false,
      cd: "CD-15",
      scanned: "(constitution.engine could not be read, so no engine was run: bad engine)",
    });
  });
});

describe("projectDirOf", () => {
  test("the --project-dir flag wins over the environment", () => {
    expect(
      projectDirOf({ argumentList: ["bun", "sensor.ts", "--project-dir", "/flag"], environment: { CLAUDE_PROJECT_DIR: "/env" } }),
    ).toBe("/flag");
  });

  test("the environment is used without the flag", () => {
    expect(projectDirOf({ argumentList: ["bun", "sensor.ts"], environment: { CLAUDE_PROJECT_DIR: "/env" } })).toBe("/env");
  });

  test("the working directory is used without either", () => {
    expect(projectDirOf({ argumentList: ["bun", "sensor.ts"], environment: {} })).toBe(".");
  });
});
