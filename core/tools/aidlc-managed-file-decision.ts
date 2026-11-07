type ManagedTarget =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "other" }>
  | Readonly<{ kind: "file"; hash: string | undefined }>;

export type ManagedFileFacts = Readonly<{
  target: ManagedTarget;
  sourceHash: string;
  recordedHash: string | undefined;
  releaseHash: string | undefined;
  attribution: "adopted-copy" | "not-adopted";
  proof: "available" | "unproven";
  overwrite: "protect" | "force";
}>;

export type ManagedFileDecision =
  | Readonly<{ kind: "preserve" }>
  | Readonly<{ kind: "conflict"; detail: "locally modified or unowned" }>
  | Readonly<{ kind: "copy"; action: "create" | "update"; detail: "adopted exact copy-channel signature" | undefined }>;

/** Ordinary managed-file reconciliation after native ownership proofs; special file policies stay separate. */
export function decideManagedFileChange({ target, sourceHash, recordedHash, releaseHash, attribution, proof, overwrite }: ManagedFileFacts): ManagedFileDecision {
  if (target.kind === "file" && target.hash === sourceHash) return { kind: "preserve" };
  if (
    target.kind !== "absent" && overwrite !== "force" &&
    (target.kind !== "file" || proof === "unproven" ||
      (attribution !== "adopted-copy" && target.hash !== releaseHash && (!recordedHash || target.hash !== recordedHash)))
  ) {
    return { kind: "conflict", detail: "locally modified or unowned" };
  }
  return {
    kind: "copy",
    action: target.kind === "absent" ? "create" : "update",
    detail: attribution === "adopted-copy" ? "adopted exact copy-channel signature" : undefined,
  };
}

export type RecordedRetirementFacts = Readonly<{
  target: ManagedTarget;
  recordedHash: string;
  proof: "proven-retired" | "unproven";
}>;

export type RecordedRetirementAttribution =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "recorded" }>
  | Readonly<{ kind: "unproven" }>;

export type RecordedRetirementDecision =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "conflict"; detail: "removed upstream but locally modified" }>
  | Readonly<{ kind: "remove"; cause: "recorded" | "kiro-upgrade" | "explicit-force" }>;

export function assessRecordedRetirement({ target, recordedHash, proof }: RecordedRetirementFacts): RecordedRetirementAttribution {
  if (target.kind === "absent") return { kind: "absent" };
  if (target.kind === "file" && (proof === "proven-retired" || target.hash === recordedHash)) return { kind: "recorded" };
  return { kind: "unproven" };
}

export function decideRecordedRetirement({ attribution, kiroProof, overwrite }: Readonly<{
  attribution: RecordedRetirementAttribution;
  kiroProof: "attributed" | "unproven";
  overwrite: "protect" | "force";
}>): RecordedRetirementDecision {
  if (attribution.kind === "absent") return { kind: "absent" };
  if (attribution.kind === "recorded") return { kind: "remove", cause: "recorded" };
  if (kiroProof === "attributed") return { kind: "remove", cause: "kiro-upgrade" };
  if (overwrite === "force") return { kind: "remove", cause: "explicit-force" };
  return { kind: "conflict", detail: "removed upstream but locally modified" };
}

export type ManagedFileRecordFacts = Readonly<{
  mode: "retain" | "advance";
  target: ManagedTarget;
  priorHash: string | undefined;
  recordHash: string;
  composedHash: string | undefined;
  regeneration: "regenerated" | "unchanged";
  modelStamp: "stamped" | "unstamped";
}>;

export type ManagedFileRecordDecision =
  | Readonly<{ kind: "record"; hash: string }>
  | Readonly<{ kind: "unrecorded" }>;

function mayAdvanceRetainedRecord({ target, priorHash, composedHash, regeneration, modelStamp }: ManagedFileRecordFacts) {
  return regeneration === "regenerated" && target.kind === "file" &&
    (target.hash === priorHash || (priorHash !== undefined && modelStamp === "stamped" && composedHash !== undefined));
}

export function decideManagedFileRecord(facts: ManagedFileRecordFacts): ManagedFileRecordDecision {
  const hash = facts.mode === "advance" || mayAdvanceRetainedRecord(facts)
    ? facts.composedHash ?? facts.recordHash
    : facts.priorHash;
  return hash === undefined ? { kind: "unrecorded" } : { kind: "record", hash };
}

export type ManagedContentAuthority =
  | Readonly<{ kind: "release-managed" }>
  | Readonly<{ kind: "workspace-seed" }>
  | Readonly<{ kind: "workspace-state" }>;

export type WorkspaceSeedDecision =
  | Readonly<{ kind: "preserve"; detail: "project-owned seed" }>
  | Readonly<{ kind: "create" }>;

export function classifyManagedContent({ path }: Readonly<{ path: string }>): ManagedContentAuthority {
  if (path === "aidlc/active-space" || /^aidlc\/spaces\/[^/]+\/memory\//.test(path)) return { kind: "workspace-seed" };
  return path.startsWith("aidlc/") ? { kind: "workspace-state" } : { kind: "release-managed" };
}

export function decideWorkspaceSeed({ target }: Readonly<{ target: "present" | "absent" }>): WorkspaceSeedDecision {
  return target === "present" ? { kind: "preserve", detail: "project-owned seed" } : { kind: "create" };
}
