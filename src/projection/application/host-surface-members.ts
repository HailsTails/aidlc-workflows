import type { HostIdentity } from "../../kernel/host.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { projectPath } from "../../kernel/values.ts";
import type { AuthoredHostFile, AuthoredPlacement, HostData } from "../domain/host-surface.ts";
import type { DistributionChannel } from "../domain/projected-file.ts";
import type { TokenBindings } from "../domain/template-token.ts";
import { bindTemplateTokens } from "../domain/token-binding.ts";
import type { AuthoredFilePreparer, Harness, Rendering } from "./ports.ts";
import { collectCommandRenderings } from "./command-renderers.ts";

const hookStrings = (hookValue: unknown, tokens: TokenBindings): unknown => {
  if (typeof hookValue === "string") return bindTemplateTokens({ text: hookValue, tokens,
    selected: ["INVOKE", "TOOL_PREFIX", "TRUSTED_NAMESPACE"] });
  if (Array.isArray(hookValue)) return hookValue.map((hookEntry: unknown) => hookStrings(hookEntry, tokens));
  if (typeof hookValue === "object" && hookValue !== null) return Object.fromEntries(
    Object.entries(hookValue).map(([hookProperty, hookEntry]) => [hookProperty, hookStrings(hookEntry, tokens)]),
  );
  return hookValue;
};

const descriptorText = (request: {
  readonly host: HostIdentity; readonly data: HostData; readonly tokens: TokenBindings;
}): string => {
  const { host, data: hostData, tokens } = request;
  return `${JSON.stringify({
    schemaVersion: 1, distribution: host.distribution, productName: hostData.productName,
    configNextStep: hostData.configNextStep, name: host.distribution, harnessDir: host.directory,
    rulesSubdir: hostData.rulesFolder ?? "rules",
    ...(hostData.runnerFrontmatterAdditions?.length
      ? { runnerFrontmatterAdditions: hostData.runnerFrontmatterAdditions } : {}),
    ...(hostData.documentExtractors ? { documentExtractors: hostData.documentExtractors } : {}),
    ...(hostData.hookActivation ? { hookActivation: hookStrings(hostData.hookActivation, tokens) } : {}),
    ...(hostData.newChatStep ? { newChatStep: hostData.newChatStep } : {}),
    ...(hostData.kiroLayout ? { kiroLayout: hostData.kiroLayout } : {}),
    ...(hostData.directiveMaxBytes ? { directiveMaxBytes: hostData.directiveMaxBytes } : {}),
    ...(hostData.statusLine ? { statusLine: hostData.statusLine } : {}),
    ...(hostData.agentFinishRecorded ? { agentFinishRecorded: hostData.agentFinishRecorded } : {}),
    ...(hostData.hostShell ? { hostShell: hostData.hostShell } : {}),
  }, null, 2)}\n`;
};

const hostDataFile = (request: { readonly host: HostIdentity; readonly within: string;
  readonly text: string }): Rendering => {
  const { host, within, text } = request;
  const path = projectPath(`${host.directory}/${within}`);
  return path.ok ? accepted([{ path: path.value, content: { kind: "text", text },
    mode: "regular", availability: "always",
    origin: { kind: "rendered", concept: "host-data", name: host.distribution } }])
    : refused({ kind: "render-failed", concept: "host-data", name: host.distribution,
      reason: "The host data destination must be project-relative." });
};

const placeFile = (request: {
  readonly file: AuthoredHostFile;
  readonly placements: readonly AuthoredPlacement[];
  readonly prepare: AuthoredFilePreparer;
}): Rendering => {
  const placement = request.placements.find((candidate) => candidate.source === request.file.source);
  if (!placement) return refused({ kind: "render-failed", concept: "host-data",
    name: request.file.source, reason: "The authored host file has no declared placement." });
  const path = projectPath(placement.destination);
  if (!path.ok) return refused({ kind: "render-failed", concept: "host-data",
    name: request.file.source, reason: "The authored destination must be project-relative." });
  const prepared = request.prepare(request.file);
  return prepared.ok ? accepted([{ path: path.value, content: prepared.value.content,
    mode: "regular", availability: "always",
    origin: { kind: "harness-authored", source: request.file.source } }]) : prepared;
};

export const createHostSurfaceMembers = (request: {
  readonly host: HostIdentity;
  readonly data: HostData;
  readonly placements: readonly AuthoredPlacement[];
  readonly tokens: TokenBindings;
  readonly channel: DistributionChannel;
  readonly prepare: AuthoredFilePreparer;
}): Pick<Harness, "renderHostData" | "placeAuthoredFile"> => ({
  renderHostData: () => {
    const frontmatter = request.data.pluginAgentFrontmatter?.[request.channel];
    return collectCommandRenderings([
      hostDataFile({ host: request.host, within: "tools/data/harness.json", text: descriptorText(request) }),
      frontmatter?.length ? hostDataFile({ host: request.host, within: "tools/data/plugin-agent.md",
        text: `---\n${frontmatter.join("\n")}\n---\n` }) : accepted([]),
    ]);
  },
  placeAuthoredFile: ({ file }) => placeFile({ file, placements: request.placements,
    prepare: request.prepare }),
});