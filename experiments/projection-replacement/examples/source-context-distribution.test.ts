import { expect, mock, test } from "bun:test";
import { createSourceContextDistributionSource } from "./source-context-distribution.ts";
import { sourcePreparedContext } from "../__tests__/distribution-context-fixtures.ts";
test("source context factory wires the explicit file mode and typed context reader", () => {
  const reader = { load: mock().mockResolvedValue({ status: "ok", value: sourcePreparedContext }) }, source = { load: mock() }, context = mock().mockReturnValue(reader), create = mock().mockReturnValue(source);
  expect(createSourceContextDistributionSource({ mode: 0o644, create, context })).toBe(source);
  expect(context).toHaveBeenCalledWith({ mode: 0o644 });
  expect(create).toHaveBeenCalledWith({ context: reader });
});
