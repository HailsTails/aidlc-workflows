import { describe, expect, test } from "bun:test";
import type { Accepted } from "../../kernel/result.ts";
import {
  agentSlug,
  artifactName,
  hookName,
  pluginId,
  ruleId,
  scopeName,
  sensorId,
  stageSlug,
} from "./identities.ts";

const NOT_KEBAB = [
  { shape: "an upper-case letter", raw: "Code-generation" },
  { shape: "a leading digit", raw: "3-code-generation" },
  { shape: "an underscore", raw: "code_generation" },
  { shape: "a slash", raw: "construction/code-generation" },
  { shape: "an empty name", raw: "" },
];

describe("stageSlug", () => {
  test("accepts a kebab-case stage slug", () => {
    expect(stageSlug("code-generation")).toEqual<Accepted<string>>({
      ok: true,
      value: "code-generation",
    });
  });

  test.each(NOT_KEBAB)("refuses $shape", ({ raw }) => {
    expect(stageSlug(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-identity", identity: "stage", raw },
    });
  });
});

describe("agentSlug", () => {
  test("accepts a kebab-case agent slug", () => {
    expect(agentSlug("aidlc-developer-agent")).toEqual<Accepted<string>>({
      ok: true,
      value: "aidlc-developer-agent",
    });
  });

  test.each(NOT_KEBAB)("refuses $shape", ({ raw }) => {
    expect(agentSlug(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-identity", identity: "agent", raw },
    });
  });
});

describe("artifactName", () => {
  test("accepts a kebab-case artifact name", () => {
    expect(artifactName("code-generation-plan")).toEqual<Accepted<string>>({
      ok: true,
      value: "code-generation-plan",
    });
  });

  test.each(NOT_KEBAB)("refuses $shape", ({ raw }) => {
    expect(artifactName(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-identity", identity: "artifact", raw },
    });
  });
});

describe("sensorId", () => {
  test("accepts a kebab-case sensor id", () => {
    expect(sensorId("required-sections")).toEqual<Accepted<string>>({
      ok: true,
      value: "required-sections",
    });
  });

  test.each(NOT_KEBAB)("refuses $shape", ({ raw }) => {
    expect(sensorId(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-identity", identity: "sensor", raw },
    });
  });
});

describe("hookName", () => {
  test("accepts a kebab-case hook name", () => {
    expect(hookName("record-human-turn")).toEqual<Accepted<string>>({
      ok: true,
      value: "record-human-turn",
    });
  });

  test.each(NOT_KEBAB)("refuses $shape", ({ raw }) => {
    expect(hookName(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-identity", identity: "hook", raw },
    });
  });
});

describe("scopeName", () => {
  test.each([
    { shape: "a core scope", raw: "security-patch" },
    { shape: "a plugin scope", raw: "test-pro-validation" },
    { shape: "upper case, dots, plus and at signs", raw: "Team.Payments+v2@eu" },
    { shape: "a leading digit", raw: "2026-q4" },
  ])("accepts $shape", ({ raw }) => {
    expect(scopeName(raw)).toEqual<Accepted<string>>({ ok: true, value: raw });
  });

  test.each([
    { shape: "a leading dash", raw: "-feature" },
    { shape: "a leading dot", raw: ".feature" },
    { shape: "a space", raw: "new feature" },
    { shape: "a slash", raw: "team/feature" },
    { shape: "an empty name", raw: "" },
  ])("refuses $shape", ({ raw }) => {
    expect(scopeName(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-identity", identity: "scope", raw },
    });
  });
});

describe("ruleId", () => {
  test.each([
    { shape: "a layer rule", raw: "team" },
    { shape: "a phase rule", raw: "phase-inception" },
    { shape: "a nested rule", raw: "test-pro/phases/inception" },
  ])("accepts $shape", ({ raw }) => {
    expect(ruleId(raw)).toEqual<Accepted<string>>({ ok: true, value: raw });
  });

  test.each([
    { shape: "a trailing slash", raw: "phases/" },
    { shape: "an empty segment", raw: "phases//inception" },
    { shape: "an upper-case letter", raw: "Team" },
    { shape: "a file extension", raw: "team.md" },
  ])("refuses $shape", ({ raw }) => {
    expect(ruleId(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-identity", identity: "rule", raw },
    });
  });
});

describe("pluginId", () => {
  test("accepts a kebab-case plugin id", () => {
    expect(pluginId("test-pro")).toEqual<Accepted<string>>({ ok: true, value: "test-pro" });
  });

  test.each([
    { shape: "the core namespace", raw: "aidlc-test-pro" },
    { shape: "an upper-case letter", raw: "Test-pro" },
    { shape: "an underscore", raw: "test_pro" },
    { shape: "an empty id", raw: "" },
  ])("refuses $shape", ({ raw }) => {
    expect(pluginId(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-identity", identity: "plugin", raw },
    });
  });
});
