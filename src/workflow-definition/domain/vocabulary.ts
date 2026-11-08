export const PHASES = [
  "initialization",
  "ideation",
  "inception",
  "construction",
  "operation",
] as const;

export type Phase = (typeof PHASES)[number];

export const UNIT_KINDS = ["service", "spec", "ui", "packaging", "library"] as const;

export type UnitKind = (typeof UNIT_KINDS)[number];

export const TIERS = ["judgment", "balanced", "templated"] as const;

export type Tier = (typeof TIERS)[number];

export const REVIEW_CLASSES = ["none", "advisory", "adversarial"] as const;

export type ReviewClass = (typeof REVIEW_CLASSES)[number];

export const GUARD_POLICIES = ["strict", "relaxed", "off"] as const;

export type GuardPolicy = (typeof GUARD_POLICIES)[number];

export const CEREMONY_KEYS = [
  "sensors",
  "learnings",
  "summary_confirmation",
  "plan_approval",
  "collaborators",
] as const;

export type CeremonyKey = (typeof CEREMONY_KEYS)[number];

export type CeremonySwitch = "on" | "off";

export type CeremonyDefaults = Readonly<Partial<Record<CeremonyKey, CeremonySwitch>>>;

export const DEPTHS = ["minimal", "standard", "comprehensive"] as const;

export type Depth = (typeof DEPTHS)[number];

export const PROJECT_TYPES = ["brownfield", "greenfield"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const COLLABORATION_MODES = ["inline", "subagent", "pipeline", "mob", "agent-team"] as const;

export type CollaborationMode = (typeof COLLABORATION_MODES)[number];

export type EnsembleMode = Extract<CollaborationMode, "pipeline" | "mob">;

export type SoloCapableMode = Exclude<CollaborationMode, EnsembleMode>;
