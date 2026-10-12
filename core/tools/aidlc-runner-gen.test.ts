import { describe, expect, test } from "bun:test";
import { runnerOwnership } from "./aidlc-runner-gen.ts";

describe("generated runner ownership", () => {
  test("provenance owns a runner independently of directory and stage membership", () => {
    expect(runnerOwnership({
      dirName: "orphan-shortcut",
      slug: "retired-stage",
      marker: "present",
      legacyBareSlugs: new Set(),
    })).toBe("generated");
  });

  test("a markerless core generated directory remains owned for an unknown stage", () => {
    expect(runnerOwnership({
      dirName: "aidlc-retired-stage",
      slug: "retired-stage",
      marker: "absent",
      legacyBareSlugs: new Set(),
    })).toBe("generated");
  });

  test("a markerless plugin generated directory uses the complete legacy ownership set", () => {
    expect(runnerOwnership({
      dirName: "test-pro-disabled-stage",
      slug: "test-pro-disabled-stage",
      marker: "absent",
      legacyBareSlugs: new Set(["test-pro-disabled-stage"]),
    })).toBe("generated");
  });

  test("entry documentation without generated ownership is unmanaged", () => {
    expect(runnerOwnership({
      dirName: "aidlc",
      slug: "documented-stage",
      marker: "absent",
      legacyBareSlugs: new Set(),
    })).toBe("unmanaged");
  });

  test("an unmanaged playbook remains unmanaged even for a plugin-owned slug", () => {
    expect(runnerOwnership({
      dirName: "team-playbook",
      slug: "test-pro-disabled-stage",
      marker: "absent",
      legacyBareSlugs: new Set(["test-pro-disabled-stage"]),
    })).toBe("unmanaged");
  });

  test("a core prefix does not own a mismatched body slug", () => {
    expect(runnerOwnership({
      dirName: "aidlc-other-stage",
      slug: "documented-stage",
      marker: "absent",
      legacyBareSlugs: new Set(),
    })).toBe("unmanaged");
  });

  test("a bare directory without legacy plugin ownership is unmanaged", () => {
    expect(runnerOwnership({
      dirName: "retired-stage",
      slug: "retired-stage",
      marker: "absent",
      legacyBareSlugs: new Set(),
    })).toBe("unmanaged");
  });
});
