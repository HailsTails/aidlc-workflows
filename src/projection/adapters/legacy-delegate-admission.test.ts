import { expect, test } from "bun:test";
import { admittedVerbs, lifecycleAdmission } from "./legacy-delegate-admission.ts";

test("delegate admission preserves the shipped developer state reads", () => {
  expect(admittedVerbs("aidlc-developer-agent")["aidlc-state.ts"]).toEqual(["get", "count", "resume", "lookup"]);
});

test("lifecycle admission keeps a bare selection query separate from mutation", () => {
  expect(lifecycleAdmission("bun .fixture/tools/aidlc-utility.ts select-plugins")).toBe("admitted");
  expect(lifecycleAdmission("bun .fixture/tools/aidlc-utility.ts select-plugins other")).toBe("refused");
  expect(lifecycleAdmission("bun .fixture/tools/aidlc-orchestrate.ts next")).toBe("refused");
});
