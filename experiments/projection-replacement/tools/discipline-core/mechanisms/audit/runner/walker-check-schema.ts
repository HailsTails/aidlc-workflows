import { isRepoPathText } from "../../../core/values/repo-path.ts";
import { z } from "zod";

export const walkerPieceSettingsSchema = z
  .object({
    module: z
      .string()
      .refine(
        (text) => text.endsWith(".ts") && isRepoPathText({ text }) === "repo-path",
        "the module is not a path inside the piece folder ending .ts",
      ),
  })
  .readonly();

export type WalkerPieceSettings = z.infer<typeof walkerPieceSettingsSchema>;
