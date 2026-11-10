import { renderMethodSettings } from "./project-method-settings.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { METHOD_SOURCE_FOLDERS } from "../../workflow-definition/domain/method-source.ts";
import type { HarnessRegistry, Rendering } from "./ports/harness.ts";
import type { ProjectMethodForHarness } from "./use-cases.ts";
import { collectCommandRenderings } from "./command-renderers.ts";
import { renderMethodAgents } from "./project-method-agents.ts";
import { renderStageAndScopeCommands } from "./project-method-commands.ts";
import { projectRuntime } from "./project-runtime.ts";
import { projectWorkspace } from "./project-workspace.ts";

export const createProjectMethodForHarness = (registry: HarnessRegistry): ProjectMethodForHarness => ({
  project: (request) => {
    const selected = registry.find(request.harness);
    if (!selected.ok) return refused([selected.refusal]);
    const { host, harness } = selected.value;
    const tokens = { ...harness.tokens, ["HARNESS_DIR"]: host.directory };
    const rendered: readonly Rendering[] = [
      ...renderMethodAgents({ method: request.method, harness }),
      ...renderStageAndScopeCommands({ method: request.method, harness }),
      ...request.surface.skills.map((skill) => harness.renderSessionSkill({ skill })),
      harness.renderOrchestratorSkill({ method: request.method }),
      ...renderMethodSettings({ method: request.method, harness }),
      harness.renderOnboarding({ templates: request.surface.onboarding, method: request.method }),
      harness.renderHostData(),
      ...request.surface.documents.map((document) => harness.placeNeutralDocument({ document })),
      ...request.hostFiles.map((file) => harness.placeAuthoredFile({ file })),
      projectWorkspace({ host, tokens, companions: request.companions,
        rules: request.sources.filter((source) => source.path.startsWith(`${METHOD_SOURCE_FOLDERS.rule}/`)) }),
      projectRuntime({ host, runtime: request.runtime, tokens, compiled: request.compiled }),
    ];
    const failures = rendered.flatMap((rendering) => rendering.ok ? [] : [rendering.refusal]);
    if (failures.length > 0) return refused(failures);
    const collected = collectCommandRenderings(rendered);
    return collected.ok ? accepted({ host, files: collected.value, findings: [] }) : refused([collected.refusal]);
  },
});
