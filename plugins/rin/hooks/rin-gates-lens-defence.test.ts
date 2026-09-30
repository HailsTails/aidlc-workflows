// Coverage guard for the review lenses' tree-binding defence (task 019fd9b8).
//
// PR #446 gave six rin-pr-* lenses a head-sha binding and a mandatory
// CANNOT-REVIEW abstention. The twelve GATE lenses were left without it for
// weeks — Gate 5 was structurally defended while Gates 3 and 4, the gates that
// DESIGN the code, accepted verdicts from lenses that could not prove which tree
// they read. Nothing failed when the defence was missing, which is precisely why
// it stayed missing.
//
// The scribe now enforces the binding mechanically, so a lens that never learned
// to echo simply gets discarded — correct, but it converts a silent hole into a
// silently unproductive board. This guard closes that: a reviewer agent shipped
// without the contract fails here, at the only moment anyone would notice.
//
// It reads the agent files as DATA rather than restating their text, so it pins
// coverage without becoming a 23rd copy to drift.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");

const AGENT_DIRS: readonly string[] = [
  join(REPO_ROOT, "dist", "plugins", "rin", "claude", "agents"),
  join(REPO_ROOT, "plugins", "rin", "agents"),
];

const reviewerAgentsIn = (dir: string): readonly string[] =>
  readdirSync(dir).filter((entry) => entry.endsWith("-reviewer-agent.md"));

const bodyOf = (dir: string, file: string): string =>
  readFileSync(join(dir, file), "utf-8");

describe.each(
  AGENT_DIRS,
)("every reviewer agent in %s carries the tree-binding defence", (dir) => {
  const agents = reviewerAgentsIn(dir);

  test("the directory actually holds reviewer agents", () => {
    expect(agents.length).toBeGreaterThan(0);
  });

  test.each(agents)("%s requires the head-sha echo", (file) => {
    expect(bodyOf(dir, file)).toMatch(/head sha/i);
  });

  test.each(agents)("%s mandates the CANNOT-REVIEW abstention", (file) => {
    expect(bodyOf(dir, file)).toContain("CANNOT-REVIEW");
  });

  // The asymmetry is the safety argument, and it is the part most likely to be
  // "simplified" away by a later editor who reads the rule as "verdicts must
  // echo". A NOT-READY that loses its echo requirement is a refusal that can be
  // dropped — the one direction this machine must never move in.
  test.each(
    agents,
  )("%s states that a refusal is never dropped for a missing echo", (file) => {
    expect(bodyOf(dir, file)).toMatch(
      /NOT-READY is captured either way|never dropped/i,
    );
  });
});

const RIN_AGENT_DIR = join(REPO_ROOT, "plugins", "rin", "agents");

describe("every rin reviewer agent asks for the verdict shape the scribe reads", () => {
  const agents = reviewerAgentsIn(RIN_AGENT_DIR);

  test.each(agents)("%s ends its reply under a ## Verdict heading", (file) => {
    expect(bodyOf(RIN_AGENT_DIR, file)).toContain(
      "End your reply with a `## Verdict` heading.",
    );
  });

  test.each(
    agents,
  )("%s is told a READY lists no undisposed finding", (file) => {
    expect(bodyOf(RIN_AGENT_DIR, file)).toMatch(
      /A READY lists no (findings|gaps), because a cited (finding|gap) blocks the gate unless it carries its disposition/,
    );
  });

  test.each(agents)("%s is never told to write a ## Review section", (file) => {
    expect(bodyOf(RIN_AGENT_DIR, file)).not.toContain("`## Review` section");
  });
});
