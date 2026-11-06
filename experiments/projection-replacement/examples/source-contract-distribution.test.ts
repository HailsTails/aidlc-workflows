import { expect, mock, test } from "bun:test";
import { createSourceContractDistributionSource } from "./source-contract-distribution.ts";
test("source contracts reuse shared prepared-input admission", () => {
  const source = { load: mock() }, preparer = { prepare: mock() }, prepare = mock().mockReturnValue(preparer), create = mock().mockReturnValue(source);
  expect(createSourceContractDistributionSource({ source, mode: 0o640, create, prepare })).toBe(source);
  expect(prepare.mock.calls).toEqual([[]]);
  expect(create.mock.calls).toEqual([[{ source, mode: 0o640, preparer }]]);
});
