import type { DistributionWorkspace } from "../src/adapters/distribution-workspace.ts";
import { hydratedWorkflowSeed } from "./workflow-runtime-fixtures.ts";
import { mock } from "bun:test";
import type { WorkflowReferenceRuntimeServices } from "../examples/workflow-reference-runtime.ts";
import { distributionSeed } from "./distribution-fixtures.ts";
export const referenceTextFile = { kind: "file", path: ".claude/skills/aidlc/tables.md", body: "FRESH TABLE VIEW\n" } as const;
export const referenceByteFile = { path: ".claude/skills/aidlc/tables.md", mode: 0o644, bytes: new Uint8Array([7, 8]) };
export const referenceHydratedSeed = { ...distributionSeed, files: [...distributionSeed.files, referenceByteFile] };
export const referenceInputs = [{ path: "harness/claude/skills/aidlc/tables.md", sha256: "raw-template-digest" }];
export const createWorkflowReferenceRuntimeFixture = (): WorkflowReferenceRuntimeServices => ({ preparer: { prepare: mock().mockResolvedValue({ status: "ok", value: { file: referenceTextFile, inputs: referenceInputs } }) }, workspace: { run: mock(async ({ consume }) => consume({ root: "private-reference" })) }, admit: mock().mockReturnValue({ status: "ok", value: { additions: [referenceByteFile], unchanged: [] } }), rules: { path: mock().mockReturnValue("safe"), encode: mock().mockReturnValue(new Uint8Array([7, 8])) } });

export const referenceWorkflowSeed = { ...hydratedWorkflowSeed, files: [...hydratedWorkflowSeed.files, referenceByteFile] };
export const referenceRuntimePreparation = { kind: "prepared", paths: [".claude/skills/aidlc/tables.md"], inputs: referenceInputs } as const;
export const createReferenceConsumingWorkspace = (): DistributionWorkspace => ({ run: mock(async ({ consume }) => consume({ root: "private-reference-workflow" })) });