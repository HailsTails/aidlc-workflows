import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import type { MethodSourceReader, MethodSources, PluginSelectionSource } from "./ports.ts";
import type { CompileMethod } from "./use-cases.ts";
import { methodSliceFixture } from "../fixtures/method.fixture.ts";
import { createMethodLoader } from "./create-method-loader.ts";

const sources: MethodSources = {
  core: { stages: [], agents: [], scopes: [], memberships: [], freeformDefaults: [],
    sensors: [], rules: [], knowledge: [], hooks: [] },
  contributions: [], saved: [], pins: [], files: [], plugins: [],
};

test("the loader reads once and compiles the selected authored input", async () => {
  const readAuthored = mock<MethodSourceReader["readAuthored"]>(async () => accepted(sources));
  const readSelection = mock<PluginSelectionSource["readSelection"]>(async () => ({ kind: "only", core: "excluded", plugins: [] }));
  const compile = mock<CompileMethod["compile"]>(() => accepted(methodSliceFixture));
  const loader = createMethodLoader({ reader: { readAuthored }, selection: { readSelection },
    compiler: { compile } });
  expect(await loader.loadAuthored()).toEqual({ ok: true, value: methodSliceFixture });
  expect(readAuthored).toHaveBeenCalledTimes(1);
  expect(readSelection).toHaveBeenCalledTimes(1);
  expect(compile).toHaveBeenCalledWith({ core: sources.core, contributions: [],
    saved: [], pins: [], selection: { kind: "only", core: "excluded", plugins: [] } });
});

test("source refusal prevents selection and compilation", async () => {
  const readAuthored = mock<MethodSourceReader["readAuthored"]>(async () =>
    refused([{ kind: "core-namespace-claimed", plugin: "core" }]));
  const readSelection = mock<PluginSelectionSource["readSelection"]>(async () => ({ kind: "only", core: "excluded", plugins: [] }));
  const compile = mock<CompileMethod["compile"]>(() => accepted(methodSliceFixture));
  expect(await createMethodLoader({ reader: { readAuthored }, selection: { readSelection },
    compiler: { compile } }).loadAuthored()).toEqual({ ok: false,
    refusal: [{ kind: "core-namespace-claimed", plugin: "core" }] });
  expect(readSelection).not.toHaveBeenCalled();
  expect(compile).not.toHaveBeenCalled();
});

test("the compiler's refusal is returned unchanged", async () => {
  const readAuthored = mock<MethodSourceReader["readAuthored"]>(async () => accepted(sources));
  const readSelection = mock<PluginSelectionSource["readSelection"]>(async () => ({ kind: "every-installed" }));
  const compile = mock<CompileMethod["compile"]>(() => refused([{ kind: "requires-cycle", stages: [] }]));
  expect(await createMethodLoader({ reader: { readAuthored }, selection: { readSelection },
    compiler: { compile } }).loadAuthored()).toEqual({ ok: false,
    refusal: [{ kind: "requires-cycle", stages: [] }] });
});
