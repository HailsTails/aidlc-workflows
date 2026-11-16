import { expect, test } from "bun:test";
import { modelCapFor } from "./model-cap-for.ts";

test("a write cap overrides memory and reports its source", () => {
  expect(modelCapFor({ mode: "build", environment: { cap: "balanced", presence: "set" }, memory: "templated" }))
    .toEqual({ cap: "balanced", source: "environment", environment: "applied" });
});

test("check ignores the invocation cap while retaining repository memory", () => {
  expect(modelCapFor({ mode: "check", environment: { cap: "balanced", presence: "set" }, memory: "templated" }))
    .toEqual({ cap: "templated", source: "memory", environment: "ignored" });
  expect(modelCapFor({ mode: "check", environment: { cap: null, presence: "set" }, memory: null }))
    .toEqual({ cap: null, source: null, environment: "ignored" });
});

test.each(["build", "check"] as const)("%s uses memory or no cap when the environment is absent", (mode) => {
  expect(modelCapFor({ mode, environment: { cap: null, presence: "unset" }, memory: "balanced" }))
    .toEqual({ cap: "balanced", source: "memory", environment: "unset" });
  expect(modelCapFor({ mode, environment: { cap: null, presence: "unset" }, memory: null }))
    .toEqual({ cap: null, source: null, environment: "unset" });
});
