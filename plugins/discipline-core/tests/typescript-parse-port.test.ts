import { describe, expect, it } from "vitest";
import { auditRunnerOn, parsePortOn, syntaxErrorsOn, TYPESCRIPT_LINES } from "./typescript-parse-port.ts";

const SATISFIES_SOURCE = { "./a.ts": "export const a = {} satisfies object;\n" };

describe("the TypeScript lines of the development install", () => {
  it("lists the line core compiles against and the oldest supported release", () => {
    expect(TYPESCRIPT_LINES).toEqual(["typescript", "typescript-floor"]);
  });

  it.each([
    { line: "typescript", version: /^6\./ },
    { line: "typescript-floor", version: /^4\.8\.4$/ },
  ] as const)("loads the $line line at its own version", async ({ line, version }) => {
    expect((await parsePortOn({ line })).syntaxApi.version).toMatch(version);
  });

  it("builds the audit runner over a line", () => {
    expect(auditRunnerOn({ line: "typescript-floor" })).toMatchObject({ exceptionPath: "standalone" });
  });
});

describe("syntaxErrorsOn", () => {
  it("reports a syntax the oldest supported TypeScript cannot parse, naming the file", async () => {
    expect(await syntaxErrorsOn({ line: "typescript-floor", sources: SATISFIES_SOURCE })).toEqual(["./a.ts: ',' expected.", "./a.ts: ',' expected."]);
  });

  it("reports nothing for the same syntax on the line core compiles against", async () => {
    expect(await syntaxErrorsOn({ line: "typescript", sources: SATISFIES_SOURCE })).toEqual([]);
  });
});
