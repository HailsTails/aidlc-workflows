// covers: file:scripts/package.ts, file:src/hosts/claude/host-data.ts
//
// t-question-options-fit-the-box: the questions file gives each question no
// more lettered options than the harness's question box shows besides its own
// Other row, so the agent puts every question in the box whole. Claude Code's
// AskUserQuestion takes four: a file lettered A-E had the person see "Invalid
// tool parameters" before the box, or a box without one of the file's options.
// The harness manifest owns the number (`questionOptions`); the packager writes
// the letters into the prose the agent reads before it writes the file.
//
// Read from the generated dist/ trees: the letters are a projection, so the
// bytes that ship are the subject.

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { HarnessManifest } from "../../scripts/manifest-types.ts";
import { HOST_BUILD_MEMBERS } from "../../src/cli/host-table.ts";
import { REPO_ROOT } from "../harness/fixtures.ts";

const LEGACY_NAMES = readdirSync(join(REPO_ROOT, "harness"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(REPO_ROOT, "harness", entry.name, "manifest.ts")))
  .map((entry) => entry.name)
  .sort();
const FULL_HOSTS = HOST_BUILD_MEMBERS.filter((member) => member.distribution);
const HARNESS_NAMES = [...new Set([...LEGACY_NAMES,
  ...FULL_HOSTS.map((member) => member.host.distribution)])].sort();

const manifests = new Map<string, HarnessManifest>();
for (const name of LEGACY_NAMES) {
  manifests.set(name, (await import(join(REPO_ROOT, "harness", name, "manifest.ts"))).default as HarnessManifest);
}

// Where the agent reads that a question's options are lettered, in each tree.
const LETTER_SITES: Array<{ file: string; line: RegExp }> = [
  { file: "aidlc-common/protocols/stage-protocol.md", line: /^- Include options (A-[A-Z]) as appropriate for each question$/m },
  { file: "aidlc-common/stages/inception/requirements-analysis.md", line: /Include context-appropriate questions with (A-[A-Z]) options\./ },
  { file: "aidlc-common/stages/ideation/intent-capture.md", line: /Include (A-[A-Z]) options with X \(Other\) as final option\./ },
];

function engineRoot(name: string): string {
  const member = FULL_HOSTS.find((candidate) => candidate.host.distribution === name);
  const directory = member?.host.directory ?? manifests.get(name)?.harnessDir ?? "";
  return join(REPO_ROOT, "dist", name, directory);
}

function questionOptions(name: string): number | undefined {
  const member = FULL_HOSTS.find((candidate) => candidate.host.distribution === name);
  if (!member) return manifests.get(name)?.questionOptions;
  const letters = member.tokens.OPTION_LETTERS;
  if (!letters || !/^A-[B-E]$/.test(letters)) throw new Error(`Invalid host option letters: ${letters}`);
  return letters.charCodeAt(2) - 64;
}

function lettersIn(name: string): string[] {
  return LETTER_SITES.map(({ file, line }) => {
    const text = readFileSync(join(engineRoot(name), file), "utf-8");
    return line.exec(text)?.[1] ?? `no letter line in ${file}`;
  });
}

function* markdownFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* markdownFiles(path);
    else if (/\.(?:md|mdc)$/.test(entry.name)) yield path;
  }
}

describe("the questions file fits the harness's question box", () => {
  test("on Claude Code each question's options are lettered A-D, the four AskUserQuestion shows", () => {
    expect(questionOptions("claude")).toBe(4);
    expect(lettersIn("claude")).toEqual(["A-D", "A-D", "A-D"]);
    const protocol = readFileSync(join(engineRoot("claude"), "aidlc-common/protocols/stage-protocol.md"), "utf-8");
    expect(protocol).toContain("If an answer does not match any provided option (A-D, X)");
    expect(protocol).not.toMatch(/\bA-E\b/);
  });

  test("a harness whose box takes five or more keeps A-E", () => {
    const unlimited = HARNESS_NAMES.filter((name) => (questionOptions(name) ?? 5) >= 5);
    expect(unlimited.length).toBeGreaterThan(0);
    for (const name of unlimited) expect(lettersIn(name), name).toEqual(["A-E", "A-E", "A-E"]);
  });

  test("Claude Code's question-rendering annex names the same box size as its manifest", () => {
    const annex = readFileSync(join(REPO_ROOT, "harness", "claude", "skills", "aidlc", "question-rendering.md"), "utf-8");
    const named = /max (\d+)\s+options per question/.exec(annex)?.[1];
    expect(questionOptions("claude")).toBe(Number(named));
  });

  test("no letters token is left in any shipped tree", () => {
    const leftovers: string[] = [];
    for (const channel of ["dist", "dist-release"]) {
      for (const name of HARNESS_NAMES) {
        const root = join(REPO_ROOT, channel, name);
        if (!existsSync(root)) continue;
        for (const file of markdownFiles(root)) {
          if (readFileSync(file, "utf-8").includes("{{OPTION_LETTERS}}")) leftovers.push(relative(REPO_ROOT, file));
        }
      }
    }
    expect(leftovers).toEqual([]);
  });
});
