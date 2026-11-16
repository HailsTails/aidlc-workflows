import { moduleFileForm } from "../../../core/values/install-layout.ts";
import { isRepoPathText } from "../../../core/values/repo-path.ts";
import { z } from "zod";

export const walkerPieceSettingsSchema = z
  .object({
    module: z
      .string()
      .refine(
        (text) => moduleFileForm({ text }) === "module-file" && isRepoPathText({ text }) === "repo-path",
        "the module is not a path inside the piece folder ending .ts, or .js in a built install",
      ),
  })
  .readonly();

export type WalkerPieceSettings = z.infer<typeof walkerPieceSettingsSchema>;