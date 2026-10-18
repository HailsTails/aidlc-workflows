import { describe, expect, it } from "vitest";
import { runnerModuleSchema } from "./runner-module-schema.ts";
import { embeddedRunnerModuleSchema } from "./runner-module-schema.ts";

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

const EMBEDDED_MODULE = {
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: resolvesEmpty,
  conform: resolvesEmpty,
  project: resolvesEmpty,
};

describe("embeddedRunnerModuleSchema", () => {
  it("accepts an embedded module with its projected kinds and three call members, keeping every member", () => {
    expect(embeddedRunnerModuleSchema.safeParse(EMBEDDED_MODULE)).toMatchObject({
      success: true,
      data: {
        exceptionPath: "embedded",
        projectedKinds: ["config-override"],
        run: expect.any(Function),
        conform: expect.any(Function),
        project: expect.any(Function),
      },
    });
  });

  it("accepts an embedded module whose projection writes no native-exception kind, keeping project", () => {
    expect(
      embeddedRunnerModuleSchema.safeParse({ ...EMBEDDED_MODULE, projectedKinds: [] }),
    ).toMatchObject({ success: true, data: { projectedKinds: [], project: expect.any(Function) } });
  });

  it("refuses an embedded module with no project, at the project key", () => {
    expect(
      embeddedRunnerModuleSchema.safeParse({
        exceptionPath: "embedded",
        projectedKinds: ["config-override"],
        run: resolvesEmpty,
        conform: resolvesEmpty,
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["project"] }] } });
  });

  it("refuses an embedded module whose project is not a function, at the project key", () => {
    expect(
      embeddedRunnerModuleSchema.safeParse({ ...EMBEDDED_MODULE, project: "project" }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["project"] }] } });
  });

  it("refuses an embedded module with no projected kinds, at the projectedKinds key", () => {
    expect(
      embeddedRunnerModuleSchema.safeParse({
        exceptionPath: "embedded",
        run: resolvesEmpty,
        conform: resolvesEmpty,
        project: resolvesEmpty,
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["projectedKinds"] }] } });
  });

  it("refuses a projected kind outside the native-exception kinds, at that entry", () => {
    expect(
      embeddedRunnerModuleSchema.safeParse({ ...EMBEDDED_MODULE, projectedKinds: ["baseline"] }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["projectedKinds", 0] }] } });
  });
});

describe("runnerModuleSchema with the embedded member", () => {
  it("accepts an embedded module through the runner module union", () => {
    expect(runnerModuleSchema.safeParse(EMBEDDED_MODULE)).toMatchObject({
      success: true,
      data: { exceptionPath: "embedded", projectedKinds: ["config-override"], project: expect.any(Function) },
    });
  });

  it("refuses an embedded module with no project through the union, at the project key", () => {
    expect(
      runnerModuleSchema.safeParse({
        exceptionPath: "embedded",
        projectedKinds: ["config-override"],
        run: resolvesEmpty,
        conform: resolvesEmpty,
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["project"] }] } });
  });
});
