import { expect, test } from "bun:test";
import { DELEGATE_SHELL_FACTS } from "./delegate-shell-facts.fixture.ts";

test("the shared delegate fixture declares only its literal empty command surface", () => {
  expect(DELEGATE_SHELL_FACTS.engineNamespace).toBe("engine");
  expect(DELEGATE_SHELL_FACTS.engineRoutes).toEqual([]);
  expect(DELEGATE_SHELL_FACTS.dispatcherCommands).toEqual([]);
  expect(DELEGATE_SHELL_FACTS.launcherGlobalFlags).toEqual([]);
  expect(DELEGATE_SHELL_FACTS.workspaceNouns).toEqual([]);
});
