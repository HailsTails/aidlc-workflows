import { expect, test } from "bun:test";
import { createNativeRunnerRequirementRules } from "./native-runner-requirement-rules.ts";
test("composition: the production snapshot digest uses SHA-256 over original bytes", () => {
  expect(createNativeRunnerRequirementRules().digest({ bytes: new Uint8Array([97, 98, 99]) })).toEqual("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
