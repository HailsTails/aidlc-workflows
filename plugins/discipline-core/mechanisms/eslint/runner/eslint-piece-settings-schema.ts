import { z } from "zod";
import { isRepoPathText } from "../../../core/values/repo-path.ts";

const TYPESCRIPT_MODULE_SUFFIX = ".ts";

const pieceModulePathSchema = z.string().superRefine((text, context) => {
  if (isRepoPathText({ text }) === "not-repo-path" || !text.endsWith(TYPESCRIPT_MODULE_SUFFIX)) {
    context.addIssue({
      code: "custom",
      message: "not a path inside the piece folder ending in .ts",
    });
  }
});

export const eslintPieceSettingsSchema = z
  .strictObject({
    pluginNamespace: z.string(),
    pluginModule: pieceModulePathSchema,
    rule: z.string(),
  })
  .readonly();

export type EslintPieceSettings = z.infer<typeof eslintPieceSettingsSchema>;

export type EslintRuleConfiguration =
  | "error"
  | readonly ["error", { readonly allowElseIf: false }]
  | readonly ["error", { readonly props: true }];
