import { expect, test, mock } from "bun:test";
import { createScopeSourceReader, createScopeSourceOperations } from "./scope-sources.ts";
import { scopeSources, createScopeSourceFixture } from "../../__tests__/scope-fixtures.ts";
import { distributionBasis } from "../../__tests__/distribution-fixtures.ts";
test("composition: loads authored scopes with exact source-content witnesses", async () => {
  expect(await createScopeSourceReader({ operations: createScopeSourceFixture() }).load({ sourceRoot: "source", basis: distributionBasis })).toEqual({ status: "ok", value: scopeSources });
});
test("unsupported nested source entries are refused instead of silently omitted", async () => {
  expect(await createScopeSourceReader({ operations: { ...createScopeSourceFixture(), inventory: mock().mockResolvedValue([{ path: "core/scopes/nested/aidlc-bugfix.md", text: "Body" }]) } }).load({ sourceRoot: "source", basis: distributionBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scope-sources", detail: "core scope projection requires a nonempty flat inventory of authored aidlc-<name>.md files; unsupported entries were not dropped" }] });
});
test("source read failures remain unavailable capability findings", async () => {
  expect(await createScopeSourceReader({ operations: { ...createScopeSourceFixture(), inventory: mock().mockRejectedValue(new Error("source unavailable")) } }).load({ sourceRoot: "source", basis: distributionBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scope-sources", detail: "authored scope inputs unavailable: source unavailable" }] });
});
test("production factory exposes source inventory and content digest capabilities", () => {
  expect(createScopeSourceOperations()).toMatchObject({ inventory: expect.any(Function), digest: expect.any(Function) });
});
