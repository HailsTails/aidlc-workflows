export type LedgerPosition = {
  readonly timestamp: string;
  readonly shard: string;
  readonly position: number;
};

export type PresenceEvent = LedgerPosition & {
  readonly kind: "human-turn" | "resolution";
};

export type PresenceHistory =
  | { readonly kind: "unavailable"; readonly reason: "unreadable-shard" | "unreadable-location" }
  | {
      readonly kind: "observed";
      readonly tracking: "inactive" | "active";
      readonly events: readonly PresenceEvent[];
    };

export type PresenceEvidence =
  | { readonly kind: "unavailable"; readonly reason: "unreadable-shard" | "unreadable-location" }
  | { readonly kind: "untracked" }
  | { readonly kind: "missing" }
  | { readonly kind: "fresh"; readonly witness: LedgerPosition }
  | { readonly kind: "consumed"; readonly boundaries: readonly LedgerPosition[] }
  | {
      readonly kind: "unordered";
      readonly turns: readonly LedgerPosition[];
      readonly resolutions: readonly LedgerPosition[];
    };

type PresencePartition = {
  readonly humans: readonly PresenceEvent[];
  readonly resolutions: readonly PresenceEvent[];
};

const latestTimestamp = ({ events }: { readonly events: readonly PresenceEvent[] }): string =>
  events.reduce((latest, event) => event.timestamp > latest ? event.timestamp : latest, "");

const positionOf = ({ event }: { readonly event: PresenceEvent }): LedgerPosition => ({
  timestamp: event.timestamp,
  shard: event.shard,
  position: event.position,
});

const latestEvents = ({ events }: { readonly events: readonly PresenceEvent[] }): readonly PresenceEvent[] => {
  const timestamp = latestTimestamp({ events });
  return events.filter((event) => event.timestamp === timestamp);
};

const lastResolutionPerShard = ({ resolutions }: { readonly resolutions: readonly PresenceEvent[] }): ReadonlyMap<string, PresenceEvent> => {
  const boundaries = new Map<string, PresenceEvent>();
  resolutions.forEach((resolution) => {
    const previous = boundaries.get(resolution.shard);
    if (!previous || resolution.position > previous.position) boundaries.set(resolution.shard, resolution);
  });
  return boundaries;
};

const assessTiedEvents = ({ humans, resolutions }: PresencePartition): PresenceEvidence => {
  const latestHumans = latestEvents({ events: humans });
  const boundaries = lastResolutionPerShard({ resolutions: latestEvents({ events: resolutions }) });
  const witness = latestHumans.find((human) => {
    const boundary = boundaries.get(human.shard);
    return boundaries.size === 1 && boundary !== undefined && boundary.position < human.position;
  });
  if (witness) return { kind: "fresh", witness: positionOf({ event: witness }) };
  const possibleHumans = latestHumans.filter((human) => {
    const boundary = boundaries.get(human.shard);
    return !boundary || boundary.position < human.position;
  });
  if (possibleHumans.length === 0) return {
    kind: "consumed",
    boundaries: [...boundaries.values()].map((event) => positionOf({ event })),
  };
  return {
    kind: "unordered",
    turns: possibleHumans.map((event) => positionOf({ event })),
    resolutions: [...boundaries.values()].map((event) => positionOf({ event })),
  };
};

const assessOrderedEvents = ({ humans, resolutions }: PresencePartition): PresenceEvidence => {
  const human = latestEvents({ events: humans })[0];
  if (!human) return { kind: "missing" };
  const resolution = latestEvents({ events: resolutions })[0];
  if (!resolution || human.timestamp > resolution.timestamp) {
    return { kind: "fresh", witness: positionOf({ event: human }) };
  }
  if (human.timestamp < resolution.timestamp) {
    return { kind: "consumed", boundaries: [positionOf({ event: resolution })] };
  }
  return assessTiedEvents({ humans, resolutions });
};

export const assessPresenceHistory = ({ history }: { readonly history: PresenceHistory }): PresenceEvidence => {
  if (history.kind === "unavailable") return { kind: "unavailable", reason: history.reason };
  if (history.events.length === 0) return { kind: history.tracking === "inactive" ? "untracked" : "missing" };
  return assessOrderedEvents({
    humans: history.events.filter((event) => event.kind === "human-turn"),
    resolutions: history.events.filter((event) => event.kind === "resolution"),
  });
};
