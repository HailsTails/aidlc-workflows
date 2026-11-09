import { expect, mock, test } from "bun:test";
import { accepted } from "../../kernel/result.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import type { CapturedMethodFiles, FrontmatterParser } from "../application/ports.ts";
import { createMethodContentDecoder } from "./method-content-decoder.ts";

const files: CapturedMethodFiles = {
  stages: [], agents: [], scopes: [], sensors: [], rules: [], knowledge: [],
};
const outliner = { outline: (text: string) => ({ text, headings: [] }) };

test("empty captures decode without invoking the YAML parser", async () => {
  const parse = mock<FrontmatterParser["parse"]>(() => accepted({}));
  const decoder = createMethodContentDecoder({ parser: { parse }, outliner });
  expect(await decoder.decodeCore(files)).toEqual({ ok: true, value: {
    core: { stages: [], agents: [], scopes: [], memberships: [], freeformDefaults: [],
      sensors: [], rules: [], knowledge: [], hooks: [] }, files: [],
  } });
  expect(parse).not.toHaveBeenCalled();
});

test("plugin identity failures retain the captured directory before Markdown decoding", async () => {
  const parse = mock<FrontmatterParser["parse"]>(() => accepted({}));
  const decoder = createMethodContentDecoder({ parser: { parse }, outliner });
  expect(await decoder.decodeContribution({ directory: "folder-name", files: [], methodFiles: files,
    manifest: { within: source(".aidlc-plugin/plugin.json"), content: { kind: "text", text:
      '{"name":"core","version":"1","description":"","aidlc":{"contributes":{}}}' } },
  })).toEqual({ ok: false, refusal: [{ kind: "core-namespace-claimed", plugin: "core" }] });
  expect(parse).not.toHaveBeenCalled();
});
