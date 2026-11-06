import { expect, test, vi } from "vitest";
import { runRinPluginRefresh } from "./rin-plugin-refresh.ts";
import type { runPluginSyncWithRefreshPolicy } from "../../../core/tools/aidlc-plugin.ts";
import { rinWorkflowRefreshPolicy } from "../application/refresh-policy.ts";

test("the explicit Rin entry selects its closed policy and retains caller arguments", async () => {
  const run = vi.fn<typeof runPluginSyncWithRefreshPolicy>().mockResolvedValue(undefined);
  expect(await runRinPluginRefresh({ argv: ["--plugin-root", "fixture-plugin", "--quiet"], port: { run } })).toBeUndefined();
  expect(run.mock.calls).toEqual([[{ argv: ["--plugin-root", "fixture-plugin", "--quiet"], refreshPolicy: rinWorkflowRefreshPolicy }]]);
});
