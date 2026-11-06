import { stageRefreshComparison, type StageRefreshComparisonPort, type StageRefreshEffect } from "../../../core/tools/aidlc-stage-refresh-contract.ts";
import { rewriteAcceptedStageChanges, type AcceptedStageRefreshChange } from "../../../core/tools/aidlc-stage-refresh-rewrites.ts";

export type RinStageRefreshEffect = StageRefreshEffect | "framing-decision-record" | "rin-gate-seats";

const askedFramingCondition = "Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, gets the answers, and writes back confirmed scope directly into the AIDLC requirements artefact. The lead frames; the architect and developer seats contribute work against the framing. Prose only; no solution is chosen here (Gate 2).";
const askedFramingOutputs = "rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions with the human's answers), under this stage's record dir, engine-resolved";

const acceptedChanges = [
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
] as const satisfies readonly AcceptedStageRefreshChange<RinStageRefreshEffect>[];

export const rinStageRefreshComparison: StageRefreshComparisonPort<RinStageRefreshEffect> = (args) => {
  const compared = stageRefreshComparison(args);
  if (compared.kind === "invalid") return compared;
  const accepted = rewriteAcceptedStageChanges({ installed: compared.installed, candidate: compared.candidate, changes: acceptedChanges });
  return { ...compared, candidate: accepted.candidate, revalidation: [...compared.revalidation, ...accepted.effects] };
};
