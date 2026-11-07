// harness/codex/emit.ts — the Codex CLI per-shell emission plugin.
//
// The unified packager copies core/ -> dist/codex/.codex/ (rules prose ->
// aidlc-rules) and runs graph compile, then calls this emit() for everything
// that is CODE, not declarative data: the Codex config, hook wiring, trust
// pre-seed, the onboarding skills-path rewrite, per-agent TOML transpositions,
// and .agents/skills/ tree (orchestrator + generated runners + session
// skills + openai.yaml guards).
//
// The harness-dir token / anchored-prefix transform is exposed via
// ctx.substituteToken, plus a local aidlc-rules rename mirroring the
// packager's (rewriteProse).
//
// emit() also owns the codex skills layout: skills do NOT ship in
// .codex/skills/ (Codex discovers skills at <project>/.agents/skills/), so the
// manifest sets skipRunnerGen and emit composes the runners here.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { EmitContext } from "../../scripts/manifest-types.ts";
import {
  absorbReviewerKnowledge,
  injectDelegatedKnowledgePreflight,
} from "../../scripts/agent-knowledge.ts";
import type { Tier } from "../../core/tools/aidlc-tiers.ts";
import {
  modelAgentName,
  resolveModelPolicy,
  writeCodexAgentSurface,
} from "../../core/tools/aidlc-model-policy.ts";

export { emitDefaultRules, emitTrustSeed, trustEntries } from "./settings.ts";
import { emitHooksJson, emitConfigToml, emitDefaultRules, emitTrustSeed } from "./settings.ts";

// --- Agent transposition: persona .md → .codex/agents/*.toml ----------------
// The model map is DERIVED from the tier projection module. Codex reads
// `tier:` from the core agent .md (authoritative source of truth) and looks up
// {model, effort} via projectTier. A null projected value means the TOML key
// is OMITTED: the spawned role inherits the session value. Judgment and
// templated omit both keys; balanced omits the model and pins medium reasoning
// effort.

function parseAgentMd(raw: string): { fm: Record<string, string>; body: string } {
  // BOM tolerance, matching the packager's agent reader and the rule parser.
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: {}, body: raw };
  const fm: Record<string, string> = {};
  let current: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) {
      current = kv[1];
      fm[current] = kv[2].replace(/^>\s*$/, "");
    } else if (current && /^\s+\S/.test(line)) {
      if (!line.trim().startsWith("-")) fm[current] = `${fm[current]} ${line.trim()}`.trim();
    }
  }
  return { fm, body: raw.slice(m[0].length) };
}

// A multi-line basic string: a backslash is an escape character, so every
// backslash in the text is doubled first (a bare `\|` in a Markdown table
// note made Codex refuse the whole agent file as malformed TOML), then a
// run of three quotes is escaped so it cannot close the string early.
function tomlMultiline(s: string): string {
  return `"""\n${s.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')}\n"""`;
}

// ---------------------------------------------------------------------------
// emit() — the manifest entry point. Assembles every codex-only emission as a
// {path, content} list, then writes it into the packager-provided dist root.
// ---------------------------------------------------------------------------
export default function emit(ctx: EmitContext): void {
  // tierCap is the packager's resolved pack-time cap, passed through so the
  // emit-owned TOML projections use the SAME cap as every declarative
  // projection - never re-resolved here.
  const {
    coreRoot,
    harnessRoot,
    harnessName,
    distRoot,
    harnessDir,
    trustedRouteNamespace,
    substituteToken,
    tierCap,
  } = ctx;
  const invoke = substituteToken("{{INVOKE}}");
  const CODEX_ROOT = join(distRoot, harnessDir);
  const SKILLS_DST = join(distRoot, ".agents", "skills");

  // The codex anchored transform: token/prefix substitution (.codex) THEN the
  // aidlc-rules rename — mirrors the packager's transform for prose the emit
  // layer generates from core sources (agent bodies and runner prose).
  const rewriteProse = (s: string): string =>
    substituteToken(s).replaceAll(`${harnessDir}/rules/`, `${harnessDir}/aidlc-rules/`);


  function emitAgentToml(mdPath: string): string {
    const raw = readFileSync(mdPath, "utf-8");
    const { fm, body } = parseAgentMd(raw);
    const name = fm.name ?? "";
    // Reviewer knowledge absorption (scripts/agent-knowledge.ts): the emit
    // plugin reads core/agents/*.md directly, so the packager's transform
    // never runs here - absorb into the body the same way it does.
    const absorbedBody = injectDelegatedKnowledgePreflight(
      absorbReviewerKnowledge(body, name, coreRoot),
      name,
      harnessDir,
    );
    const description = (fm.description ?? "").replace(/\s+/g, " ").trim();
    // The authored source of truth is `tier:` on the core .md; the packager's
    // frontmatter transform doesn't run against emit.ts (Codex reads directly
    // from core), so project tier -> {model, effort} here. An agent .md
    // without a tier: line is an authoring bug - fail the build loudly.
    // parseAgentMd's value capture keeps trailing whitespace; trim so an
    // invisible trailing space cannot fail the codex leg alone (the
    // packager's own reader strips it for the other harnesses).
    const tier = fm.tier?.trim();
    if (!tier) throw new Error(`${mdPath}: agent frontmatter has no tier: line.`);
    const effective = resolveModelPolicy(
      null,
      modelAgentName(mdPath),
      tier as Tier,
      "codex",
      tierCap,
    );
    // The harness-neutral reviewer persona cites its own turn cap as "the
    // `maxTurns: <n>` frontmatter above - keep the two numbers in sync". That
    // citation assumes a YAML frontmatter block sits above the body - true on
    // every other harness surface, but Codex TOML personas have no
    // frontmatter at all (Codex agent discovery reads only the TOML; this
    // `developer_instructions` string IS the whole persona) and no native
    // per-agent cap key ships in the emitted TOML. Rewrite the citation for
    // this surface instead of shipping a dangling pointer, mirroring the
    // opencode emitter's own prose rename for its `steps:` key.
    const instructions = rewriteProse(absorbedBody).replace(
      /the `maxTurns: (\d+)` frontmatter above - keep the two numbers in sync/g,
      "the core persona's `maxTurns: $1` cap - Codex TOML personas carry no " +
        "frontmatter and no native per-agent cap key, so this number is " +
        "prose-only here; update it by hand if the authored cap changes",
    );
    return writeCodexAgentSurface(
      `name = "${name}"\n` +
      `description = "${description.replace(/"/g, '\\"')}"\n` +
      `developer_instructions = ${tomlMultiline(instructions.trim())}\n`,
      effective,
    );
  }

  // --- Skill packaging into .agents/skills/ ----------------------------------
  // Compose runner-gen's render fns under the manifest harnessDir. Load the
  // module FROM THE ASSEMBLED DIST TREE (<harnessDir>/tools/) — the packager's
  // compile step already wrote tools/data/stage-graph.json there, and
  // runner-gen resolves its graph + scopes relative to its own location. (core/
  // carries no compiled JSON, so requiring it from coreRoot would fail.)
  const IMPLICIT_GUARD = "policy:\n  allow_implicit_invocation: false\n";
  process.env.AIDLC_HARNESS_DIR = harnessDir;
  process.env.AIDLC_HARNESS_NAME = "codex";
  const gen = require(join(CODEX_ROOT, "tools", "aidlc-runner-gen.ts")) as {
    runnableStages: () => Array<{ slug: string }>;
    renderStageRunner: (node: { slug: string }) => string;
    renderInitRunner: () => string;
    renderComposeRunner: () => string;
    defaultScopeBatch: (discovered?: Record<string, { name: string; description: string; plugin?: string; runner?: boolean }>) => string[];
    discoverScopes: () => Record<string, { name: string; description: string; plugin?: string; runner?: boolean }>;
    renderRunner: (scope: string, description: string) => string;
  };

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else out.push(full);
    }
    return out;
  }

  const onboarding = readFileSync(join(CODEX_ROOT, "onboarding.md"), "utf-8")
    .replaceAll(`${harnessDir}/skills/`, ".agents/skills/");
  const emissions: Array<{ path: string; content: () => string }> = [];

  // codex-only config + wiring + trust + native onboarding skills paths
  emissions.push({
    path: join(CODEX_ROOT, "hooks.json"),
    content: () =>
      emitHooksJson(substituteToken, harnessName, trustedRouteNamespace),
  });
  emissions.push({
    path: join(CODEX_ROOT, "config.toml"),
    content: () => emitConfigToml(onboarding),
  });
  emissions.push({
    path: join(CODEX_ROOT, "rules", "default.rules"),
    content: () =>
      emitDefaultRules(harnessDir, invoke, trustedRouteNamespace),
  });
  emissions.push({
    path: join(CODEX_ROOT, "trust-seed.toml"),
    content: () =>
      emitTrustSeed(harnessDir, harnessName, invoke, trustedRouteNamespace),
  });
  emissions.push({
    path: join(CODEX_ROOT, "onboarding.md"),
    content: () => onboarding,
  });

  // agent TOMLs from core/agents/*.md (one per shipped persona)
  const agentsDir = join(coreRoot, "agents");
  for (const f of readdirSync(agentsDir).filter((x) => x.endsWith(".md")).sort()) {
    emissions.push({
      path: join(CODEX_ROOT, "agents", f.replace(/\.md$/, ".toml")),
      content: () => emitAgentToml(join(agentsDir, f)),
    });
  }

  // (a) authored orchestrator shell with the standard token projection.
  for (const f of ["SKILL.md", "question-rendering.md", "composer.md", "tables.md"]) {
    emissions.push({
      path: join(SKILLS_DST, "aidlc", f),
      content: () =>
        substituteToken(
          readFileSync(join(harnessRoot, "skills", "aidlc", f), "utf-8"),
        ),
    });
  }
  // (b) stage runners + init, generated, with the implicit-invocation guard
  for (const node of gen.runnableStages()) {
    const dir = join(SKILLS_DST, `aidlc-${node.slug}`);
    emissions.push({ path: join(dir, "SKILL.md"), content: () => rewriteProse(gen.renderStageRunner(node)) });
    emissions.push({ path: join(dir, "agents", "openai.yaml"), content: () => IMPLICIT_GUARD });
  }
  emissions.push({ path: join(SKILLS_DST, "aidlc-init", "SKILL.md"), content: () => rewriteProse(gen.renderInitRunner()) });
  emissions.push({ path: join(SKILLS_DST, "aidlc-init", "agents", "openai.yaml"), content: () => IMPLICIT_GUARD });
  emissions.push({ path: join(SKILLS_DST, "aidlc-compose", "SKILL.md"), content: () => rewriteProse(gen.renderComposeRunner()) });
  emissions.push({ path: join(SKILLS_DST, "aidlc-compose", "agents", "openai.yaml"), content: () => IMPLICIT_GUARD });
  // (c) Default-batch scope runners
  const scopes = gen.discoverScopes();
  for (const scope of gen.defaultScopeBatch(scopes).filter((s) => s in scopes)) {
    const dir = join(SKILLS_DST, `aidlc-${scope}`);
    emissions.push({ path: join(dir, "SKILL.md"), content: () => rewriteProse(gen.renderRunner(scope, scopes[scope].description)) });
    emissions.push({ path: join(dir, "agents", "openai.yaml"), content: () => IMPLICIT_GUARD });
  }
  // (d) standalone core skills — byte-copy + prose rewrite from core/skills/.
  // Codex alone does NOT enumerate core/skills/, so this list is the only thing
  // that ships them here: a skill missing from it silently reaches every OTHER
  // harness and not this one.
  // A Codex user invokes a skill with `$`, so the slash commands these skills
  // name (`/aidlc`, `/aidlc-replay`) are written the Codex way; a path such as
  // `<record>/aidlc-state.md` or `.codex/tools/aidlc.ts` is left as it is.
  const codexInvocations = (s: string): string =>
    s.replace(/(^|[\s(`"])\/(aidlc(?:-[a-z][a-z0-9-]*)?)(?![a-z0-9-]*\.[a-z])/gm, "$1$$$2");
  for (const skill of ["aidlc-session-cost", "aidlc-replay", "aidlc-outcomes-pack", "aidlc-knowledge"]) {
    const srcDir = join(coreRoot, "skills", skill);
    if (!existsSync(srcDir)) continue;
    for (const file of walk(srcDir)) {
      const rel = relative(srcDir, file);
      emissions.push({
        path: join(SKILLS_DST, skill, rel),
        content: () => {
          const prose = rewriteProse(readFileSync(file, "utf-8"));
          return rel.endsWith(".md") ? codexInvocations(prose) : prose;
        },
      });
    }
    emissions.push({ path: join(SKILLS_DST, skill, "agents", "openai.yaml"), content: () => IMPLICIT_GUARD });
  }

  // Clean-sweep the emitted skills tree so a removed runner doesn't linger.
  // In --check mode distRoot is temporary; the packager compares its complete
  // inventory with the independently generated counterpart after emit returns.
  rmSync(SKILLS_DST, { recursive: true, force: true });
  for (const { path, content } of emissions) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content(), "utf-8");
  }
}
