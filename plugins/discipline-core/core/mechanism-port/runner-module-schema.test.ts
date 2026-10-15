import { describe, expect, it } from "vitest";
import { runnerModuleSchema } from "./runner-module-schema.ts";

const resolvesEmpty = async () => ({ outcome: "ok", value: [] });

describe("runnerModuleSchema", () => {
  it("accepts a standalone module whose run and conform are functions", () => {
    expect(
      runnerModuleSchema.safeParse({
        exceptionPath: "standalone",
        run: resolvesEmpty,
        conform: resolvesEmpty,
      }).success,
    ).toBe(true);
  });

  it("refuses an exception path outside every path, at the exceptionPath key", () => {
    expect(
      runnerModuleSchema.safeParse({
        exceptionPath: "unknown-path",
        run: resolvesEmpty,
        conform: resolvesEmpty,
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["exceptionPath"] }] } });
  });

  it("refuses a standalone module with no run, at the run key", () => {
    expect(
      runnerModuleSchema.safeParse({
        exceptionPath: "standalone",
        conform: resolvesEmpty,
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["run"] }] } });
  });
});
