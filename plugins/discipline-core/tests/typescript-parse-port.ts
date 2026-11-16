import { assert } from "vitest";
import { z } from "zod";
import { toolchainBoundStandaloneRunner } from "../core/mechanism-port/toolchain-bound-runner.ts";
import type { RunnerFailure } from "../core/mechanism-port/runner-failure.ts";
import type { StandaloneRunner } from "../core/mechanism-port/runner-module-schema.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { Result } from "../core/values/result.ts";
import { createWalkerRunner } from "../mechanisms/audit/runner/create-walker-runner.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
  type SyntaxApi,
  type TypeScriptParsePort,
  type TypeScriptPeers,
} from "../mechanisms/audit/runner/typescript-parse.ts";

export type TypeScriptLine = "typescript" | "typescript-floor";

export const TYPESCRIPT_LINES: readonly TypeScriptLine[] = ["typescript", "typescript-floor"];

const LINE_VERSIONS: Readonly<Record<TypeScriptLine, RegExp>> = { typescript: /^6\./, "typescript-floor": /^4\.8\.4$/ };

const floorTypeScriptSchema = z.object({
  default: z.custom<SyntaxApi>(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      typeof Reflect.get(value, "createSourceFile") === "function" &&
      typeof Reflect.get(value, "version") === "string",
  ),
});

const DEVELOPMENT_PEERS: TypeScriptPeers = defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/..` });

export const typeScriptPeersOn = (request: { readonly line: TypeScriptLine }): TypeScriptPeers => {
  switch (request.line) {
    case "typescript":
      return DEVELOPMENT_PEERS;
    case "typescript-floor":
      return {
        location: DEVELOPMENT_PEERS.location,
        modules: { typescript: () => import("typescript-floor").then((typescript) => floorTypeScriptSchema.parse(typescript)) },
      };
  }
};

export const parsePortOn = async (request: { readonly line: TypeScriptLine }): Promise<TypeScriptParsePort> => {
  const loaded = await loadParsePort({ peers: typeScriptPeersOn(request) });
  assert(loaded.outcome === "ok", `the ${request.line} line loads from the development install`);
  assert(
    LINE_VERSIONS[request.line].test(loaded.value.syntaxApi.version),
    `the ${request.line} line runs TypeScript ${loaded.value.syntaxApi.version}`,
  );
  return loaded.value;
};

export const auditRunnerOn = (request: { readonly line: TypeScriptLine }): StandaloneRunner =>
  toolchainBoundStandaloneRunner({
    toolchain: parsePortOn(request).then((parse): Result<TypeScriptParsePort, RunnerFailure> => ({ outcome: "ok", value: parse })),
    runnerOf: (parse) =>
      createWalkerRunner({
        fileText: createDefaultFileTextPort({}),
        modules: createDefaultModuleLoaderPort({}),
        path: createDefaultPathPort({}),
        parse,
      }),
  });

export const defaultParsePort: TypeScriptParsePort = await parsePortOn({ line: "typescript" });
