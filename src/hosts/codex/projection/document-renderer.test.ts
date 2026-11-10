import { expect, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { ONBOARDING_TEMPLATES_FIXTURE, documentRenderingInputsFixture,
  protocolDocumentFixture } from "../../../projection/fixtures/document-rendering.fixture.ts";
import { createCodexDocumentRenderer } from "./document-renderer.ts";
import { CODEX_BINDING_HEADING } from "../host-data.ts";

const bindingHeadings = ["Claude Code", "Kiro CLI", "Kiro IDE", "Codex CLI", "Cursor", "opencode", "GitHub Copilot"];
const inputs = { ...documentRenderingInputsFixture({ harnessDir: ".codex" }), bindingHeadings };
const renderer = createCodexDocumentRenderer(inputs);
const expectedConfig = "# dist/codex shipped config — project-scoped; copy into .codex/config.toml\n# of a trusted project. Do not merge this file into ~/.codex/config.toml:\n# developer_instructions carries this project's AI-DLC onboarding.\n\n# AI-DLC Codex onboarding, injected into every session (same content as .codex/onboarding.md).\ndeveloper_instructions = '''\n# AI-DLC for this host\n\nStart a piece of work with /aidlc.\nThe install lives in .codex; run bun .codex/tools/aidlc.ts doctor to check it.\n'''\n\n# Model/provider: intentionally omitted. The project inherits the provider,\n# authentication, model, context window, and reasoning effort selected in the\n# user's Codex configuration. Agent roles also inherit that model; balanced\n# reviewers retain only their medium reasoning-effort cap.\n\n# Tool output budget. Codex cuts a shell result at 10,000 tokens (about 40 KB)\n# for the models in its catalog but at 10,000 BYTES for a model it does not\n# know (custom providers, --oss). AIDLC prints a workflow instruction of up to\n# 28 KiB as one shell result, so the budget is raised for every model.\ntool_output_token_limit = 20000\n\n# Sandbox: workspace-write keeps <workspace>/.git read-only BY DESIGN;\n# interactive sessions escalate (deny -> approve -> retry unsandboxed) and the\n# shipped rules/default.rules pre-allows git worktree/commit/add prefixes so\n# escalations vanish. HEADLESS runs (CI, test drivers)\n# cannot escalate: uncomment writable_roots with the MAIN repo's absolute\n# .git path (linked worktrees resolve into <main>/.git/worktrees/*).\nsandbox_mode = \"workspace-write\"\n\n# Gates use Codex's structured question picker (request_user_input), which\n# Codex still marks as under development; [features] below turns it on. Codex\n# then warns at every start and points at ~/.codex/config.toml, so this turns\n# that warning off. It also hides the warning for any other under-development\n# feature while you work in this project. For numbered prose gates in one\n# session, start Codex with -c features.default_mode_request_user_input=false.\nsuppress_unstable_features_warning = true\n\n# The AIDLC method (the markdown rule layers: org/team/project + phases/) lives\n# at the workspace root under aidlc/spaces/<space>/memory/, the single\n# hand-editable source of truth, identical on every harness (NOT a per-harness\n# copy under .codex/). Codex has no ambient include for it: the engine reads the\n# active space's files and hands each step its rules. Codex also auto-merges\n# the root AGENTS.md. (.codex/rules/ remains Codex's native Starlark\n# permission-rules dir, D-10, distinct from the AIDLC method.)\n\n[sandbox_workspace_write]\nnetwork_access = true\n# writable_roots = [\"/absolute/path/to/main-repo/.git\"]\n\n# Delegated roles are leaves. The conductor owns every spawn and agents cannot\n# recursively delegate.\n[agents]\nmax_depth = 1\n\n# Gates (D-3 both-track): prose gates are the floor; these flags enable the\n# structured request_user_input tool (verified working at 0.137.0+; the\n# default-mode flag is still under development at 0.160.0, and its start-up\n# warning is turned off above).\n[tools]\nexperimental_request_user_input = { enabled = true }\n\n[features]\ndefault_mode_request_user_input = true\n\n# Release 2.11.0 shipped AIDLC_RULES_DIR in this table, pointed at a space, and\n# its own refresh of a copied project cannot take one member out of the table,\n# so the member stays, empty: the engine reads an empty AIDLC_RULES_DIR as none.\n# It can go when no supported project refreshes with a 2.11.0 tool.\n[shell_environment_policy]\nset = { AIDLC_RULES_DIR = \"\" }\n";

test("Codex owns the literal protocol binding heading", () => {
  expect(CODEX_BINDING_HEADING).toBe("Codex CLI");
});

test("split onboarding and config retain exact neutral, native and embedded bytes", () => {
  expect(renderer.renderOnboarding({ templates: ONBOARDING_TEMPLATES_FIXTURE, method: methodSliceFixture }))
    .toEqual({ ok: true, value: [
      { path: path("AGENTS.md"), mode: "regular", availability: "always",
        origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" },
        content: { kind: "text", text: "# AI-DLC in this project\n\nYour work is recorded under aidlc/.\n" } },
      { path: path(".codex/onboarding.md"), mode: "regular", availability: "always",
        origin: { kind: "rendered", concept: "onboarding", name: ".codex/onboarding.md" },
        content: { kind: "text", text: "# AI-DLC for this host\n\nStart a piece of work with /aidlc.\n" +
          "The install lives in .codex; run bun .codex/tools/aidlc.ts doctor to check it.\n" } },
      { path: path(".codex/config.toml"), mode: "regular", availability: "always",
        origin: { kind: "rendered", concept: "onboarding", name: ".codex/config.toml" },
        content: { kind: "text", text: expectedConfig } },
    ] });
});

test("protocol placement binds tokens, renames rules, and keeps only the Codex subsection", () => {
  const document = protocolDocumentFixture();
  expect(renderer.placeNeutralDocument({ document })).toEqual({ ok: true, value: [{
    path: path(".codex/aidlc-common/protocols/stage-protocol.md"), mode: "regular", availability: "always",
    origin: { kind: "neutral", source: document.source }, content: { kind: "text", text:
      "# Stage protocol\n\nRead the standing rules in .codex/aidlc-rules/ before a stage starts.\n\n" +
      "## Harness bindings\n\n#### Codex CLI\n\nCodex CLI runs the stage in the session.\n\n" },
  }] });
});

test("copied document tokens keep the native default.rules exception", () => {
  expect(renderer.placeNeutralDocument({ document: { source: source("knowledge/example.md"), role: "knowledge",
    content: { kind: "text", text: "{{HARNESS_DIR}}/rules/default.rules {{HARNESS_DIR}}/rules/team.md {{OPTION_LETTERS}}" },
  } })).toEqual({ ok: true, value: [{ path: path(".codex/knowledge/example.md"), mode: "regular", availability: "always",
    origin: { kind: "neutral", source: source("knowledge/example.md") }, content: { kind: "text",
      text: ".codex/rules/default.rules .codex/aidlc-rules/team.md A-E" },
  }] });
});

test("onboarding rewrites native skill paths and preserves its no-option-letters transform", () => {
  const rendered = accept(renderer.renderOnboarding({ method: methodSliceFixture, templates: {
    neutral: "Neutral\n", harnessSkeleton: "{{HARNESS_DIR}}/skills/aidlc {{OPTION_LETTERS}}\n",
  } }));
  expect(rendered[1]).toEqual({ path: path(".codex/onboarding.md"), mode: "regular", availability: "always",
    origin: { kind: "rendered", concept: "onboarding", name: ".codex/onboarding.md" },
    content: { kind: "text", text: ".agents/skills/aidlc {{OPTION_LETTERS}}\n" } });
  expect(rendered[2]?.content).toMatchObject({ text: expect.stringContaining(".agents/skills/aidlc {{OPTION_LETTERS}}\n'''") });
});

test("the config delimiter refuses the whole onboarding member", () => {
  expect(renderer.renderOnboarding({ method: methodSliceFixture, templates: {
    neutral: "Neutral\n", harnessSkeleton: "This contains ''' delimiter\n",
  } })).toEqual({ ok: false, refusal: { kind: "render-failed", concept: "onboarding", name: ".codex/config.toml",
    reason: "Codex onboarding contains the TOML multiline literal delimiter (''')." } });
});

test("invalid neutral onboarding keeps its typed destination refusal", () => {
  expect(renderer.renderOnboarding({ templates: { ...ONBOARDING_TEMPLATES_FIXTURE, neutral: "{{UNKNOWN}}" },
    method: methodSliceFixture })).toEqual({ ok: false, refusal: { kind: "render-failed", concept: "onboarding",
    name: "AGENTS.md", reason: "neutral onboarding must not contain template markers" } });
});

test("protocol refusal preserves the exact source and missing binding list", () => {
  expect(renderer.placeNeutralDocument({ document: { source: source("aidlc-common/protocols/bad.md"), role: "protocol",
    content: { kind: "text", text: "### Codex CLI\nOnly\n" },
  } })).toEqual({ ok: false, refusal: { kind: "render-failed", concept: "neutral-document",
    name: "aidlc-common/protocols/bad.md", reason: "harness bindings: aidlc-common/protocols/bad.md line 1: a binding run must name each tool once " +
      "(found Codex CLI; missing Claude Code, Kiro CLI, Kiro IDE, Cursor, opencode, GitHub Copilot)." } });
});
