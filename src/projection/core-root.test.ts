import { expect, test } from "bun:test";
import { host, path } from "../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../workflow-definition/fixtures/method.fixture.ts";
import { serializeCompiledMethod } from "./core-root.ts";

test("the Projection root exposes runtime graph and grid bytes for an accepted Method", () => {
  const compiled = serializeCompiledMethod({ method: methodSliceFixture,
    host: host({ name: "claude", directory: ".claude" }),
    memoryRoot: path("aidlc/spaces/default/memory") });
  expect(JSON.parse(compiled.graph)).toHaveLength(3);
  expect(JSON.parse(compiled.graph)[0]).toMatchObject({ slug: "requirements-analysis", number: "2.3" });
  expect(JSON.parse(compiled.grid)).toMatchObject({ feature: { stages: {
    "requirements-analysis": "EXECUTE", "code-generation": "EXECUTE" } } });
  expect(compiled.graph).toContain(".claude/sensors/");
});
