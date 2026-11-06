import type { RuntimeInputPreparation } from "../src/domain/runtime-inputs.ts";
import { mock } from "bun:test";
import type { PreparedDistributionContext } from "../src/domain/distribution-context.ts";
import { distributionSeed } from "./distribution-fixtures.ts";
export const contextDescriptorFile = { path: ".claude/tools/data/harness.json", bytes: new Uint8Array([7, 8]), mode: 0o644 };
export const sourcePreparedContext: PreparedDistributionContext = { context: { binding: distributionSeed.binding, rulesSubdir: "rules", invocation: "bun .claude/tools/aidlc.ts" }, files: [contextDescriptorFile], inputs: [{ path: "scripts/harness-runtime-data.ts", sha256: "source-descriptor-api" }] };
export const contextRuntimeEvidence = { paths: [".claude/tools/data/harness.json"], inputs: [{ path: "scripts/harness-runtime-data.ts", sha256: "source-descriptor-api" }] };
export const sourceContextRules = { path: mock().mockReturnValue("safe") };
export const contextInputPreparation: RuntimeInputPreparation = { kind: "context", ...contextRuntimeEvidence };
