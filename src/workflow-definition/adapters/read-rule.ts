import type { Result } from "../../kernel/result.ts";
import type { MethodSourceLocation } from "../domain/method-source.ts";
import { sensorId, ruleId } from "../domain/identities.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { Rule, RuleLayer, RulePairing } from "../domain/rule.ts";
import { decodeMarkdown, translated, authoredValue } from "./authored-markdown.ts";
import { RuleFileSchema } from "./rule-file.ts";

const pairingOf = (pairing: string | undefined): RulePairing => {
  if (!pairing) return { kind: "unpaired" };
  if (pairing === "feedforward-only") return { kind: "feedforward-only" };
  return { kind: "sensor", sensor: authoredValue(sensorId(pairing.replace(/^aidlc-/, ""))) };
};

export const readRule = (request: {
  readonly source: MethodSourceLocation; readonly raw: string; readonly layer: RuleLayer;
}): Result<Rule, readonly MethodRefusal[]> => {
  const decoded = decodeMarkdown({ ...request, schema: RuleFileSchema, header: "optional",
    strings: ["pairing", "status", "stale_after"] });
  if (!decoded.ok) return decoded;
  const { file, body: authoredText } = decoded.value;
  return translated(request.source, () => ({ id: authoredValue(ruleId(request.source.path.replace(/^memory\//, "").replace(/\.md$/, ""))), source: request.source.path, layer: request.layer,
    owner: request.source.owner, pairing: pairingOf(file.pairing), status: file.status ?? null,
    staleAfter: file.stale_after ?? null, text: authoredText }));
};


