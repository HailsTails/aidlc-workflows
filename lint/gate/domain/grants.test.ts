import { describe, expect, test } from "bun:test";
import { judgeDeletion, type ModuleShape } from "./deletion.ts";
import { judgeJsonGrant } from "./json-grant.ts";

const base: ModuleShape = {
  declarations: ["keep", "loadStageGraph", "loadScope"],
  statements: ["const keep = 1;", "function loadStageGraph() {}", "function loadScope() {}"],
};

const grant = { pattern: "core/tools/aidlc-lib.ts", declarations: ["loadStageGraph"] };

describe("judgeDeletion", () => {
  test("deleting a granted declaration passes", () => {
    const head = {
      declarations: ["keep", "loadScope"],
      statements: ["const keep = 1;", "function loadScope() {}"],
    };
    expect(judgeDeletion({ path: "lib.ts", grant, base, head })).toEqual([]);
  });

  test("deleting a declaration the lane was not given is refused", () => {
    const head = { declarations: ["keep"], statements: ["const keep = 1;"] };
    const subjects = judgeDeletion({ path: "lib.ts", grant, base, head }).map((f) => f.subject);
    expect(subjects).toEqual(["lib.ts · loadScope"]);
  });

  test("changing a statement that stays is refused", () => {
    const head = {
      declarations: ["keep", "loadScope"],
      statements: ["const keep = 2;", "function loadScope() {}"],
    };
    const findings = judgeDeletion({ path: "lib.ts", grant, base, head });
    expect(findings.map((f) => f.violation)).toEqual([
      "changes or adds code, where the lane may only delete declarations",
    ]);
  });

  test("a * grant allows deleting the whole file", () => {
    const wholeFile = { ...grant, declarations: ["*"] };
    expect(judgeDeletion({ path: "x.ts", grant: wholeFile, base, head: undefined })).toEqual([]);
  });
});

describe("judgeJsonGrant", () => {
  const packageGrant = { path: "package.json", keyPaths: ["devDependencies", "scripts.lint"] };

  test("granted keys may change", () => {
    const before = { devDependencies: { a: "1" }, scripts: { lint: "biome" } };
    const after = { devDependencies: { a: "1", zod: "4" }, scripts: { lint: "gate" } };
    expect(judgeJsonGrant({ grant: packageGrant, base: before, head: after })).toEqual([]);
  });

  test("any other key is refused by its key path", () => {
    const before = { scripts: { check: "x" }, name: "a" };
    const after = { scripts: { check: "y" }, name: "a" };
    const findings = judgeJsonGrant({ grant: packageGrant, base: before, head: after });
    expect(findings.map((finding) => finding.subject)).toEqual(["package.json · scripts.check"]);
  });
});
