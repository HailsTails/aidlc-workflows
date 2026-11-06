import { expect, mock, test } from "bun:test";
import { createSourceModuleDistributionSource } from "./source-module-distribution.ts";
test("source modules use shared prepared-file admission without owning installation", () => {
  const source = { load: mock() }, preparer = { prepare: mock() }, prepare = mock().mockReturnValue(preparer), create = mock().mockReturnValue(source);
  expect(createSourceModuleDistributionSource({ source, mode: 0o640, create, prepare })).toBe(source);
  expect(prepare.mock.calls).toEqual([[]]);
  expect(create.mock.calls).toEqual([[{ source, mode: 0o640, preparer }]]);
});
