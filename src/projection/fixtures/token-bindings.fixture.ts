import type { TokenBindings } from "../domain/template-token.ts";

export const tokenBindingsFixture = ({ harnessDir }: { readonly harnessDir: string }): TokenBindings => ({
  ["HARNESS_DIR"]: harnessDir,
  ["INVOKE"]: `bun ${harnessDir}/tools/aidlc.ts`,
  ["SKILL_INVOKE"]: null,
  ["OPTION_LETTERS"]: "A-E",
  ["TRUSTED_NAMESPACE"]: "aidlc",
  ["TOOL_PREFIX"]: `bun ${harnessDir}/tools/`,
});
