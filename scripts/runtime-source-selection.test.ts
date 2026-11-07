import { expect, test } from "bun:test";
import { authoredSourceRole } from "./runtime-source-selection.ts";

test.each([
  "core/tools/aidlc-shell.test.ts",
  "core/tools/dependency-assessment/workflow.test.ts",
  "core/hooks/aidlc-hook.test.ts",
  "core/other/owner.test.ts",
  "core\\tools\\nested\\workflow.test.ts",
  "scripts/projection/src/adapters/source-runtime-modules.test.ts",
  "scripts/projection/src/domain/model.test.ts",
  "scripts/projection/examples/example.test.ts"
])("co-located suites in authored production roots are test sources: %s", path => {
  expect(authoredSourceRole({ path })).toBe("test");
});

test.each([
  "core/tools/aidlc-shell.ts",
  "core/tools/dependency-assessment/workflow.ts",
  "core/hooks/aidlc-hook.ts",
  "core/tools/aidlc-shell.checks.ts",
  "core/tools/aidlc-shell.spec.ts",
  "core/tools/aidlc-shell.test.ts.backup",
  "core/tools/data/runtime.json",
  "core/agents/aidlc-agent.md",
  "harness/custom/settings.ts",
  "harness/custom/settings.test.ts",
  "scripts/runtime-source-selection.test.ts",
  "scripts/plugin-hooks-template/explicit.test.ts",
  "scripts/runtime-source-selection.ts",
  "plugins/example/tools/explicit.test.ts",
  "other/core/tools/aidlc-shell.test.ts",
  "coreish/tools/aidlc-shell.test.ts"
])("other authored paths retain production selection: %s", path => {
  expect(authoredSourceRole({ path })).toBe("production");
});
