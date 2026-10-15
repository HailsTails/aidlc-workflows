import { z } from "zod";

export const ruleSetNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/)
  .brand<"RuleSetName">();
export const disciplineIdSchema = z
  .string()
  .regex(/^[A-Z]{2,4}-[0-9]+[a-z]?$/)
  .brand<"DisciplineId">();
export const clauseIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/)
  .brand<"ClauseId">();
export const mechanismIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/)
  .brand<"MechanismId">();

export type RuleSetName = z.infer<typeof ruleSetNameSchema>;
export type DisciplineId = z.infer<typeof disciplineIdSchema>;
export type ClauseId = z.infer<typeof clauseIdSchema>;
export type MechanismId = z.infer<typeof mechanismIdSchema>;
