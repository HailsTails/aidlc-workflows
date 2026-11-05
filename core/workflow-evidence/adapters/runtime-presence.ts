import { assessPresenceHistory, type PresenceEvidence, type PresenceHistory } from "../presence/presence-evidence.ts";

export type RuntimePresenceEvent = {
  readonly ts: string;
  readonly shard: number | string;
  readonly pos: number;
  readonly human: true | false;
};

export type RuntimePresenceInput = {
  readonly tracking: "active" | "inactive";
  readonly events: readonly RuntimePresenceEvent[];
};

export type PresenceAssessment = {
  readonly assess: (request: { readonly history: PresenceHistory }) => PresenceEvidence;
};

export type RuntimePresence = {
  readonly kind: "acted" | "consumed" | "none";
  readonly evidence: PresenceEvidence;
};

export type RuntimePresenceAdapter = {
  readonly inspect: (request: RuntimePresenceInput) => RuntimePresence;
};

const runtimeState = ({ evidence }: { readonly evidence: PresenceEvidence }): RuntimePresence => {
  switch (evidence.kind) {
    case "fresh":
    case "untracked":
      return { kind: "acted", evidence };
    case "consumed":
    case "unordered":
      return { kind: "consumed", evidence };
    case "missing":
    case "unavailable":
      return { kind: "none", evidence };
  }
};

const domainHistory = ({ tracking, events }: RuntimePresenceInput): PresenceHistory => ({
  kind: "observed",
  tracking,
  events: events.map((event) => ({
    kind: event.human ? "human-turn" : "resolution",
    timestamp: event.ts,
    shard: String(event.shard),
    position: event.pos,
  })),
});

export const createRuntimePresenceAdapter = ({ assessment }: { readonly assessment: PresenceAssessment }): RuntimePresenceAdapter => ({
  inspect: (request) => runtimeState({ evidence: assessment.assess({ history: domainHistory(request) }) }),
});

export const defaultRuntimePresenceAdapter = (): RuntimePresenceAdapter => createRuntimePresenceAdapter({ assessment: { assess: assessPresenceHistory } });
