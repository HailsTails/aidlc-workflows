import { describe, expect, test } from "vitest";
import { z } from "zod";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import { defaultFileTextPort } from "./rin-harness-sidecar-file-reader.ts";

const paths = defaultPathOperations();
const files = defaultFileTextPort();

const PLUGIN_ROOT = paths.join({
  segments: [paths.dirname({ path: paths.fromFileUrl({ url: import.meta.url }) }), ".."],
});

const BOARD_COORDINATOR = "rin-decorrelated-review-agent";
const CUSTOMER_LENS = "rin-customer-reviewer-agent";
const SYNTHESIS_LENS = "rin-intent-defense-reviewer-agent";
const MINIMUM_REVIEW_ITERATIONS = 2;
const FULL_REVIEW_CLASS = "adversarial";

const OBLIGATION_GATES = [
  "inception/rin-gate-1-framing",
  "inception/rin-gate-2-plan-review",
  "inception/rin-gate-3-interface-lock",
] as const;

type ObligationGate = (typeof OBLIGATION_GATES)[number];

const DISPOSITION_RECORDS: Readonly<Record<ObligationGate, string>> = {
  "inception/rin-gate-1-framing": "rin-framing-questions",
  "inception/rin-gate-2-plan-review": "rin-options-questions",
  "inception/rin-gate-3-interface-lock": "rin-design-questions",
};

const rosterFileSchema = z.object({ byGate: z.record(z.string(), z.unknown()) });
const rosterSchema = z.array(z.string());
const boardSchema = z.object({
  roster_dispatch_gates: z.array(z.string()),
  producing_lenses: z.array(z.object({ lens: z.string(), agent: z.string() })),
});

const readPluginFile = (segments: readonly string[]): string =>
  files.read(paths.join({ segments: [PLUGIN_ROOT, ...segments] }));

const frontmatterOf = (text: string): string => text.split(/^---\r?$/m)[1] ?? "";

const scalarField = (frontmatter: string, field: string): string | undefined =>
  frontmatter.match(new RegExp(`^${field}:[ \\t]*(.+?)[ \\t]*\\r?$`, "m"))?.[1];

const listField = (frontmatter: string, field: string): readonly string[] => {
  const block = frontmatter.match(new RegExp(`^${field}:\\r?\\n((?:[ \\t]+-[^\\n]*\\n?)*)`, "m"))?.[1] ?? "";
  return [...block.matchAll(/^[ \t]+-[ \t]*(\S+)/gm)].map((entry) => entry[1] ?? "");
};

const stageFrontmatter = (gate: string): string =>
  frontmatterOf(readPluginFile(["stages", `${gate}.md`]));

const slugOf = (gate: string): string => gate.split("/")[1] ?? gate;

const rosters = rosterFileSchema.parse(JSON.parse(readPluginFile(["hooks", "review-rosters.json"]))).byGate;
const board = boardSchema.parse(JSON.parse(readPluginFile(["tools", "data", "review-board.json"])));

const rosterOf = (gate: string): readonly string[] => rosterSchema.parse(rosters[slugOf(gate)]);

const scopesRunning = (gate: string): readonly string[] => listField(stageFrontmatter(gate), "scopes");

const DISPOSITIONS_HEADING = "## Objection dispositions";
const DISPOSITIONS_REFERENCE = '§ "Objection dispositions"';

const dispositionsSection = (): string => {
  const contract = readPluginFile(["knowledge", "rin-gates", "ensemble-contract.md"]);
  const afterHeading = contract.split(`\n${DISPOSITIONS_HEADING}\n`)[1] ?? "";
  return afterHeading.split(/\n## /)[0] ?? "";
};

const scopeReviewCap = (scope: string): string | undefined =>
  scalarField(frontmatterOf(readPluginFile(["scopes", `${scope}.md`])), "review_cap");

describe("Gates 1 to 3 keep the board that catches over-correction", () => {
  test.each(OBLIGATION_GATES)("%s is reviewed by the board", (gate) => {
    expect(scalarField(stageFrontmatter(gate), "reviewer")).toBe(BOARD_COORDINATOR);
    expect(board.roster_dispatch_gates).toContain(slugOf(gate));
  });

  test.each(OBLIGATION_GATES)("%s seats the customer lens and closes on intent defence", (gate) => {
    expect(rosterOf(gate)).toContain(CUSTOMER_LENS);
    expect(rosterOf(gate).at(-1)).toBe(SYNTHESIS_LENS);
  });

  test("the board catalogue keeps the customer lens the gates seat", () => {
    expect(board.producing_lenses.map((producingLens) => producingLens.agent)).toContain(CUSTOMER_LENS);
  });

  test.each(OBLIGATION_GATES)("%s declares the record of every objection's disposition", (gate) => {
    expect(listField(stageFrontmatter(gate), "produces")).toContain(DISPOSITION_RECORDS[gate]);
    expect(dispositionsSection()).toContain(`\`${DISPOSITION_RECORDS[gate]}.md\``);
    expect(readPluginFile(["stages", `${gate}.md`])).toContain(
      `Record in \`${DISPOSITION_RECORDS[gate]}.md\` a disposition for every objection a seat raised in any round, as the ensemble contract's ${DISPOSITIONS_REFERENCE} says.`,
    );
  });

  test("the board dispatch hands the customer lens the disposition record", () => {
    expect(readPluginFile(["knowledge", "rin-gates", "decorrelated-review.md"])).toContain(
      "passes the customer lens, for its objection check, that record's path",
    );
  });

  test("the customer lens reads the disposition record for its objection check", () => {
    expect(readPluginFile(["agents", `${CUSTOMER_LENS}.md`])).toContain(
      `is in the gate's decision record your dispatch names (\`{{HARNESS_DIR}}/knowledge/rin-gates/ensemble-contract.md\` ${DISPOSITIONS_REFERENCE})`,
    );
  });

  test.each(OBLIGATION_GATES)("%s reviews at the full class", (gate) => {
    expect(scalarField(stageFrontmatter(gate), "review_class") ?? FULL_REVIEW_CLASS).toBe(FULL_REVIEW_CLASS);
  });

  test.each(OBLIGATION_GATES)("%s is run only by scopes that keep the full review class", (gate) => {
    expect(scopesRunning(gate).length).toBeGreaterThan(0);
    expect(scopesRunning(gate).map((scope) => scopeReviewCap(scope) ?? FULL_REVIEW_CLASS)).toEqual(
      scopesRunning(gate).map(() => FULL_REVIEW_CLASS),
    );
  });

  test.each(OBLIGATION_GATES)("%s re-runs the board over its fix pass", (gate) => {
    expect(Number(scalarField(stageFrontmatter(gate), "reviewer_max_iterations"))).toBeGreaterThanOrEqual(
      MINIMUM_REVIEW_ITERATIONS,
    );
  });

  test("the customer lens checks conceded objections as well as kept ones", () => {
    expect(readPluginFile(["agents", `${CUSTOMER_LENS}.md`])).toContain(
      "whether its author kept against it or conceded it",
    );
  });
});
