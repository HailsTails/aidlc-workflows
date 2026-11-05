export type ReplacementPolicy = "preserve-user-changes" | "force";

export type AdoptionEvidence = "none" | "exact-source-projection" | "legacy-signature";

export type ShippedTarget =
  | { readonly kind: "absent" }
  | { readonly kind: "non-regular" }
  | {
      readonly kind: "regular";
      readonly proposedContent: "equal" | "different";
      readonly ownership: "unchanged-owned" | "unowned-or-modified" | "unproven";
      readonly adoption: AdoptionEvidence;
    };

export type ShippedFileDecision =
  | { readonly action: "create"; readonly reason: "target-absent" }
  | { readonly action: "preserve"; readonly reason: "content-matches" }
  | {
      readonly action: "update";
      readonly reason: "unchanged-owned" | "adopted-exact-source" | "adopted-legacy-signature" | "forced-replacement";
    }
  | {
      readonly action: "conflict";
      readonly reason: "non-regular-target" | "unproven-ownership" | "unowned-or-modified";
    };

export type ShippedFileRequest = {
  readonly target: ShippedTarget;
  readonly replacement: ReplacementPolicy;
};

const refusedReplacement = ({ target }: ShippedFileRequest): Extract<ShippedFileDecision, { action: "conflict" }> | null => {
  if (target.kind === "non-regular") return { action: "conflict", reason: "non-regular-target" };
  if (target.kind !== "regular") return null;
  if (target.ownership === "unproven") return { action: "conflict", reason: "unproven-ownership" };
  if (target.ownership !== "unchanged-owned" && target.adoption === "none") {
    return { action: "conflict", reason: "unowned-or-modified" };
  }
  return null;
};

const admittedUpdate = ({ target }: ShippedFileRequest): Extract<ShippedFileDecision, { action: "update" }> => {
  if (target.kind === "regular" && target.adoption === "exact-source-projection") {
    return { action: "update", reason: "adopted-exact-source" };
  }
  if (target.kind === "regular" && target.adoption === "legacy-signature") {
    return { action: "update", reason: "adopted-legacy-signature" };
  }
  if (target.kind === "regular" && target.ownership === "unchanged-owned") {
    return { action: "update", reason: "unchanged-owned" };
  }
  return { action: "update", reason: "forced-replacement" };
};

export const reconcileShippedFile = (request: ShippedFileRequest): ShippedFileDecision => {
  if (request.target.kind === "absent") return { action: "create", reason: "target-absent" };
  if (request.target.kind === "regular" && request.target.proposedContent === "equal") {
    return { action: "preserve", reason: "content-matches" };
  }
  const refusal = refusedReplacement(request);
  if (refusal !== null && request.replacement === "preserve-user-changes") return refusal;
  return admittedUpdate(request);
};

export type RetiredTarget =
  | { readonly kind: "absent" }
  | { readonly kind: "non-regular" }
  | { readonly kind: "regular"; readonly ownership: "unchanged-owned" | "locally-modified" };

export type RetiredFileRequest = {
  readonly target: RetiredTarget;
  readonly replacement: ReplacementPolicy;
};

export type RetiredFileDecision =
  | { readonly action: "none"; readonly reason: "target-absent" }
  | { readonly action: "remove"; readonly reason: "no-longer-shipped" }
  | { readonly action: "conflict"; readonly reason: "removed-upstream-but-locally-modified" };

export const reconcileRetiredFile = ({ target, replacement }: RetiredFileRequest): RetiredFileDecision => {
  if (target.kind === "absent") return { action: "none", reason: "target-absent" };
  if (replacement !== "force" && (target.kind !== "regular" || target.ownership !== "unchanged-owned")) {
    return { action: "conflict", reason: "removed-upstream-but-locally-modified" };
  }
  return { action: "remove", reason: "no-longer-shipped" };
};
