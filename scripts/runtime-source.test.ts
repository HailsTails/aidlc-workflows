import { expect, test } from "bun:test";
import { runtimeSourceRole } from "./runtime-source.ts";

test.each([
  { file: "tools/aidlc-message-store.ts", expected: "runtime" },
  { file: "tools/aidlc-plugin-hook-registrations.test.ts", expected: "test" },
  { file: "tools\\agent.test.tsx", expected: "test" },
  { file: "tools/test-helper.ts", expected: "runtime" },
  { file: "knowledge/contract.test.md", expected: "runtime" },
  { file: "tools/fixture.test.ts/adapter.ts", expected: "runtime" },
  { file: "hooks/guard.test.mts", expected: "test" },
  { file: "tools/runner.test.js", expected: "test" },
])("classifies $file as $expected", ({ file, expected }) => {
  expect(runtimeSourceRole({ file })).toBe(expected);
});
