import { expect, test } from "bun:test";
import { projectPluginHooks } from "./project-plugin-hooks.ts";
import { emptyHookFile, hookCommandFixture } from "../__tests__/plugin-hook-fixtures.ts";

test("CLI emits only the native contribution file without a wrapper", async () => {
  const fixture = hookCommandFixture();
  await projectPluginHooks({ argv: ["request.json"], dependencies: fixture.dependencies });
  expect(fixture.output).toEqual({ stdout: [emptyHookFile], errors: [] });
});
test("invalid request emits findings without a partial native file", async () => {
  const fixture = hookCommandFixture({ loaded: { status: "invalid", findings: [{ code: "invalid-json", subject: "plugin-hooks", detail: "invalid request" }] } });
  await projectPluginHooks({ argv: ["request.json"], dependencies: fixture.dependencies });
  expect(fixture.output).toEqual({ stdout: [], errors: ['{"status":"invalid","findings":[{"code":"invalid-json","subject":"plugin-hooks","detail":"invalid request"}]}\n'] });
});
test("unavailable compiler emits its specific finding without a native file", async () => {
  const fixture = hookCommandFixture({ projected: { status: "invalid", findings: [{ code: "capability-gap", subject: "plugin-hooks", detail: "source API unavailable" }] } });
  await projectPluginHooks({ argv: ["request.json"], dependencies: fixture.dependencies });
  expect(fixture.output).toEqual({ stdout: [], errors: ['{"status":"invalid","findings":[{"code":"capability-gap","subject":"plugin-hooks","detail":"source API unavailable"}]}\n'] });
});
