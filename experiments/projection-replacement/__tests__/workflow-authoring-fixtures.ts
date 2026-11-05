import { mock } from "bun:test";
import { distributionBasis, distributionSeed } from "./distribution-fixtures.ts";
import type { WorkflowAuthoringOperations } from "../src/adapters/workflow-authoring-policy.ts";
export const authoringLocation = { sourceRoot: "source", basis: distributionBasis, binding: distributionSeed.binding };
export const authoringInputs = [{ path: "harness/claude/manifest.ts", sha256: "a".repeat(64) }, { path: "scripts/manifest-types.ts", sha256: "b".repeat(64) }];
export const authoringOrigins = [{ ...distributionBasis, path: "harness/claude/manifest.ts" }, { ...distributionBasis, path: "scripts/manifest-types.ts" }];
export const authoringSnapshot = { capability: "declared", manifest: { name: "claude", harnessDir: ".claude", questionOptions: 4 }, inputs: authoringInputs };
export const createAuthoringOperationsFixture = (): WorkflowAuthoringOperations => ({ snapshot: mock().mockResolvedValue(authoringSnapshot) });
