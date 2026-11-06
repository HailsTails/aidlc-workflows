import { mock } from "bun:test";
import { createPreparedDistributionFixture } from "./workflow-runtime-fixtures.ts";
import { distributionSeed } from "./distribution-fixtures.ts";
export const nativePreparedContext = { context: { binding: distributionSeed.binding, rulesSubdir: "rules", invocation: "aidlc" }, files: [], inputs: [] } as const;
export const createPreparedContextFixture = () => ({ operations: createPreparedDistributionFixture(), context: { load: mock().mockResolvedValue({ status: "ok", value: nativePreparedContext }) }, admit: mock().mockReturnValue({ status: "ok", value: { additions: [], unchanged: [] } }), rules: { path: mock().mockReturnValue("safe") } });
