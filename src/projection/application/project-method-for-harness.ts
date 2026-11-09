import { renderMethodSettings } from "./project-method-settings.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import { projectPath } from "../../kernel/values.ts";
import type { MethodSource } from "../../workflow-definition/domain/method-source.ts";
import { bindCopiedSource } from "../domain/source-binding.ts";
import type { TokenBindings } from "../domain/template-token.ts";
import type { HarnessRegistry, Rendering } from "./ports.ts";
import type { ProjectMethodForHarness } from "./use-cases.ts";
import { collectCommandRenderings } from "./command-renderers.ts";
import { renderMethodAgents } from "./project-method-agents.ts";
import { renderStageAndScopeCommands } from "./project-method-commands.ts";
import { projectRuntime } from "./project-runtime.ts";

const copiedMethodSource = (request: {
  readonly host: HostIdentity; readonly source: MethodSource; readonly tokens: TokenBindings;
}): Rendering => {
  const path = projectPath(`${request.host.directory}/${request.source.path}`);
  return path.ok ? accepted([{ path: path.value,
    content: bindCopiedSource({ source: request.source.path, content: request.source.content, tokens: request.tokens }),
    mode: "regular", availability: "always", origin: { kind: "method-source", path: request.source.path } }])
    : refused({ kind: "render-failed", concept: "host-data", name: request.source.path,
      reason: "The method source destination must be project-relative." });
};

export const createProjectMethodForHarness = (registry: HarnessRegistry): ProjectMethodForHarness => ({
  project: (request) => {
    const selected = registry.find(request.harness);
    if (!selected.ok) return refused([selected.refusal]);
    const { host, harness } = selected.value;
    const tokens = { ...harness.tokens, ["HARNESS_DIR"]: host.directory };
    const runtimeSources = new Set<string>(request.runtime.files.map((file) => file.source));
    const rendered: readonly Rendering[] = [
      ...renderMethodAgents({ method: request.method, harness }),
      ...renderStageAndScopeCommands({ method: request.method, harness }),
      ...request.surface.skills.map((skill) => harness.renderSessionSkill({ skill })),
      harness.renderOrchestratorSkill({ method: request.method }),
      ...renderMethodSettings({ method: request.method, harness }),
      harness.renderOnboarding({ templates: request.surface.onboarding, method: request.method }),
      harness.renderHostData(),
      ...request.sources.filter((source) => !runtimeSources.has(source.path))
        .map((source) => copiedMethodSource({ host, source, tokens })),
      ...request.surface.documents.map((document) => harness.placeNeutralDocument({ document: {
        ...document, content: bindCopiedSource({ ...document, tokens }),
      } })),
      ...request.hostFiles.map((file) => harness.placeAuthoredFile({ file })),
      projectRuntime({ host, runtime: request.runtime, tokens }),
    ];
    const failures = rendered.flatMap((rendering) => rendering.ok ? [] : [rendering.refusal]);
    if (failures.length > 0) return refused(failures);
    const collected = collectCommandRenderings(rendered);
    return collected.ok ? accepted({ host, files: collected.value, findings: [] }) : refused([collected.refusal]);
  },
});
