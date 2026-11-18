import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host, path } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import type { BuildProjection } from "./ports/build-projection.ts";
import { createCapturedMethodCompiler } from "./compile-captured-method.ts";

const compiled = { graph: "literal graph\r\n", grid: "literal grid\n" };
const target = { name: "scratch", directory: ".scratch", memoryRoot: "aidlc/spaces/default/memory" };

test("raw distribution refusal wins over invalid directory and memory without serialization", () => {
  const serializeMethod = mock<BuildProjection["serializeMethod"]>().mockReturnValue(compiled);
  const compile = createCapturedMethodCompiler({ method: methodSliceFixture, serializeMethod });
  expect(compile({ name: "../invalid", directory: "../bad", memoryRoot: "../memory" }))
    .toEqual(refused({ kind: "invalid-distribution-id", raw: "../invalid" }));
  expect(serializeMethod).not.toHaveBeenCalled();
});

test("raw directory refusal wins over invalid memory without serialization", () => {
  const serializeMethod = mock<BuildProjection["serializeMethod"]>().mockReturnValue(compiled);
  const compile = createCapturedMethodCompiler({ method: methodSliceFixture, serializeMethod });
  expect(compile({ ...target, directory: "../bad", memoryRoot: "../memory" }))
    .toEqual(refused({ kind: "invalid-path", base: "project", raw: "../bad" }));
  expect(serializeMethod).not.toHaveBeenCalled();
});

test("raw memory refusal prevents serialization after the admitted host", () => {
  const serializeMethod = mock<BuildProjection["serializeMethod"]>().mockReturnValue(compiled);
  const compile = createCapturedMethodCompiler({ method: methodSliceFixture, serializeMethod });
  expect(compile({ ...target, memoryRoot: "../memory" }))
    .toEqual(refused({ kind: "invalid-path", base: "project", raw: "../memory" }));
  expect(serializeMethod).not.toHaveBeenCalled();
});

test("one already captured Method is serialized with admitted host and memory facts", () => {
  const serializeMethod = mock<BuildProjection["serializeMethod"]>().mockReturnValue(compiled);
  const compile = createCapturedMethodCompiler({ method: methodSliceFixture, serializeMethod });
  expect(compile(target)).toEqual(accepted(compiled));
  expect(serializeMethod).toHaveBeenCalledTimes(1);
  expect(serializeMethod).toHaveBeenCalledWith({ method: methodSliceFixture,
    host: host({ name: "scratch", directory: ".scratch" }), memoryRoot: path("aidlc/spaces/default/memory") });
});
