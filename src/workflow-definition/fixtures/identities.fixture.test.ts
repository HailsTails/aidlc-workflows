import { describe, expect, test } from "bun:test";
import { agent, artifact, rule, scope, scopes, sensor, stage } from "./identities.fixture.ts";

describe("workflow identity fixtures", () => {
  test("stage returns a stage slug", () => {
    expect(stage("code-generation")).toBe<string>("code-generation");
  });

  test("stage throws for a slug that is not kebab case", () => {
    expect(() => stage("Code-generation")).toThrow(
      'Fixture value refused: {"kind":"invalid-identity","identity":"stage",' +
        '"raw":"Code-generation"}',
    );
  });

  test("scope returns a scope name", () => {
    expect(scope("security-patch")).toBe<string>("security-patch");
  });

  test("scopes returns each scope name in order", () => {
    expect(scopes("enterprise", "feature", "mvp")).toEqual<readonly string[]>([
      "enterprise",
      "feature",
      "mvp",
    ]);
  });

  test("scopes throws when any name is refused", () => {
    expect(() => scopes("feature", "new feature")).toThrow(
      'Fixture value refused: {"kind":"invalid-identity","identity":"scope","raw":"new feature"}',
    );
  });

  test("agent returns an agent slug", () => {
    expect(agent("aidlc-developer-agent")).toBe<string>("aidlc-developer-agent");
  });

  test("artifact returns an artifact name", () => {
    expect(artifact("code-generation-plan")).toBe<string>("code-generation-plan");
  });

  test("sensor returns a sensor id", () => {
    expect(sensor("required-sections")).toBe<string>("required-sections");
  });

  test("rule returns a rule id", () => {
    expect(rule("phase-inception")).toBe<string>("phase-inception");
  });
});
