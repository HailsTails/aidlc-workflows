import { z } from "zod";

export type StageRefreshSensor = {
  readonly id: string;
  readonly path: string;
  readonly fire_on: "write" | "gate";
  readonly default_severity: "advisory" | "blocking";
  readonly category?: string;
  readonly matches?: string;
};

export type StageContract =
  | { readonly kind: "comparable"; readonly value: Readonly<Record<string, unknown>> & { readonly sensors: readonly string[]; readonly sensors_applicable: readonly StageRefreshSensor[] } }
  | { readonly kind: "invalid" };

type StageContractInput = { readonly stage: unknown };

const sensor = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  fire_on: z.enum(["write", "gate"]),
  default_severity: z.enum(["advisory", "blocking"]),
  category: z.string().optional(),
  matches: z.string().optional(),
}).strict();

const stageMetadata = z.object({
  sensors: z.array(z.string().min(1)).default([]),
  sensors_applicable: z.array(sensor).default([]),
}).passthrough().refine((stage) =>
  stage.sensors.length === stage.sensors_applicable.length &&
  new Set(stage.sensors).size === stage.sensors.length &&
  stage.sensors.every((id, index) => stage.sensors_applicable[index]?.id === id));

export const stageRefreshContract = ({ stage }: StageContractInput): StageContract => {
  const parsed = stageMetadata.safeParse(stage);
  if (!parsed.success) return { kind: "invalid" };
  const retained = parsed.data.sensors_applicable.filter((entry) =>
    entry.fire_on !== "write" || entry.default_severity !== "advisory");
  return {
    kind: "comparable",
    value: { ...parsed.data, sensors: retained.map((entry) => entry.id), sensors_applicable: retained },
  };
};


export type StageRefreshEffect = "gate-sensor-coverage" | "plan-approval-questions";
export type StageRefreshComparison =
  | {
      readonly kind: "comparable";
      readonly installed: Readonly<Record<string, unknown>>;
      readonly candidate: Readonly<Record<string, unknown>>;
      readonly revalidation: readonly StageRefreshEffect[];
    }
  | { readonly kind: "invalid" };
export type StageRefreshComparisonPort = (args: {
  readonly installed: unknown;
  readonly candidate: unknown;
}) => StageRefreshComparison;

const originalCodeGenerationOutputs = "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved)";
const engineCodeGenerationOutputs = "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved; the engine writes code-generation-questions.md)";

const literalDirectoryUnion = (args: { readonly matches: string | undefined }): readonly string[] | null => {
  const matches = args.matches;
  const parsed = matches?.match(/^\*\*\/(?:\{([a-zA-Z0-9._-]+(?:,[a-zA-Z0-9._-]+)+)\}|([a-zA-Z0-9._-]+))\/\*\*$/);
  if (!parsed) return null;
  const directories = (parsed[1] ?? parsed[2]).split(",");
  return directories.some((name) => name === "." || name === "..") ||
    new Set(directories).size !== directories.length ? null : directories;
};

const additiveSensorCoverage = (args: {
  readonly installed: StageRefreshSensor | undefined;
  readonly candidate: StageRefreshSensor;
}): boolean => {
  const before = literalDirectoryUnion({ matches: args.installed?.matches });
  const after = literalDirectoryUnion({ matches: args.candidate.matches });
  return args.installed?.id === args.candidate.id &&
    args.installed.fire_on === "gate" && args.candidate.fire_on === "gate" &&
    args.installed.default_severity === "advisory" && args.candidate.default_severity === "advisory" &&
    before !== null && after !== null && after.length > before.length &&
    before.every((directory) => after.includes(directory));
};

export const stageRefreshComparison: StageRefreshComparisonPort = (args) => {
  const before = stageRefreshContract({ stage: args.installed });
  const after = stageRefreshContract({ stage: args.candidate });
  if (before.kind === "invalid" || after.kind === "invalid") return { kind: "invalid" };
  const coverageChanges = after.value.sensors_applicable
    .map((entry, index) => additiveSensorCoverage({ installed: before.value.sensors_applicable[index], candidate: entry }));
  const sensors = after.value.sensors_applicable.map((entry, index) =>
    coverageChanges[index] ? { ...entry, matches: before.value.sensors_applicable[index].matches } : entry);
  const questionsWriter =
    before.value.slug === "code-generation" && after.value.slug === "code-generation" &&
    before.value.outputs === originalCodeGenerationOutputs && after.value.outputs === engineCodeGenerationOutputs;
  return {
    kind: "comparable",
    installed: before.value,
    candidate: { ...after.value, sensors_applicable: sensors,
      ...(questionsWriter ? { outputs: originalCodeGenerationOutputs } : {}) },
    revalidation: [
      ...(coverageChanges.some(Boolean) ? ["gate-sensor-coverage" as const] : []),
      ...(questionsWriter ? ["plan-approval-questions" as const] : []),
    ],
  };
};
