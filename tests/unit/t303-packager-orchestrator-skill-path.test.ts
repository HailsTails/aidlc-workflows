// covers: file:scripts/package.ts
//
// The packager refreshes generated table regions in the assembled orchestrator
// skill. The location is an open harness contract, not a hardcoded shortlist.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { HARNESS_MATRIX } from "../harness/harness-matrix.ts";
import { REPO_ROOT } from "../harness/fixtures.ts";

describe("t303 manifest-owned orchestrator skill path", () => {
  test("every harness declares an in-tree emitted skill that exists in dist", async () => {
    for (const { name, manifest } of HARNESS_MATRIX) {
      const rel = manifest.orchestratorSkillPath;
      expect(rel.length).toBeGreaterThan(0);
      expect(isAbsolute(rel)).toBe(false);
      expect(rel.split(/[\\/]/)).not.toContain("..");
      expect(existsSync(join(REPO_ROOT, "dist", name, rel))).toBe(true);
    }
  });

  // An agent opens what the skill names from the project root (Codex 0.160
  // and Claude Code both do for these paths), so every file the emitted skill
  // and its question rules name under the harness folder must be there.
  test("every file an emitted skill names under its harness folder exists from the project root", async () => {
    for (const { name, manifest } of HARNESS_MATRIX) {
      const skill = join(REPO_ROOT, "dist", name, manifest.orchestratorSkillPath);
      const reference = new RegExp(`\`(${manifest.harnessDir.replace(".", "\\.")}/[^\`\\s]+)\``, "g");
      let named = 0;
      for (const file of readdirSync(dirname(skill)).filter((entry) => entry.endsWith(".md"))) {
        for (const match of readFileSync(join(dirname(skill), file), "utf-8").matchAll(reference)) {
          const path = match[1].replace(/[.,;:)]+$/, "");
          if (/[<*{]/.test(path)) continue;
          named++;
          expect(existsSync(join(REPO_ROOT, "dist", name, path)), `${name} ${file}: ${path}`).toBe(true);
        }
      }
      expect(named, name).toBeGreaterThan(0);
    }
  });
});
