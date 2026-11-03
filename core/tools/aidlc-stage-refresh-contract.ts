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


export type StageRefreshEffect = "gate-sensor-coverage" | "plan-approval-questions" | "framing-decision-record" | "rin-gate-seats";
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

type AcceptedFieldValues = {
  readonly condition: string;
  readonly outputs: string;
  readonly lead_agent: string;
  readonly support_agents: readonly string[];
  readonly reviewer: string;
  readonly produces: readonly string[];
};
type AcceptedField = keyof AcceptedFieldValues;
type AcceptedFieldValue = AcceptedFieldValues[AcceptedField];
type AcceptedPlugin = "rin";
type AcceptedRewrite<Field extends AcceptedField> = {
  readonly installed: AcceptedFieldValues[Field];
  readonly candidate: AcceptedFieldValues[Field];
};
type AcceptedRewrites = { readonly [Field in AcceptedField]?: AcceptedRewrite<Field> };
type NonEmptyAcceptedFields = {
  readonly [Field in AcceptedField]: Readonly<Record<Field, AcceptedRewrite<Field>>> & AcceptedRewrites;
}[AcceptedField];
type AcceptedChange = {
  readonly plugin?: AcceptedPlugin;
  readonly slug: string;
  readonly fields: NonEmptyAcceptedFields;
  readonly effects: readonly [StageRefreshEffect, ...StageRefreshEffect[]];
};
type FieldRewrite = { readonly field: AcceptedField; readonly rewrite: AcceptedRewrite<AcceptedField> };

const acceptedFields = [
  "condition", "outputs", "lead_agent", "support_agents", "reviewer", "produces",
] as const satisfies readonly AcceptedField[];

const askedFramingCondition = "Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, gets the answers, and writes back confirmed scope directly into the AIDLC requirements artefact. The lead frames; the architect and developer seats contribute work against the framing. Prose only; no solution is chosen here (Gate 2).";
const askedFramingOutputs = "rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions with the human's answers), under this stage's record dir, engine-resolved";

const acceptedChanges = [
  {
    slug: "code-generation",
    fields: {
      outputs: {
        installed: "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved)",
        candidate: "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved; the engine writes code-generation-questions.md)",
      },
    },
    effects: ["plan-approval-questions"],
  },
  {
    plugin: "rin",
    slug: "rin-gate-1-framing",
    fields: {
      condition: {
        installed: askedFramingCondition,
        candidate: "Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, settles them with its seats, and writes back confirmed scope directly into the AIDLC requirements artefact. The lead frames; the architect and developer seats contribute work against the framing. Prose only; no solution is chosen here (Gate 2).",
      },
      outputs: {
        installed: askedFramingOutputs,
        candidate: "rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions, each with the gate's answer and its source, or its stopping class and pack), under this stage's record dir, engine-resolved",
      },
    },
    effects: ["framing-decision-record"],
  },
  {
    plugin: "rin",
    slug: "rin-gate-0-reconcile",
    fields: {
      lead_agent: { installed: "aidlc-delivery-agent", candidate: "rin-delivery-agent" },
      support_agents: { installed: ["aidlc-product-agent"], candidate: ["rin-product-agent"] },
      reviewer: { installed: "aidlc-architecture-reviewer-agent", candidate: "rin-stage-reviewer-agent" },
    },
    effects: ["rin-gate-seats"],
  },
  {
    plugin: "rin",
    slug: "rin-gate-1-framing",
    fields: {
      condition: {
        installed: askedFramingCondition,
        candidate: "Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, settles them with its seats, and writes back confirmed scope directly into the AIDLC requirements artefact. The seats and the lead draft the framing together. Prose only; no solution is chosen here (Gate 2).",
      },
      outputs: {
        installed: askedFramingOutputs,
        candidate: "rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions, each with the gate's answer and its source, or its stopping class and pack, and the disposition of every seat objection), under this stage's record dir, engine-resolved",
      },
      lead_agent: { installed: "aidlc-product-agent", candidate: "rin-product-agent" },
      support_agents: {
        installed: ["aidlc-architect-agent", "aidlc-developer-agent"],
        candidate: ["rin-architect-agent", "rin-developer-agent", "rin-customer-seat-agent"],
      },
      reviewer: { installed: "aidlc-architecture-reviewer-agent", candidate: "rin-decorrelated-review-agent" },
    },
    effects: ["framing-decision-record", "rin-gate-seats"],
  },
  {
    plugin: "rin",
    slug: "rin-gate-2-plan-review",
    fields: {
      lead_agent: { installed: "aidlc-architect-agent", candidate: "rin-architect-agent" },
      support_agents: {
        installed: ["aidlc-developer-agent", "aidlc-quality-agent", "rin-challenger-agent"],
        candidate: ["rin-developer-agent", "rin-quality-agent", "rin-challenger-agent", "rin-customer-seat-agent"],
      },
      outputs: {
        installed: "rin-solution-options.md (the options ledger — decision points, candidates with their premises, the comparison, and the decision on each point) and rin-options-questions.md (the entry-read citation, what each seat was asked and answered, and the disposition of every seat objection), under this stage's record dir, engine-resolved",
        candidate: "rin-solution-options.md (the options ledger — decision points, candidates with their premises, the comparison, and the decision on each point) and rin-options-questions.md (the entry-read citation, the lead's leaning on each point, and the disposition of every seat objection), under this stage's record dir, engine-resolved",
      },
    },
    effects: ["rin-gate-seats"],
  },
  {
    plugin: "rin",
    slug: "rin-gate-3-interface-lock",
    fields: {
      lead_agent: { installed: "aidlc-architect-agent", candidate: "rin-architect-agent" },
      support_agents: {
        installed: ["aidlc-developer-agent", "aidlc-quality-agent"],
        candidate: ["rin-developer-agent", "rin-quality-agent", "rin-customer-seat-agent"],
      },
      produces: {
        installed: ["rin-components", "rin-interface-lock"],
        candidate: ["rin-components", "rin-interface-lock", "rin-design-questions"],
      },
      outputs: {
        installed: "rin-components.md (the domain model, components, units and their dependencies) and rin-interface-lock.md (the exact contracts, the External reality section, and the single Constitution Check), under this stage's record dir, engine-resolved. The gate is AIDLC-native (ordered walk + approval), proven by the engine's own `report --result approved` audit event; no `.gate-lock` marker file.",
        candidate: "rin-components.md (the domain model, components, units and their dependencies), rin-interface-lock.md (the exact contracts, the External reality section, and the single Constitution Check) and rin-design-questions.md (the gate's decision record: the calls it made in a decided class to specify a lock element, and the disposition of every seat objection), under this stage's record dir, engine-resolved. The gate is AIDLC-native (ordered walk + approval), proven by the engine's own `report --result approved` audit event; no `.gate-lock` marker file.",
      },
    },
    effects: ["rin-gate-seats"],
  },
  {
    plugin: "rin",
    slug: "rin-gate-4-implement",
    fields: { lead_agent: { installed: "aidlc-developer-agent", candidate: "rin-developer-agent" } },
    effects: ["rin-gate-seats"],
  },
  {
    plugin: "rin",
    slug: "rin-gate-5-review-cycle",
    fields: { lead_agent: { installed: "aidlc-developer-agent", candidate: "rin-developer-agent" } },
    effects: ["rin-gate-seats"],
  },
  {
    plugin: "rin",
    slug: "rin-gate-6-operate",
    fields: {
      lead_agent: { installed: "aidlc-operations-agent", candidate: "rin-operations-agent" },
      support_agents: {
        installed: ["aidlc-pipeline-deploy-agent", "aidlc-delivery-agent"],
        candidate: ["rin-pipeline-deploy-agent", "rin-delivery-agent"],
      },
      reviewer: { installed: "aidlc-architecture-reviewer-agent", candidate: "rin-stage-reviewer-agent" },
    },
    effects: ["rin-gate-seats"],
  },
] as const satisfies readonly AcceptedChange[];

const fieldRewrites = (args: { readonly change: AcceptedChange }): readonly FieldRewrite[] =>
  acceptedFields.flatMap((field) => {
    const rewrite = args.change.fields[field];
    return rewrite === undefined ? [] : [{ field, rewrite }];
  });

const sameValue = ({ actual, expected }: { readonly actual: unknown; readonly expected: AcceptedFieldValue }): boolean =>
  typeof expected === "string"
    ? actual === expected
    : Array.isArray(actual) && actual.length === expected.length &&
      expected.every((entry, index) => actual[index] === entry);

type ChangeMatch = {
  readonly change: AcceptedChange;
  readonly installed: Readonly<Record<string, unknown>>;
  readonly candidate: Readonly<Record<string, unknown>>;
};

const sharesPlugin = (args: ChangeMatch): boolean =>
  args.change.plugin === undefined ||
  (args.installed.plugin === args.change.plugin && args.candidate.plugin === args.change.plugin);

const acceptsChange = (args: ChangeMatch): boolean =>
  args.installed.slug === args.change.slug && args.candidate.slug === args.change.slug &&
  sharesPlugin(args) &&
  fieldRewrites({ change: args.change }).every(({ field, rewrite }) =>
    sameValue({ actual: args.installed[field], expected: rewrite.installed }) &&
    sameValue({ actual: args.candidate[field], expected: rewrite.candidate }));

const restoredInstalledFields = (args: { readonly changes: readonly AcceptedChange[] }): Readonly<Record<string, AcceptedFieldValue>> =>
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
  const accepted: readonly AcceptedChange[] = acceptedChanges.filter((change) =>
    acceptsChange({ change, installed: before.value, candidate: after.value }));
  return {
    kind: "comparable",
    installed: before.value,
    candidate: { ...after.value, sensors_applicable: sensors, ...restoredInstalledFields({ changes: accepted }) },
    revalidation: [
      ...(coverageChanges.some(Boolean) ? ["gate-sensor-coverage" as const] : []),
      ...accepted.flatMap((change) => change.effects),
    ],
  };
};
