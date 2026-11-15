// Thin composition fixture: only onboarding uses real host renderers. Other
// harness responsibilities are fixed empty ports; no I/O, process or release build.
import type { HostModule } from "../roots.ts";
import { accepted } from "../../kernel/result.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { DELEGATE_SHELL_FACTS } from "../../projection/fixtures/delegate-shell-facts.fixture.ts";
import { tokenBindingsFixture } from "../../projection/fixtures/token-bindings.fixture.ts";
import type { OnboardingFills } from "../../projection/domain/neutral-surface.ts";
import type { Harness, Rendering } from "../../projection/application/ports/harness.ts";
import type { FullHostCapture } from "../../projection/application/ports/build-sources.ts";
import { createProjectCapturedHost } from "../../projection/application/project-captured-host.ts";
import { createHostedMethodProjection } from "../../projection/core-root.ts";
import { admitOnboardingSource } from "../../projection/domain/onboarding-source.ts";
import { admitCwdDocuments } from "../../projection/domain/cwd-guidance.ts";
import { onboardingContext } from "../../projection/domain/onboarding-context.ts";
import { nativeLayoutFiles } from "../../packaging/application/native-layout.ts";
import { nativeOnboardingText } from "../../packaging/domain/native-onboarding.ts";
import { codexHost } from "../../hosts/codex/host.ts";
import { cursorHost } from "../../hosts/cursor/host.ts";
import { kiroHost } from "../../hosts/kiro/host.ts";
import { kiroIdeHost } from "../../hosts/kiro-ide/host.ts";
import { openCodeHost } from "../../hosts/opencode/host.ts";
import { kiroAgentRenderer } from "../../hosts/kiro/projection/agent-renderer.ts";

export const PERMISSION_HOSTS = {
  codex: accept(codexHost()), cursor: accept(cursorHost()), kiro: accept(kiroHost()),
  "kiro-ide": accept(kiroIdeHost(kiroAgentRenderer)), opencode: accept(openCodeHost()),
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
  readonly templates?: { readonly neutral: string; readonly harnessSkeleton: string };
  readonly customFills?: OnboardingFills;
}) => {
  const original: HostModule = PERMISSION_HOSTS[input.host];
  const customFills = input.customFills;
  const module: HostModule = customFills === undefined ? original : { ...original,
    projection: { ...original.projection, fills: () => customFills } };
  const distribution = accept(module.distribution({ delegateShellFacts: DELEGATE_SHELL_FACTS }));
  const context = accept(onboardingContext({ channel: input.channel,
    permissionsLine: distribution.native.permissionsLine, prefix: input.prefix }));
  const capture: FullHostCapture = { surface: {
    documents: accept(admitCwdDocuments({ documents: [], guidance: { kind: "legacy-authored" } })), skills: [],
    onboarding: accept(admitOnboardingSource({ hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored",
      neutral: input.templates?.neutral ?? "Neutral", harnessSkeleton: input.templates?.harnessSkeleton
        ?? `Before${input.ending}{{SLOT:prereq_bullets}}${input.ending}{{SLOT:prereq_bullets_tail}}${input.ending}After${input.ending}` })),
  }, runtime: { files: [], version: { kind: "text", text: "Version" }, agentTiers: { kind: "text", text: "Tiers" },
    settingsSchema: { kind: "text", text: "Schema" } }, companions: [] };
  const observed: { fills: OnboardingFills | null } = { fills: null };
  const project = createProjectCapturedHost({ members: [module], capture: async () => accepted(capture),
    assemble: async (request) => {
      observed.fills = request.fills;
      return accepted({ ...emptyHarness, tokens: request.tokens, ...request.renderers.documents({
        fills: request.fills, tokens: request.tokens, bindingHeadings: request.bindingHeadings,
      }) });
    }, hosted: createHostedMethodProjection,
  });
  const before = await project({ host: module.host, core: { method: methodSliceFixture, sources: [] },
    compile: () => accepted({ graph: "graph", grid: "grid" }),
    files: module.projection.placements.map(placement => ({ source: source(placement.source), content: { kind: "text", text: "Captured" } })),
    prepare: accepted, tokens: tokenBindingsFixture({ harnessDir: module.host.directory }), onboarding: context,
    modelCap: null, entrypoints: [], projectRoot: new URL("file:///project/"), reviewerAgents: new Set() });
  // Isolate the paragraph consumer's policy port. Unrelated mandatory release
  // replacements are qualified separately; this is not a full release fixture.
  const after = before.ok && input.channel === "native" ? nativeLayoutFiles({ files: before.value.files,
    host: module.host, release: { replacements: [], copyOnly: [], permissionsLine: distribution.native.permissionsLine },
    routes: { prefix: input.prefix, namespace: "engine", delegates: [], adapterHooks: new Set(),
      trusted: DELEGATE_SHELL_FACTS.trustedCommand, unresolvable: () => [] },
  }) : before.ok ? accepted(before.value.files) : before;
  const onboardingOnly = before.ok && input.channel === "native" ? accepted(before.value.files.map(file => ({ ...file,
    content: { kind: "text" as const, text: nativeOnboardingText({ text: file.content.kind === "text"
      ? file.content.text : new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.content.bytes),
    permissionsLine: distribution.native.permissionsLine, prefix: input.prefix }) },
  }))) : before.ok ? accepted(before.value.files) : before;
  return { context, policy: distribution.native.permissionsLine, fills: observed.fills, before, after, onboardingOnly };
};
