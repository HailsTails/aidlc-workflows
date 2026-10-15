import { z } from "zod";
import { repoPathSchema } from "../values/repo-path.ts";

export const runnerFailureSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("piece-invalid"), pieceRoot: z.string(), detail: z.string() })
    .readonly(),
  z.object({ kind: z.literal("tool-failed"), detail: z.string() }).readonly(),
  z
    .object({ kind: z.literal("file-unreadable"), file: repoPathSchema, detail: z.string() })
    .readonly(),
  z.object({ kind: z.literal("plugin-conflict"), detail: z.string() }).readonly(),
  z.object({ kind: z.literal("team-config-unloadable"), detail: z.string() }).readonly(),
  z.object({ kind: z.literal("runner-invalid-output"), detail: z.string() }).readonly(),
  z
    .object({ kind: z.literal("file-unparseable"), file: repoPathSchema, detail: z.string() })
    .readonly(),
]);

export type RunnerFailure = z.infer<typeof runnerFailureSchema>;

export const runnerInvalidOutput = (request: {
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "runner-invalid-output", detail: request.detail },
});

const thrownMessage = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

export const rejectedCall = (request: {
  readonly thrown: unknown;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } =>
  runnerInvalidOutput({ detail: `the runner call threw or rejected: ${thrownMessage(request)}` });
