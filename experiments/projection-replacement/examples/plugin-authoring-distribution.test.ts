import { expect, mock, test } from "bun:test";
import { createPluginAuthoringDistributionSource } from "./plugin-authoring-distribution.ts";
test("plugin authoring support delegates byte admission without activating a plugin", () => {
  const source = { load: mock() }, preparer = { prepare: mock() }, prepare = mock().mockReturnValue(preparer), create = mock().mockReturnValue(source);
  expect(createPluginAuthoringDistributionSource({ source, mode: 0o640, create, prepare })).toBe(source);
  expect(prepare.mock.calls).toEqual([[]]);
  expect(create.mock.calls).toEqual([[{ source, mode: 0o640, preparer }]]);
});
