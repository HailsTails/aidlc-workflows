// scripts/agent-knowledge.ts - build-time knowledge delivery for delegated
// agent definitions.
//
// The two review-only agents (product-lead, architecture-reviewer) are always
// DISPATCHED (§12a), never inline, so their context is whatever the harness
// builds from the agent definition: the .md body everywhere, plus a
// `resources` preload on Kiro CLI only. Their `knowledge/<agent>/reviewing.md`
// checklist used to reach them only if they chose to read it at runtime - the
// same prose-only, non-deterministically-skipped delivery as the
// rules_in_context defect (the sibling surface in the same report). The
// deterministic channel for a dispatched agent is its definition body, so the
// packager absorbs each reviewer's knowledge files into its .md body at build
// time. The knowledge file stays the single hand-authored source of truth;
// the absorbed copy is generated, like everything else in dist/.
//
// Used by scripts/package.ts (the declarative projection: Claude, Kiro,
// Kiro IDE, and the opencode .aidlc copies) AND by the codex/opencode emit.ts
// plugins (which read core/agents/*.md directly, bypassing the packager's
// transform).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { sharedKnowledgeWithoutFormatDocs } from "../core/tools/aidlc-inline-context.ts";

// Append the agent's knowledge/<agent>/*.md files (sorted) to an agent .md
// body. Returns the input unchanged for non-reviewer agents and when the
// knowledge dir is absent/empty. The header names the authored source so a
// reader of the generated file knows where to edit. The absorbed text is
// token-free by construction (the knowledge files carry no {{HARNESS_DIR}}
// token today; if one appears, the caller's ordering - absorb BEFORE token
// substitution - resolves it like any core prose).
export function absorbReviewerKnowledge(request: {
  content: string; agentName: string; sourceRoot: string; reviewerAgents: ReadonlySet<string>;
}): string {
  const { content, agentName, sourceRoot, reviewerAgents } = request;
  if (!reviewerAgents.has(agentName)) return content;
  const knowledgeDir = join(sourceRoot, "knowledge", agentName);
  if (!existsSync(knowledgeDir)) return content;
  const files = readdirSync(knowledgeDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  if (files.length === 0) return content;
  const sections = files.map((f) => {
    const text = readFileSync(join(knowledgeDir, f), "utf-8").trim();
    return (
      `<!-- Absorbed at build time from knowledge/${agentName}/${f} - ` +
      `edit that file, not this generated copy. -->\n\n${text}`
    );
  });
  return `${content.trimEnd()}\n\n---\n\n${sections.join("\n\n---\n\n")}\n`;
}

const DELEGATED_KNOWLEDGE_PREFLIGHT =
  "<!-- aidlc-delegated-knowledge-preflight -->";

// Inject a compact, projection-owned preflight into every delegated agent
// definition. Authored core/plugin personas stay focused on unique role
// content, while each harness-native dispatch surface still carries the
// mandatory methodology + team knowledge load that a dispatched worker cannot
// inherit from the conductor's inline_context_paths.
export function injectDelegatedKnowledgePreflight(
  content: string,
  agentName: string,
  harnessDir: string,
): string {
  if (content.includes(DELEGATED_KNOWLEDGE_PREFLIGHT)) return content;
  const block =
    `${DELEGATED_KNOWLEDGE_PREFLIGHT}\n` +
    `**Delegated knowledge preflight (mandatory):** Before substantive work, ` +
    `ensure every readable Markdown file under these directories is loaded, in order: ` +
    `${sharedKnowledgeWithoutFormatDocs(harnessDir)}, ` +
    `\`${harnessDir}/knowledge/${agentName}/\`, ` +
    `\`aidlc/spaces/<active-space>/knowledge/aidlc-shared/\`, then ` +
    `\`aidlc/spaces/<active-space>/knowledge/${agentName}/\`. ` +
    `A native resource preload satisfies this requirement; otherwise read the files now. ` +
    (harnessDir === ".kiro"
      ? `Kiro shows only part of a long file: read each one with your file tool in parts of at most 200 lines ` +
        `(offset and limit), from the first line to the last; a read that comes back cut short is not all of it. `
      : "") +
    `The dispatch brief supplies rules and artifact paths separately.`;
  const frontmatter = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!frontmatter) return `${block}\n\n${content.trimStart()}`;
  return (
    content.slice(0, frontmatter[0].length) +
    `${block}\n\n` +
    content.slice(frontmatter[0].length)
  );
}

// The agent slug for a projected agents/*.md path, or null when the path is
// not an agent persona file. Shared so the packager transform and the emit
// plugins gate absorption identically.
export function agentNameFromPath(srcPath: string): string | null {
  const posixPath = srcPath.split(sep).join("/");
  if (!posixPath.includes("/agents/") || !posixPath.endsWith("-agent.md")) {
    return null;
  }
  return posixPath.split("/").pop()?.replace(/\.md$/, "") ?? null;
}
