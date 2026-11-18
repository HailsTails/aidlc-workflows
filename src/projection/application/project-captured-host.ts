import { refused } from "../../kernel/result.ts";
import { DEFAULT_WORKSPACE } from "../domain/workspace.ts";
import { bindOnboardingSource } from "../domain/onboarding-source.ts";
import { bindCwdDocuments } from "../domain/cwd-guidance.ts";
import { prepareOnboardingContext } from "../domain/onboarding-context.ts";
import { captureLegacyOnboardingDialect, captureLegacyNeutralDocument } from "../domain/legacy-native-source.ts";
import type { HarnessRenderers } from "./ports/harness-assembly.ts";
import type { CapturedHostProjectionPorts, HostProjectionMember, ProjectCapturedHost } from "./ports/captured-host.ts";

const renderersOf = ({ projection }: HostProjectionMember): HarnessRenderers => ({
  agents: projection.agents.render, skills: projection.skills.render, settings: projection.settings.render,
  documents: projection.documents.render, data: projection.renderData, record: projection.record, placements: projection.placements,
  commandPlacement: projection.commands, ...(projection.derive ? { derive: projection.derive } : {}) });

export const createProjectCapturedHost = (ports: CapturedHostProjectionPorts): ProjectCapturedHost => async (request) => {
  const members = ports.members.find((candidate) => candidate.host.distribution === request.host.distribution);
  if (!members) return refused([{ kind: "unknown-harness", harness: request.host.distribution }]);
  const missing = members.projection.placements.find((placement) => !request.files.some((file) => file.source === placement.source));
  if (missing) return refused([{ kind: "render-failed", concept: "host-data", name: missing.source,
    reason: "The declared authored host file was not captured." }]);
  const compiled = request.compile({ name: request.host.distribution, directory: request.host.directory,
    memoryRoot: DEFAULT_WORKSPACE.memory });
  if (!compiled.ok) return refused([compiled.refusal]);
  const captured = await ports.capture(request.core);
  if (!captured.ok) return captured;
  const channel = request.onboarding.channel;
  const bound = bindOnboardingSource(captured.value.surface.onboarding, channel);
  const onboarding = request.onboarding.channel === "copy" ? bound : { ...bound,
    nativeDialect: captureLegacyOnboardingDialect({ captured: captured.value.surface.onboarding,
      host: request.host, commands: ports.nativeCommands, permissions: request.onboarding.permissions.policy,
      replacements: request.nativeReplacements }) };
  const fillsContext = prepareOnboardingContext({ context: request.onboarding, skeleton: onboarding.harnessSkeleton });
  const documents = bindCwdDocuments({ captured: captured.value.surface.documents, channel });
  const context = onboarding.nativeDialect;
  const surface = { ...captured.value.surface, onboarding,
    documents: context === undefined ? documents
      : documents.map(document => captureLegacyNeutralDocument({ captured: document, context })) };
  const assembled = await ports.assemble({ method: request.core.method,
    sources: request.core.sources, host: request.host, renderers: renderersOf(members),
    files: request.files, prepare: request.prepare, tokens: request.tokens, channel,
    modelCap: request.modelCap, tierFlavor: members.projection.tierFlavor, entrypoints: request.entrypoints,
    fills: members.projection.fills(fillsContext),
    bindingHeadings: ports.members.map((member) => member.projection.bindingHeading), projectRoot: request.projectRoot,
    reviewerAgents: request.reviewerAgents, runtime: captured.value.runtime, compiled: compiled.value });
  if (!assembled.ok) return assembled;
  return ports.hosted({ host: request.host, harness: assembled.value }).project({
    harness: request.host.distribution, method: request.core.method, sources: request.core.sources,
    surface, runtime: captured.value.runtime, compiled: compiled.value,
    companions: captured.value.companions,
    hostFiles: request.files.filter((file) => members.projection.placements.some((placement) => placement.source === file.source)),
  });
};
