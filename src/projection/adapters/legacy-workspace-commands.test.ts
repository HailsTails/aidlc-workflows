import { expect, test } from "bun:test";
import { workspaceNouns, workspaceRead } from "./legacy-workspace-commands.ts";

test("the workspace reader preserves the two shipped nouns and their list/help forms", () => {
  expect(workspaceNouns).toEqual(["intent", "space"]);
  expect(workspaceRead(["intent", "list"])).toBe("read");
  expect(workspaceRead(["space", "help"])).toBe("read");
});

test("workspace switches and creates are not reads", () => {
  expect(workspaceRead(["intent", "other"])).toBe("other");
  expect(workspaceRead(["space", "create", "new"])).toBe("other");
});
