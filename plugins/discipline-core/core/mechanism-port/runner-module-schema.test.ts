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

  it("refuses a module with no exception path", () => {
    expect(
      runnerModuleSchema.safeParse({
        run: resolvesEmpty,
        conform: resolvesEmpty,
      }).success,
    ).toBe(false);
  });

  it("refuses a standalone module with no run, at the run key", () => {
    expect(
      runnerModuleSchema.safeParse({
        exceptionPath: "standalone",
        conform: resolvesEmpty,
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["run"] }] } });
  });

  it("refuses a standalone module with no conform, at the conform key", () => {
    expect(
      runnerModuleSchema.safeParse({
        exceptionPath: "standalone",
        run: resolvesEmpty,
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["conform"] }] } });
  });

  it("refuses a standalone module whose run is not a function, at the run key", () => {
    expect(
      runnerModuleSchema.safeParse({
        exceptionPath: "standalone",
        run: "run",
        conform: resolvesEmpty,
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["run"] }] } });
  });

  it("refuses a standalone module whose conform is not a function, at the conform key", () => {
    expect(
      runnerModuleSchema.safeParse({
        exceptionPath: "standalone",
        run: resolvesEmpty,
        conform: { cases: [] },
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["conform"] }] } });
  });

  it("refuses a module that is not an object", () => {
    expect(runnerModuleSchema.safeParse(undefined).success).toBe(false);
  });
});
