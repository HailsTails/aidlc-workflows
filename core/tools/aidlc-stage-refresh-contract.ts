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


export type StageRefreshEffect = "gate-sensor-coverage" | "plan-approval-questions" | "framing-decision-record";
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

type AcceptedProseField = "condition" | "outputs";
type AcceptedProsePlugin = "rin";
type AcceptedProseRewrite = { readonly installed: string; readonly candidate: string };
type NonEmptyAcceptedFields = {
  readonly [Field in AcceptedProseField]: Readonly<Record<Field, AcceptedProseRewrite>> &
    Readonly<Partial<Record<Exclude<AcceptedProseField, Field>, AcceptedProseRewrite>>>;
}[AcceptedProseField];
type AcceptedProseChange = {
  readonly plugin?: AcceptedProsePlugin;
  readonly slug: string;
  readonly fields: NonEmptyAcceptedFields;
  readonly effect: StageRefreshEffect;
};
type FieldRewrite = { readonly field: AcceptedProseField; readonly rewrite: AcceptedProseRewrite };

const acceptedProseFields = ["condition", "outputs"] as const satisfies readonly AcceptedProseField[];

const acceptedProseChanges = [
  {
    slug: "code-generation",
    fields: {
      outputs: {
        installed: "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved)",
        candidate: "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved; the engine writes code-generation-questions.md)",
      },
    },
    effect: "plan-approval-questions",
  },
  {
    plugin: "rin",
    slug: "rin-gate-1-framing",
    fields: {
      condition: {
        installed: "Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, gets the answers, and writes back confirmed scope directly into the AIDLC requirements artefact. The lead frames; the architect and developer seats contribute work against the framing. Prose only; no solution is chosen here (Gate 2).",
        candidate: "Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, settles them with its seats, and writes back confirmed scope directly into the AIDLC requirements artefact. The lead frames; the architect and developer seats contribute work against the framing. Prose only; no solution is chosen here (Gate 2).",
      },
      outputs: {
        installed: "rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions with the human's answers), under this stage's record dir, engine-resolved",
        candidate: "rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions, each with the gate's answer and its source, or its stopping class and pack), under this stage's record dir, engine-resolved",
      },
    },
    effect: "framing-decision-record",
  },
] as const satisfies readonly AcceptedProseChange[];

const fieldRewrites = (args: { readonly change: AcceptedProseChange }): readonly FieldRewrite[] =>
  acceptedProseFields.flatMap((field) => {
    const rewrite = args.change.fields[field];
    return rewrite === undefined ? [] : [{ field, rewrite }];
  });

type ProseChangeMatch = {
  readonly change: AcceptedProseChange;
  readonly installed: Readonly<Record<string, unknown>>;
  readonly candidate: Readonly<Record<string, unknown>>;
};

const sharesPlugin = (args: ProseChangeMatch): boolean =>
  args.change.plugin === undefined ||
  (args.installed.plugin === args.change.plugin && args.candidate.plugin === args.change.plugin);

const acceptsProseChange = (args: ProseChangeMatch): boolean =>
  args.installed.slug === args.change.slug && args.candidate.slug === args.change.slug &&
  sharesPlugin(args) &&
  fieldRewrites({ change: args.change }).every(({ field, rewrite }) =>
    args.installed[field] === rewrite.installed && args.candidate[field] === rewrite.candidate);

const restoredInstalledProse = (args: { readonly changes: readonly AcceptedProseChange[] }): Readonly<Record<string, string>> =>
  Object.fromEntries(args.changes.flatMap((change) =>
    fieldRewrites({ change }).map(({ field, rewrite }) => [field, rewrite.installed])));

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
  const accepted: readonly AcceptedProseChange[] = acceptedProseChanges.filter((change) =>
    acceptsProseChange({ change, installed: before.value, candidate: after.value }));
  return {
    kind: "comparable",
    installed: before.value,
    candidate: { ...after.value, sensors_applicable: sensors, ...restoredInstalledProse({ changes: accepted }) },
    revalidation: [
      ...(coverageChanges.some(Boolean) ? ["gate-sensor-coverage" as const] : []),
      ...accepted.map((change) => change.effect),
    ],
  };
};
