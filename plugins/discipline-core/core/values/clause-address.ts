import { z } from "zod";
import {
  type ClauseId,
  clauseIdSchema,
  type DisciplineId,
  disciplineIdSchema,
  type RuleSetName,
  ruleSetNameSchema,
} from "./identifiers.ts";

export type ClauseAddress = {
  readonly ruleSet: "shared" | { readonly name: RuleSetName };
  readonly discipline: DisciplineId;
  readonly clause: ClauseId;
};

const SHARED_RULE_SET = "shared";

const CLAUSE_ADDRESS_TEXT = /^(?:(?<ruleSet>[^/#]+)\/)?(?<discipline>[^/#]+)#(?<clause>[^/#]+)$/;

export const clauseAddressObjectSchema = z.object({
  ruleSet: z.union([
    z.literal(SHARED_RULE_SET),
    z.object({
      name: ruleSetNameSchema.refine((name) => name !== SHARED_RULE_SET),
    }),
  ]),
  discipline: disciplineIdSchema,
  clause: clauseIdSchema,
});

export const clauseAddressSchema = z
  .string()
  .transform((text, context) => {
    const parts = CLAUSE_ADDRESS_TEXT.exec(text)?.groups;
    if (parts === undefined) {
      context.addIssue({
        code: "custom",
        message: "is not a clause address of the form [<ruleSet>/]<discipline>#<clause>",
      });
      return z.NEVER;
    }
    return {
      ruleSet:
        parts.ruleSet === undefined
          ? SHARED_RULE_SET
          : { name: parts.ruleSet },
      discipline: parts.discipline,
      clause: parts.clause,
    };
  })
  .pipe(clauseAddressObjectSchema);

export const clauseAddressText = (request: {
  readonly address: ClauseAddress;
}): string =>
  request.address.ruleSet === SHARED_RULE_SET
    ? `${request.address.discipline}#${request.address.clause}`
    : `${request.address.ruleSet.name}/${request.address.discipline}#${request.address.clause}`;

export const sameClauseAddress = (request: {
  readonly left: ClauseAddress;
  readonly right: ClauseAddress;
}): "same" | "different" =>
  clauseAddressText({ address: request.left }) === clauseAddressText({ address: request.right })
    ? "same"
    : "different";
