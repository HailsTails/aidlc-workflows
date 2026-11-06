import { expect, test } from "bun:test";
import {
  nativeAgentCases,
  kiroAgentCases,
  kasAgentCases,
  missingNativeCases,
} from "../__tests__/agent-native-cases.ts";
import { successful } from "../__tests__/support.ts";
import { parseAgentStage } from "../src/adapters/agent-source.ts";
import { createKasAgentEmitter, parseKasWorkerPolicy } from "../src/adapters/kas-agent.ts";
import {
  createKiroAgentEmitter,
  parseKiroAgentProfile,
  prepareKiroAgentProfile,
  kiroCopyCommandPatterns,
} from "../src/adapters/kiro-agent.ts";
import { projectAuthoredAgent } from "./agent-projection.ts";

test.each(
  nativeAgentCases,
)("composition: $baseline $kind $context.harness native role and engine persona", (entry) => {
  const stage = successful(
    parseAgentStage({ text: entry.source.stageText, origin: entry.source.stageOrigin }),
  );
  const projected = successful(
    projectAuthoredAgent({ ...entry.source, context: entry.context, stages: [stage] }),
  );
  expect(projected.resources).toEqual(entry.expected);
});
test.each(
  kiroAgentCases,
)("composition: $baseline Kiro authored JSON, resolved grants, persona and knowledge", (entry) => {
  const profile = successful(
    parseKiroAgentProfile({ text: entry.profileText, origin: entry.profileOrigin }),
  );
  const shellCommands = kiroCopyCommandPatterns({
    dispatcherCommands: entry.dispatcherCommands,
    toolScripts: entry.toolScripts,
    dialect: entry.commandDialect,
  });
  const preparedProfile = successful(
    prepareKiroAgentProfile({
      profile,
      shellCommands,
      sharedResources: entry.sharedResources,
      invocation: entry.context.invocation,
      hookSuffix: entry.hookSuffix,
    }),
  );
  const stage = successful(
    parseAgentStage({ text: entry.source.stageText, origin: entry.source.stageOrigin }),
  );
  const projected = successful(
    projectAuthoredAgent({
      ...entry.source,
      context: entry.context,
      stages: [stage],
      emitter: createKiroAgentEmitter({
        profile: preparedProfile,
        promptAdditions: entry.promptAdditions,
      }),
    }),
  );
  expect(projected.resources).toEqual(entry.expected);
});
test.each(
  kasAgentCases,
)("composition: $baseline $kind KAS manifest-owned worker permissions", (entry) => {
  const policy = successful(
    parseKasWorkerPolicy({
      input: entry.policyLines,
      origin: entry.policyOrigin,
      name: entry.policyName,
    }),
  );
  const stage = successful(
    parseAgentStage({ text: entry.source.stageText, origin: entry.source.stageOrigin }),
  );
  const projected = successful(
    projectAuthoredAgent({
      ...entry.source,
      context: entry.context,
      stages: [stage],
      emitter: createKasAgentEmitter({ policy }),
    }),
  );
  expect(projected.resources).toEqual(entry.expected);
});
test.each(
  missingNativeCases,
)("composition: $baseline $context.harness missing plugin native policy is an explicit refusal", (entry) => {
  expect(projectAuthoredAgent({ ...entry.source, context: entry.context, stages: [] })).toEqual(
    entry.refusal,
  );
});
