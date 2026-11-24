// Thin composition fixture: only onboarding uses real host renderers. Other
// harness responsibilities are fixed empty ports; no I/O, process or release build.
import type { HostModule } from "../roots.ts";
import { accepted } from "../../kernel/result.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { DELEGATE_SHELL_FACTS } from "../../projection/fixtures/delegate-shell-facts.fixture.ts";
import { tokenBindingsFixture } from "../../projection/fixtures/token-bindings.fixture.ts";
import type { OnboardingFills, NeutralDocument } from "../../projection/domain/neutral-surface.ts";
import type { NativeCommandRoutes } from "../../projection/domain/native-command.ts";
import type { HookGuidanceSource, ToolsGuidanceSource } from "../../projection/domain/onboarding-source.ts";
import type { Harness, Rendering } from "../../projection/application/ports/harness.ts";
import type { FullHostCapture } from "../../projection/application/ports/build-sources.ts";
import { createProjectCapturedHost } from "../../projection/application/project-captured-host.ts";
import { createHostedMethodProjection } from "../../projection/core-root.ts";
import { admitOnboardingSource } from "../../projection/domain/onboarding-source.ts";
import { admitCwdDocuments, type CwdGuidanceSource } from "../../projection/domain/cwd-guidance.ts";
import { onboardingContext } from "../../projection/domain/onboarding-context.ts";
import { nativeLayoutFiles } from "../../packaging/application/native-layout.ts";
import { compiledLegacyNativeFile } from "../../projection/domain/legacy-native-source.ts";
import { channelTokens } from "../../packaging/domain/channel-tokens.ts";
import { codexHost } from "../../hosts/codex/host.ts";
import { claudeHost } from "../../hosts/claude/host.ts";
import { copilotHost } from "../../hosts/copilot/host.ts";
import { cursorHost } from "../../hosts/cursor/host.ts";
import { kiroHost } from "../../hosts/kiro/host.ts";
import { kiroIdeHost } from "../../hosts/kiro-ide/host.ts";
import { openCodeHost } from "../../hosts/opencode/host.ts";
import { kiroAgentRenderer } from "../../hosts/kiro/projection/agent-renderer.ts";
import { kiroNativePermissionsLine } from "../../hosts/kiro/distribution.ts";

export const PERMISSION_HOSTS = {
  claude: accept(claudeHost()),
  codex: accept(codexHost()), copilot: accept(copilotHost()), cursor: accept(cursorHost()), kiro: accept(kiroHost()),
  "kiro-ide": accept(kiroIdeHost({ personas: kiroAgentRenderer, permissionsLine: kiroNativePermissionsLine })),
  opencode: accept(openCodeHost()),
} satisfies Readonly<Record<string, HostModule>>;

const nothing = (): Rendering => accepted([]);
const emptyHarness: Harness = { tokens: tokenBindingsFixture({ harnessDir: ".fixture" }),
  renderAgent: nothing, renderConductorAgent: nothing, renderStageCommand: nothing, renderScopeCommand: nothing,
  renderOrchestratorSkill: nothing, renderSessionSkill: nothing, renderSettings: nothing,
  renderHookRegistrations: nothing, renderOnboarding: nothing, renderHostData: nothing,
  placeNeutralDocument: nothing, placeAuthoredFile: nothing, deriveFiles: nothing };

export const permissionProseFlow = async (input: {
  readonly host: keyof typeof PERMISSION_HOSTS; readonly channel: "copy" | "native";
  readonly ending: "\n" | "\r\n"; readonly prefix: string;
  readonly templates?: { readonly neutral: string; readonly harnessSkeleton: string;
    readonly hookGuidance?: HookGuidanceSource; readonly toolsGuidance?: ToolsGuidanceSource };
  readonly customFills?: OnboardingFills;
  readonly nativeCommands?: NativeCommandRoutes;
  readonly documents?: readonly NeutralDocument[];
  readonly cwdGuidance?: CwdGuidanceSource;
}) => {
  const original: HostModule = PERMISSION_HOSTS[input.host];
  const customFills = input.customFills;
  const module: HostModule = customFills === undefined ? original : { ...original,
    projection: { ...original.projection, fills: () => customFills } };
  const distribution = accept(module.distribution({ delegateShellFacts: DELEGATE_SHELL_FACTS }));
  const commands = input.nativeCommands ?? { prefix: input.prefix, namespace: "engine", delegates: [], adapterHooks: new Set<string>(),
    trusted: DELEGATE_SHELL_FACTS.trustedCommand, unresolvable: () => [] };
  const context = accept(onboardingContext({ channel: input.channel,
    permissions: distribution.native.permissions, prefix: commands.prefix }));
  const tokens = { ...module.projection.tokens, ["HARNESS_DIR"]: module.host.directory,
    ...channelTokens({ channel: input.channel, directory: module.host.directory,
      prefix: commands.prefix, namespace: commands.namespace }) };
  const capture: FullHostCapture = { surface: {
    documents: accept(admitCwdDocuments({ documents: input.documents ?? [],
      guidance: input.cwdGuidance ?? { kind: "legacy-authored" } })), skills: [],
    onboarding: accept(admitOnboardingSource({ hookGuidance: input.templates?.hookGuidance ?? "legacy-authored",
      toolsGuidance: input.templates?.toolsGuidance ?? "legacy-authored",
      neutral: input.templates?.neutral ?? "Neutral", harnessSkeleton: input.templates?.harnessSkeleton
        ?? `Before${input.ending}{{SLOT:prereq_bullets}}${input.ending}{{SLOT:prereq_bullets_tail}}${input.ending}After${input.ending}` })),
  }, runtime: { files: [], version: { kind: "text", text: 'export const AIDLC_VERSION = "fixture";' },
    agentTiers: { kind: "text", text: "{}" }, settingsSchema: { kind: "text", text: "{}" } }, companions: [] };
  const observed: { fills: OnboardingFills | null } = { fills: null };
  const members = Object.values(PERMISSION_HOSTS).map(candidate =>
    candidate.host.distribution === module.host.distribution ? module : candidate);
  const project = createProjectCapturedHost({ nativeCommands: commands, members, capture: async () => accepted(capture),
    assemble: async (request) => {
      observed.fills = request.fills;
      return accepted({ ...emptyHarness, tokens: request.tokens, ...request.renderers.documents({
        fills: request.fills, tokens: request.tokens, bindingHeadings: request.bindingHeadings,
      }) });
    }, hosted: createHostedMethodProjection,
  });
  const before = await project({ host: module.host, core: { method: methodSliceFixture, sources: [] },
    compile: () => accepted({ graph: "[]", grid: "{}" }),
    files: module.projection.placements.map(placement => ({ source: source(placement.source), content: { kind: "text", text: "Captured" } })),
    prepare: accepted, tokens, onboarding: context, nativeReplacements: [],
    modelCap: null, entrypoints: [], projectRoot: new URL("file:///project/"), reviewerAgents: new Set() });
  // Isolate the paragraph consumer's policy port. Unrelated mandatory release
  // replacements are qualified separately; this is not a full release fixture.
  const after = before.ok && input.channel === "native" ? nativeLayoutFiles({ files: before.value.files,
    host: module.host, release: { replacements: [], copyOnly: [], permissions: distribution.native.permissions },
    routes: commands,
  }) : before.ok ? accepted(before.value.files) : before;
  const sourceOwned = before.ok && input.channel === "native" ? accepted(before.value.files.map(file => {
    const compiled = compiledLegacyNativeFile(file);
    return compiled === undefined ? file : { ...file, content: compiled.content };
  })) : before.ok ? accepted(before.value.files) : before;
  return { context, policy: distribution.native.permissions, fills: observed.fills, before, after, sourceOwned };
};
