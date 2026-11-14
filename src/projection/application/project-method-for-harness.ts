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
import type { ProjectedFile } from "../domain/projected-file.ts";

const placeDerived = (request: {
  readonly files: readonly ProjectedFile[];
  readonly derived: readonly ProjectedFile[];
}): readonly ProjectedFile[] => [
  ...request.files.map((file) => request.derived.find((candidate) => candidate.path === file.path) ?? file),
  ...request.derived.filter((candidate) => !request.files.some((file) => file.path === candidate.path)),
];

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
    if (!collected.ok) return refused([collected.refusal]);
    const derived = collectCommandRenderings([harness.deriveFiles({ files: collected.value })]);
    return derived.ok
      ? accepted({ host, files: placeDerived({ files: collected.value, derived: derived.value }), findings: [] })
      : refused([derived.refusal]);
  },
});
