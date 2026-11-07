type JsonMapEntryValue =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "present"; hash: string }>;

export type JsonMapEntryFacts = Readonly<{
  incoming: JsonMapEntryValue;
  current: JsonMapEntryValue;
  recordedHash: string | undefined;
  legacySignature: "matched" | "unmatched";
  overwrite: "protect" | "force";
  addition: "allow" | "present-only";
}>;

export type JsonMapEntryDecision =
  | Readonly<{ kind: "preserve" }>
  | Readonly<{ kind: "set"; recordHash: string }>
  | Readonly<{ kind: "record"; hash: string }>
  | Readonly<{ kind: "remove" }>;

export type JsonMapReconciliation = Readonly<{
  map: Record<string, unknown>;
  entries: Record<string, string>;
}>;

function decideRetiredJsonMapEntry({ current, recordedHash, overwrite }: JsonMapEntryFacts): JsonMapEntryDecision {
  return current.kind === "present" && recordedHash !== undefined &&
    (current.hash === recordedHash || overwrite === "force")
    ? { kind: "remove" }
    : { kind: "preserve" };
}

export function decideJsonMapEntry(facts: JsonMapEntryFacts): JsonMapEntryDecision {
  const { incoming, current, recordedHash, legacySignature, overwrite, addition } = facts;
  if (incoming.kind === "absent") return decideRetiredJsonMapEntry(facts);
  if (current.kind === "absent") {
    return addition === "present-only" ? { kind: "preserve" } : { kind: "set", recordHash: incoming.hash };
  }
  if (recordedHash && (current.hash === recordedHash || overwrite === "force")) return { kind: "set", recordHash: incoming.hash };
  if (recordedHash && current.hash === incoming.hash) return { kind: "record", hash: incoming.hash };
  if (!recordedHash && legacySignature === "matched") return { kind: "set", recordHash: incoming.hash };
  return { kind: "preserve" };
}
