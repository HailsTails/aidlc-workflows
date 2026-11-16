import { builtinRules } from "eslint-9/use-at-your-own-risk";
import { z } from "zod";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import {
  defaultEslintToolchainModules,
  type EslintToolchainModules,
} from "../../../mechanisms/eslint/runner/eslint-toolchain.ts";

export const eslint9ToolchainModules: EslintToolchainModules = {
  ...defaultEslintToolchainModules,
  eslint: () => import("eslint-9"),
};

const builtinRulesInjectedPieceSchema = z.object({
  createPlugin: z.function({ input: [z.object({ builtinRules: z.instanceof(Map) })], output: z.unknown() }),
});

const withEslint9BuiltinRules = (request: { readonly namespace: unknown }): unknown => {
  const injected = builtinRulesInjectedPieceSchema.safeParse(request.namespace);
  return injected.success ? { default: injected.data.createPlugin({ builtinRules }) } : request.namespace;
};

export const eslint9PieceModules = (request: { readonly base: ModuleLoaderPort }): ModuleLoaderPort => ({
  load: (load) =>
    request.base
      .load(load)
      .then((loaded) =>
        loaded.outcome === "failed" ? loaded : { outcome: "ok", value: withEslint9BuiltinRules({ namespace: loaded.value }) },
      ),
});
