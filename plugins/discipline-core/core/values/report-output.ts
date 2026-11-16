import { z } from "zod";

export const reportOutputSchema = z.enum(["full", "failures-only", "counts", "verdict-only"]);

export type ReportOutput = z.infer<typeof reportOutputSchema>;

export const reportOutputInEffect = (request: {
  readonly requested: ReportOutput | undefined;
  readonly configured: ReportOutput;
}): ReportOutput => request.requested ?? request.configured;
