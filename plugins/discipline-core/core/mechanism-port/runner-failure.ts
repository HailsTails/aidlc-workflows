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
