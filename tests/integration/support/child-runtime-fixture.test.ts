import { afterEach, expect, test } from "bun:test";
import { appendRuntimeSource, createRuntimeSourceFixtures, removeRuntimeSourceFixture, runtimeFixtureExists, runtimeFixtureText, setRuntimeCallback } from "./child-runtime-fixture.ts";

const fixtures = createRuntimeSourceFixtures();
afterEach(fixtures.cleanup);

test("runtime fixture appends exact text without discarding the source", () => {
  const fixture = fixtures.create();
  const before = runtimeFixtureText({ root: fixture, relative: "package.json" });
  appendRuntimeSource({ root: fixture, relative: "package.json", text: "probe" });
  expect(runtimeFixtureText({ root: fixture, relative: "package.json" })).toBe(`${before}\nprobe\n`);
});

test("runtime callback fixture retains the authored emitter before the injected action", () => {
  const fixture = fixtures.create();
  setRuntimeCallback({ root: fixture, text: "callbackProbe(ctx);" });
  expect(runtimeFixtureText({ root: fixture, relative: "harness/claude/manifest.ts" })).toContain("manifest.emit = ctx => { prior?.(ctx); count++; callbackProbe(ctx); }; export default manifest;");
});

test("runtime fixture cleanup removes its owned source directory", () => {
  const fixture = fixtures.create();
  expect(runtimeFixtureExists(fixture)).toBe(true);
  removeRuntimeSourceFixture(fixture);
  expect(runtimeFixtureExists(fixture)).toBe(false);
});
