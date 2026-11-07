import type { GeneratedRunnerProjection, GeneratedRunner, GeneratedRunnerContext } from "../src/domain/generated-runner.ts";
import { collectNativeFiles } from "../src/domain/native-file-set.ts";
import { finding, pathStatus, type Outcome } from "../src/domain/model.ts";
import { residue } from "../src/domain/projection-content.ts";
import { emitGeneratedRunner } from "../src/adapters/generated-runner-emitter.ts";

import type { GeneratedRunnerSet, GeneratedRunnerProjectionRequest } from "../src/application/surface-projection.ts";
export type { GeneratedRunnerSet } from "../src/application/surface-projection.ts";
const collect = ({ projected }: { readonly projected: readonly Outcome<GeneratedRunnerProjection>[] }): Outcome<GeneratedRunnerSet> => {
  const findings = projected.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
  if (findings.length > 0) return { status: "invalid", findings };
  const runners = projected.flatMap((entry) => entry.status === "ok" ? [entry.value] : []);
  const collected = collectNativeFiles({ resources: runners.flatMap((entry) => entry.resources) });
  if (collected.status === "invalid") return collected;
  const invalid = collected.value.flatMap((resource) => [...(pathStatus({ path: resource.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: resource.path, detail: "generated runner resources require safe relative paths" })] : []), ...residue({ text: resource.body, subject: resource.path })]);
  if (invalid.length > 0) return { status: "invalid", findings: invalid };
  return { status: "ok", value: { runners, resources: collected.value } };
};
export const projectGeneratedRunners = ({ compiler, requests, context }: GeneratedRunnerProjectionRequest): Outcome<GeneratedRunnerSet> => {
  const compiled = compiler.compile({ requests });
  if (compiled.status === "invalid") return compiled;
  return projectGeneratedRunnerDefinitions({ runners: compiled.value, context });
};
export const projectGeneratedRunnerDefinitions = ({ runners, context }: { readonly runners: readonly GeneratedRunner[]; readonly context: GeneratedRunnerContext }): Outcome<GeneratedRunnerSet> => collect({ projected: runners.map((runner) => emitGeneratedRunner({ runner, context })) });
