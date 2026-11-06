import { expect, vi, test } from "vitest";
import { createRinConfigCommand, type RinConfigurePort } from "./rin-config.ts";
import { rinWorkflowRefreshPolicy } from "../application/refresh-policy.ts";

test("dispatch arguments become config arguments with the explicit Rin policy", async () => {
  const configure = vi.fn<RinConfigurePort>().mockResolvedValue(undefined);
  const command = createRinConfigCommand({ configure });
  await command.run({ input: ["--project-dir", "/fixture", "--dry-run", "--json"] });
  expect(configure.mock.calls).toEqual([[{ input: ["config", "--project-dir", "/fixture", "--dry-run", "--json"], refreshPolicy: rinWorkflowRefreshPolicy }]]);
});

test("legacy source arguments retain their command unchanged", async () => {
  const configure = vi.fn<RinConfigurePort>().mockResolvedValue(undefined);
  const command = createRinConfigCommand({ configure });
  await command.configure({ input: ["config", "--dry-run"] });
  expect(configure.mock.calls).toEqual([[{ input: ["config", "--dry-run"], refreshPolicy: rinWorkflowRefreshPolicy }]]);
});
