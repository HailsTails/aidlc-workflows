// covers: file:scripts/package.ts
//
// The packager refreshes generated table regions in the assembled orchestrator
// skill. The location is an open harness contract, not a hardcoded shortlist.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { orchestratorSkillLocation, type HarnessManifest } from "../../scripts/manifest-types.ts";
import { REPO_ROOT } from "../harness/fixtures.ts";

describe("t303 manifest-owned orchestrator skill path", () => {
  test("every harness declares an in-tree emitted skill that exists in dist", async () => {
    const harnesses = readdirSync(join(REPO_ROOT, "harness"))
      .filter((name) => existsSync(join(REPO_ROOT, "harness", name, "manifest.ts")))
      .sort();

    for (const name of harnesses) {
      const module = await import(
        pathToFileURL(join(REPO_ROOT, "harness", name, "manifest.ts")).href
      ) as { default: HarnessManifest };
      expect(module.default.orchestratorSkillPath).toBeDefined();
      const rel = orchestratorSkillLocation(module.default);
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
    const harnesses = readdirSync(join(REPO_ROOT, "harness"))
      .filter((name) => existsSync(join(REPO_ROOT, "harness", name, "manifest.ts")))
      .sort();
    for (const name of harnesses) {
      const manifest = (await import(
        pathToFileURL(join(REPO_ROOT, "harness", name, "manifest.ts")).href
      ) as { default: HarnessManifest }).default;
      const skill = join(
        REPO_ROOT, "dist", name,
        orchestratorSkillLocation(manifest),
      );
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

  test("the shared resolver supplies the default or declared native entry", () => {
    expect(orchestratorSkillLocation({ harnessDir: ".native" }))
      .toBe(".native/skills/aidlc/SKILL.md");
    expect(orchestratorSkillLocation({ harnessDir: ".native",
      orchestratorSkillPath: "native-skills/aidlc/SKILL.md" }))
      .toBe("native-skills/aidlc/SKILL.md");
  });
});
