// Shared resolution for required stage-rule content.
//
// The orchestration engine uses this module to transport rules through bounded
// load-steering directives. Dispatch hooks use the same resolver when they
// attach the exact bundle to a subagent brief, so the conductor-to-worker hop
// cannot drift from the engine-to-conductor hop.

import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import {
  baseRuleDelivery,
  errorMessage,
  resolveWorkflowSelection,
  toPosix,
} from "./aidlc-lib.ts";
import {
  type GraphStage,
  memoryDirFor,
} from "./aidlc-graph.ts";

export type RuleEntry = { rel: string; abs: string };
export type RuleContent = { path: string; text: string };

// These are explanatory preambles in the shipped empty team/project templates,
// not policy. Match exact lines so any authored blockquote remains substantive.
const TEMPLATE_PREAMBLE_LINES = new Set([
  "> This team's affirmed practices and corrections. Loaded after `org.md` as",
  "> strict-additive guidance; contradictions with broader policy are rejected.",
  "> Populated by the practices-discovery affirmation gate. Edit at the gate,",
  "> not directly.",
  "> Project-specific specialisation and corrections. Loaded after `org.md` and",
  "> `team.md` as strict-additive guidance; contradictions with broader policy",
  "> are rejected. Populated by practices-discovery and the self-learning loop.",
  ">",
  "> Use sparingly: most teams don't need a project layer. Reach for it",
  "> only when this specific project needs stable, durable guidance beyond the",
  "> team practice (for example, package-specific release checks or an additional",
  "> regression suite for a legacy component).",
]);

// A rule template is substantive once it contains a non-comment body line.
// Blockquotes are policy-capable Markdown and count unless they are one of the
// exact shipped template preamble lines above.
export function isSubstantiveRuleText(text: string): boolean {
  const stripped = text.replace(/<!--[\s\S]*?-->/g, "");
  return stripped.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (trimmed === "") return false;
    if (trimmed.startsWith("#")) return false;
    if (TEMPLATE_PREAMBLE_LINES.has(trimmed)) return false;
    if (/^-{3,}$/.test(trimmed)) return false;
    return true;
  });
}

// The BASE method layers — the space `memory/` files. On a harness that loads
// these itself every turn (`baseRuleDelivery: "ambient"` in harness.json),
// re-transporting their text tells the session nothing it does not have; the
// steering bundle carries the reference instead, and the stage delta becomes
// the only thing in the payload. On an "explicit" harness the engine is the
// ONLY channel, so they travel in full.
//
// Why this is a declared harness lever and not a heuristic: the failure
// directions are not symmetric. Wrongly treating an ambient harness as explicit
// re-sends text it already has; wrongly treating an explicit one as ambient
// drops its method entirely. So it fails closed to "explicit", and the value is
// read from harness config rather than guessed from prose or the harness name.
const BASE_RULE_BASENAMES = new Set([
  "org.md",
  "team.md",
  "project.md",
  "ideation.md",
  "inception.md",
  "construction.md",
  "operation.md",
]);

export function isBaseRuleLayer(rel: string): boolean {
  const marker = "/memory/";
  const index = rel.indexOf(marker);
  if (index < 0) return false;
  const subpath = rel.slice(index + marker.length);
  const basename = subpath.split("/").pop() ?? "";
  const isPhaseRule = subpath.startsWith("phases/");
  return (
    BASE_RULE_BASENAMES.has(basename) && (isPhaseRule || !subpath.includes("/"))
  );
}

// Resolve graph display paths against the active space. AIDLC_RULES_DIR keeps
// its existing precedence for Codex and fixture-driven callers.
export function rulesContentEntries(
  node: GraphStage,
  projectDir: string,
  space: string = resolveWorkflowSelection(projectDir).space,
): RuleEntry[] {
  const configuredMemoryDir = process.env.AIDLC_RULES_DIR;
  const memoryDir = configuredMemoryDir
    ? isAbsolute(configuredMemoryDir)
      ? configuredMemoryDir
      : resolve(projectDir, configuredMemoryDir)
    : memoryDirFor(projectDir, space);
  return (node.rules_in_context ?? []).map((rule) => {
    const marker = "/memory/";
    const index = rule.path.indexOf(marker);
    if (index < 0) {
      return {
        rel: rule.path,
        abs: join(projectDir, rule.path),
      };
    }
    const subpath = rule.path.slice(index + marker.length);
    return {
      rel: toPosix(join("aidlc", "spaces", space, "memory", subpath)),
      abs: join(memoryDir, subpath),
    };
  });
}

export function readRuleBundle(
  entries: RuleEntry[],
): { content: RuleContent[]; error: string | null } {
  const content: RuleContent[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.rel)) continue;
    seen.add(entry.rel);
    let text: string;
    try {
      const bytes = readFileSync(entry.abs);
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      return {
        content: [],
        error:
          `Cannot load required stage rule "${entry.rel}" (${errorMessage(error)}). ` +
          "The stage has not started. Restore the file or fix its permissions/UTF-8 encoding, then run `next` again.",
      };
    }
    // The file is READ before this filter, deliberately: an unreadable or
    // non-UTF-8 rule must still fail the stage, so skipping its transport never
    // weakens the integrity check — it only stops re-sending text the session
    // already holds through the harness's own include.
    if (baseRuleDelivery() === "ambient" && isBaseRuleLayer(entry.rel)) continue;
    if (isSubstantiveRuleText(text)) content.push({ path: entry.rel, text });
  }
  return { content, error: null };
}

export function resolvedRuleBundle(
  node: GraphStage,
  projectDir: string,
  space: string = resolveWorkflowSelection(projectDir).space,
): { content: RuleContent[]; error: string | null } {
  return readRuleBundle(rulesContentEntries(node, projectDir, space));
}
