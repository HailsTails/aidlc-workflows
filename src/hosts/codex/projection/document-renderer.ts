import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { HostDocumentRenderer } from "../../../projection/application/ports/documents.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import type { NeutralDocument } from "../../../projection/domain/neutral-surface.ts";
import { keepOwnHarnessBindings } from "../../../projection/domain/harness-bindings.ts";
import { renderNeutralOnboarding, renderOnboarding } from "../../../projection/domain/onboarding.ts";
import { renameRulesFolder } from "../../../projection/domain/rules-folder.ts";
import { bindTemplateTokens } from "../../../projection/domain/token-binding.ts";
import type { TokenBindings, TemplateToken } from "../../../projection/domain/template-token.ts";
import { CODEX_BINDING_HEADING, CODEX_HOST_DATA } from "../host-data.ts";

const decode = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
const invocationTokens: readonly TemplateToken[] = ["HARNESS_DIR", "INVOKE", "TOOL_PREFIX", "TRUSTED_NAMESPACE"];
const documentTokens: readonly TemplateToken[] = [...invocationTokens, "OPTION_LETTERS"];
const bind = ({ text, tokens, selected }: {
  readonly text: string; readonly tokens: TokenBindings; readonly selected: readonly TemplateToken[];
}): string =>
  renameRulesFolder({ text: bindTemplateTokens({ text, tokens, selected }), harnessDir: ".codex",
    rulesFolder: CODEX_HOST_DATA.rulesFolder });
const onboardingFailure = (name: string, reason: string): Rendering =>
  refused({ kind: "render-failed", concept: "onboarding", name, reason });

const onboardingFile = (name: string, text: string): Rendering => {
  const path = projectPath(name);
  return path.ok ? accepted([{ path: path.value, content: { kind: "text", text },
    mode: "regular", availability: "always", origin: { kind: "rendered", concept: "onboarding", name } }])
    : onboardingFailure(name, "The onboarding destination must be project-relative.");
};

const placeDocument = (document: NeutralDocument, inputs: {
  readonly tokens: TokenBindings; readonly bindingHeadings: readonly string[];
}): Rendering => {
  const path = projectPath(`.codex/${document.source}`);
  if (!path.ok) return refused({ kind: "render-failed", concept: "neutral-document",
    name: document.source, reason: "The document destination must be project-relative." });
  const bound = bind({ text: decode(document.content), tokens: inputs.tokens, selected: documentTokens });
  const content = document.role === "protocol" ? keepOwnHarnessBindings({ content: bound,
    ownHeading: CODEX_BINDING_HEADING, expectedHeadings: inputs.bindingHeadings, file: document.source })
    : accepted(bound);
  return content.ok ? accepted([{ path: path.value, content: { kind: "text", text: content.value },
    mode: "regular", availability: "always", origin: { kind: "neutral", source: document.source } }])
    : refused({ kind: "render-failed", concept: "neutral-document", name: document.source, reason: content.refusal });
};

export const createCodexDocumentRenderer: HostDocumentRenderer = (inputs) => ({
  renderOnboarding: ({ templates }): Rendering => {
    const neutral = renderNeutralOnboarding(templates.neutral);
    if (!neutral.ok) return onboardingFailure("AGENTS.md", neutral.refusal);
    const rendered = renderOnboarding(templates.harnessSkeleton, inputs.fills);
    if (!rendered.ok) return onboardingFailure(".codex/onboarding.md", rendered.refusal);
    const onboarding = bind({ text: rendered.value, tokens: inputs.tokens, selected: invocationTokens })
      .replaceAll(".codex/skills/", ".agents/skills/");
    if (onboarding.includes("'''")) return onboardingFailure(".codex/config.toml",
      "Codex onboarding contains the TOML multiline literal delimiter (''').");
    const files = [
      onboardingFile("AGENTS.md", bind({ text: neutral.value, tokens: inputs.tokens, selected: invocationTokens })),
      onboardingFile(".codex/onboarding.md", onboarding),
      onboardingFile(".codex/config.toml", renderConfigToml(onboarding)),
    ];
    const failed = files.find((file) => !file.ok);
    return failed && !failed.ok ? failed : accepted(files.flatMap((file) => file.ok ? file.value : []));
  },
  placeNeutralDocument: ({ document }) => placeDocument(document, inputs),
});

const renderConfigToml = (onboarding: string): string => `# dist/codex shipped config — project-scoped; copy into .codex/config.toml
# of a trusted project. Do not merge this file into ~/.codex/config.toml:
# developer_instructions carries this project's AI-DLC onboarding.

# AI-DLC Codex onboarding, injected into every session (same content as .codex/onboarding.md).
developer_instructions = '''
${onboarding}'''

# Model/provider: intentionally omitted. The project inherits the provider,
# authentication, model, context window, and reasoning effort selected in the
# user's Codex configuration. Agent roles also inherit that model; balanced
# reviewers retain only their medium reasoning-effort cap.

# Tool output budget. Codex cuts a shell result at 10,000 tokens (about 40 KB)
# for the models in its catalog but at 10,000 BYTES for a model it does not
# know (custom providers, --oss). AIDLC prints a workflow instruction of up to
# 28 KiB as one shell result, so the budget is raised for every model.
tool_output_token_limit = 20000

# Sandbox: workspace-write keeps <workspace>/.git read-only BY DESIGN;
# interactive sessions escalate (deny -> approve -> retry unsandboxed) and the
# shipped rules/default.rules pre-allows git worktree/commit/add prefixes so
# escalations vanish. HEADLESS runs (CI, test drivers)
# cannot escalate: uncomment writable_roots with the MAIN repo's absolute
# .git path (linked worktrees resolve into <main>/.git/worktrees/*).
sandbox_mode = "workspace-write"

# Gates use Codex's structured question picker (request_user_input), which
# Codex still marks as under development; [features] below turns it on. Codex
# then warns at every start and points at ~/.codex/config.toml, so this turns
# that warning off. It also hides the warning for any other under-development
# feature while you work in this project. For numbered prose gates in one
# session, start Codex with -c features.default_mode_request_user_input=false.
suppress_unstable_features_warning = true

# The AIDLC method (the markdown rule layers: org/team/project + phases/) lives
# at the workspace root under aidlc/spaces/<space>/memory/, the single
# hand-editable source of truth, identical on every harness (NOT a per-harness
# copy under .codex/). Codex has no ambient include for it: the engine reads the
# active space's files and hands each step its rules. Codex also auto-merges
# the root AGENTS.md. (.codex/rules/ remains Codex's native Starlark
# permission-rules dir, D-10, distinct from the AIDLC method.)

[sandbox_workspace_write]
network_access = true
# writable_roots = ["/absolute/path/to/main-repo/.git"]

# Delegated roles are leaves. The conductor owns every spawn and agents cannot
# recursively delegate.
[agents]
max_depth = 1

# Gates (D-3 both-track): prose gates are the floor; these flags enable the
# structured request_user_input tool (verified working at 0.137.0+; the
# default-mode flag is still under development at 0.160.0, and its start-up
# warning is turned off above).
[tools]
experimental_request_user_input = { enabled = true }

[features]
default_mode_request_user_input = true

# Release 2.11.0 shipped AIDLC_RULES_DIR in this table, pointed at a space, and
# its own refresh of a copied project cannot take one member out of the table,
# so the member stays, empty: the engine reads an empty AIDLC_RULES_DIR as none.
# It can go when no supported project refreshes with a 2.11.0 tool.
[shell_environment_policy]
set = { AIDLC_RULES_DIR = "" }
`;
