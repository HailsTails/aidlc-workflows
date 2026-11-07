// Detection core for the operator-steer interrupt class. Pure: it names the
// ledger it needs as a `SteerLedger` port taken on the signature and never
// reaches a filesystem primitive itself. The default file-backed factory lives
// beside the hook body, which is the composition root.

import { createHash } from "node:crypto";

const STEER_MARKERS = ["URGENT —", "URGENT -", "STEER:"] as const;

type PendingSteer =
  | { readonly state: "none" }
  | { readonly state: "pending"; readonly steer: string };

// A transcript entry Claude Code records as `type:"user"` is not necessarily
// the human talking: tool_result arrays and `isMeta` wrappers are recorded the
// same way, and this hook's OWN advisory is injected as user-shaped context.
// Counting any of those as a steer would make the hook re-surface itself
// forever — the failure aidlc-continue-workflow.ts guards with the same shape.
const isSyntheticUserEntry = (entry: {
  readonly isMeta?: unknown;
  readonly content: unknown;
}): boolean => {
  if (entry.isMeta === true) return true;
  return (
    Array.isArray(entry.content) &&
    entry.content.some(
      (block) =>
        (block as { readonly type?: unknown } | null)?.type === "tool_result",
    )
  );
};

const textOfContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      const typed = block as {
        readonly type?: unknown;
        readonly text?: unknown;
      } | null;
      return typed?.type === "text" ? String(typed.text ?? "") : "";
    })
    .join("");
};

const carriesSteerMarker = (text: string): boolean => {
  const leading = text.trimStart();
  return STEER_MARKERS.some((marker) => leading.startsWith(marker));
};

// This hook's own advisory names the steer it is surfacing, so the quoted text
// would itself match the marker on the next boundary. Excluding by the
// directive's own opening line keeps the hook from detecting its own output.
const ACKNOWLEDGEMENT_OPENING = "OPERATOR STEER PENDING";

const isOwnAdvisory = (text: string): boolean =>
  text.trimStart().startsWith(ACKNOWLEDGEMENT_OPENING);

const humanTurnsIn = (transcript: string): readonly string[] =>
  transcript
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return [];
      }
      if (parsed === null || typeof parsed !== "object") return [];
      const entry = parsed as {
        readonly type?: unknown;
        readonly isMeta?: unknown;
        readonly message?: {
          readonly role?: unknown;
          readonly content?: unknown;
        };
      };
      if (entry.type !== "user" || entry.message?.role !== "user") return [];
      const content = entry.message.content;
      if (isSyntheticUserEntry({ isMeta: entry.isMeta, content })) return [];
      const text = textOfContent(content);
      return text.length === 0 || isOwnAdvisory(text) ? [] : [text];
    });

// The LAST marked human turn wins: a second steer supersedes an unacknowledged
// first, and surfacing the stale one would send the lane at the wrong target.
const pendingSteerIn = (input: {
  readonly transcript: string;
}): PendingSteer => {
  const marked = humanTurnsIn(input.transcript).filter(carriesSteerMarker);
  const latest = marked[marked.length - 1];
  return latest === undefined
    ? { state: "none" }
    : { state: "pending", steer: latest };
};

const acknowledgementDirective = (input: { readonly steer: string }): string =>
  [
    `${ACKNOWLEDGEMENT_OPENING} — acknowledge before continuing.`,
    "",
    "The operator sent this while your turn was suspended, so it did not reach",
    "you when it was sent. They have already seen it echoed as delivered.",
    "",
    input.steer.trim(),
    "",
    "An operator steer is never noise. Acknowledge it within one tool call —",
    "say what you read and what you are doing about it — then resume. If it",
    "changes your target, change it and say so; if it does not, say that too.",
    "Silence reads to the operator as the message having been lost again.",
  ].join("\n");

// Long enough that two distinct steers in one session will not collide, short
// enough that the ledger stays readable when diagnosing a repeat surfacing.
const FINGERPRINT_LENGTH = 16;

const fingerprintOf = (steer: string): string =>
  createHash("sha256")
    .update(steer.trim())
    .digest("hex")
    .slice(0, FINGERPRINT_LENGTH);

// The ledger of steers already surfaced, as a capability rather than a
// location: the detection core cannot name the backing, the encoding, or the
// path. `readFingerprints` returning empty is indistinguishable from an
// unwritten ledger by design — a ledger that cannot be read costs a repeat
// surfacing, never a lost steer.
type SteerLedger = {
  readonly readFingerprints: () => readonly string[];
  readonly appendFingerprint: (fingerprint: string) => void;
};

const alreadySurfaced = (input: {
  readonly ledger: SteerLedger;
  readonly steer: string;
}): boolean =>
  input.ledger.readFingerprints().includes(fingerprintOf(input.steer));

const recordSurfaced = (input: {
  readonly ledger: SteerLedger;
  readonly steer: string;
}): void => {
  input.ledger.appendFingerprint(fingerprintOf(input.steer));
};

export type { PendingSteer, SteerLedger };
export {
  ACKNOWLEDGEMENT_OPENING,
  acknowledgementDirective,
  alreadySurfaced,
  carriesSteerMarker,
  fingerprintOf,
  humanTurnsIn,
  pendingSteerIn,
  recordSurfaced,
  STEER_MARKERS,
};
