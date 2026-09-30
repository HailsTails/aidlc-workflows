// covers: file:agents/aidlc-architect-agent.md, file:agents/aidlc-architecture-reviewer-agent.md, file:agents/aidlc-aws-platform-agent.md, file:agents/aidlc-compliance-agent.md, file:agents/aidlc-composer-agent.md, file:agents/aidlc-delivery-agent.md, file:agents/aidlc-design-agent.md, file:agents/aidlc-developer-agent.md, file:agents/aidlc-devsecops-agent.md, file:agents/aidlc-operations-agent.md, file:agents/aidlc-pipeline-deploy-agent.md, file:agents/aidlc-product-agent.md, file:agents/aidlc-product-lead-agent.md, file:agents/aidlc-quality-agent.md (t216 projected model+effort contract)
//
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TIER_PROJECTIONS, type TierProjection } from "../../core/tools/aidlc-tiers.ts";
import { AIDLC_SRC } from "../harness/fixtures.ts";

const AGENTS_DIR = join(AIDLC_SRC, "agents");

const AGENTS = [
  "architect",
  "architecture-reviewer",
  "aws-platform",
  "compliance",
  "composer",
  "delivery",
  "design",
  "developer",
  "devsecops",
  "operations",
  "pipeline-deploy",
  "product",
  "product-lead",
  "quality",
] as const;

type Agent = (typeof AGENTS)[number];

// The PROJECTED per-agent contract, hard-coded independently of the source
// (both the agent files and the projection table), so the test pins the
// policy rather than echoing either. effort: null = the line must be ABSENT.
const EXPECTED: Record<Agent, TierProjection["claude"]> = {
  architect: { model: "opus", effort: null },
  "architecture-reviewer": { model: "sonnet", effort: "medium" },
  "aws-platform": { model: "opus", effort: null },
  compliance: { model: "opus", effort: null },
  composer: { model: "opus", effort: null },
  delivery: { model: "sonnet", effort: "medium" },
  design: { model: "opus", effort: null },
  developer: { model: "opus", effort: null },
  devsecops: { model: "opus", effort: null },
  operations: { model: "sonnet", effort: "medium" },
  "pipeline-deploy": { model: "sonnet", effort: "medium" },
  product: { model: "opus", effort: null },
  "product-lead": { model: "sonnet", effort: "medium" },
  quality: { model: "opus", effort: null },
};

const agentFile = (agent: Agent): string =>
  join(AGENTS_DIR, `aidlc-${agent}-agent.md`);

function frontmatter(agent: Agent): string {
  const body = readFileSync(agentFile(agent), "utf-8");
  const m = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error(`no YAML frontmatter block in aidlc-${agent}-agent.md`);
  return m[1];
}

function keyValues(fm: string, key: string): string[] {
  return [...fm.matchAll(new RegExp(`^${key}:\\s*(\\S+)\\s*$`, "gm"))].map((m) => m[1]);
}

describe("t216 complete Claude agent tier-projection contract", () => {
  test("maintained Claude tier projections preserve the fork policy", () => {
    expect(TIER_PROJECTIONS.judgment.claude).toEqual({ model: "opus", effort: null });
    expect(TIER_PROJECTIONS.balanced.claude).toEqual({ model: "sonnet", effort: "medium" });
    expect(TIER_PROJECTIONS.templated.claude).toEqual({ model: "sonnet", effort: "medium" });
  });
  test("shipped Claude roster is exactly the expected 14 agent files", () => {
    const shipped = readdirSync(AGENTS_DIR)
      .filter((name) => name.endsWith("-agent.md"))
      .sort();
    const expected = AGENTS.map((agent) => `aidlc-${agent}-agent.md`).sort();
    expect(shipped).toEqual(expected);
  });

  test("model: appears exactly once in every shipped agent frontmatter", () => {
    for (const agent of AGENTS) {
      const values = keyValues(frontmatter(agent), "model");
      expect(values.length, `aidlc-${agent}-agent.md: model: line count`).toBe(1);
    }
  });

  test("model: values match the projected per-tier policy", () => {
    for (const agent of AGENTS) {
      const values = keyValues(frontmatter(agent), "model");
      expect(values[0], `aidlc-${agent}-agent.md: model value`).toBe(EXPECTED[agent].model);
    }
  });

  test("effort is pinned for balanced and templated agents and absent for judgment", () => {
    for (const agent of AGENTS) {
      const values = keyValues(frontmatter(agent), "effort");
      const want = EXPECTED[agent].effort;
      if (want === null) {
        // ABSENCE is the contract: an effort: pin would override the session
        // effort in both directions, silently capping an xhigh session.
        expect(
          values.length,
          `aidlc-${agent}-agent.md: effort: must be ABSENT (inherits session effort)`,
        ).toBe(0);
      } else {
        expect(values.length, `aidlc-${agent}-agent.md: effort: line count`).toBe(1);
        expect(values[0], `aidlc-${agent}-agent.md: effort value`).toBe(want);
      }
    }
  });

  test("tier: never leaks into shipped Claude frontmatter (projection completeness)", () => {
    for (const agent of AGENTS) {
      const fm = frontmatter(agent);
      expect(
        /^tier:/m.test(fm),
        `aidlc-${agent}-agent.md: raw tier: leaked through the projection`,
      ).toBe(false);
    }
  });

  test("modelOverride: is absent from every shipped agent frontmatter", () => {
    for (const agent of AGENTS) {
      const fm = frontmatter(agent);
      expect(
        /^modelOverride:/m.test(fm),
        `aidlc-${agent}-agent.md: modelOverride: must not be in frontmatter`,
      ).toBe(false);
    }
  });
});
