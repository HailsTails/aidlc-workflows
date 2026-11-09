import { describe, expect, test } from "bun:test";
import { IMPLEMENTERS, registeredGlobalRoots } from "./implementers.ts";

describe("IMPLEMENTERS", () => {
  test("each capability has exactly one implementer", () => {
    const capabilities = IMPLEMENTERS.map((implementer) => implementer.capability);

    expect(new Set(capabilities).size).toBe(capabilities.length);
  });

  test("each implementer names its port, fake seam and hermetic test beside its file", () => {
    for (const implementer of IMPLEMENTERS) {
      expect(implementer.port).toBe(implementer.file.replace(/\.ts$/, "-port.ts"));
      expect(implementer.hermeticTest).toBe(implementer.file.replace(/\.ts$/, ".hermetic.test.ts"));
      expect(implementer.fakeSeam).toContain("/fixtures/");
    }
  });
});

describe("registeredGlobalRoots", () => {
  test("it reduces each registered global to the name lint restricts", () => {
    const processRunner = IMPLEMENTERS.find(({ capability }) => capability === "process-runner");

    expect(processRunner && registeredGlobalRoots(processRunner)).toEqual([
      "Bun",
      "Bun",
      "Bun",
      "process",
    ]);
  });
});
