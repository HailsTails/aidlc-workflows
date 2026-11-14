import { expect, test } from "bun:test";
import { sourcePath } from "../../kernel/values.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { accepted } from "../../kernel/result.ts";
import { readPluginContent } from "./read-plugin-content.ts";

const outliner = { outline: (text: string) => ({ text, headings: [] }) };
const parser = { parse: () => accepted({}) };
const methodFiles = { stages: [], agents: [], scopes: [], sensors: [], rules: [], knowledge: [] };
const reservedSources = [
  { directory: "metrics", name: "core", refused: "core" },
  { directory: "metrics", name: "aidlc", refused: "aidlc" },
  { directory: "metrics", name: "aidlc-extra", refused: "aidlc-extra" },
  { directory: "core", name: "metrics", refused: "core" },
  { directory: "aidlc", name: "metrics", refused: "aidlc" },
  { directory: "aidlc-extra", name: "metrics", refused: "aidlc-extra" },
];

test.each(reservedSources)("reserved folder or manifest names share one typed refusal: %j",
  async ({ directory, name, refused }) => {
    expect(await readPluginContent({ outliner, parser, capture: { directory, files: [], methodFiles, manifest: {
      within: accept(sourcePath(".aidlc-plugin/plugin.json")),
      content: { kind: "text", text: JSON.stringify({
        name, version: "1", description: "", aidlc: { contributes: {} },
      }) },
    } } })).toEqual<unknown>({ ok: false, refusal: [{ kind: "core-namespace-claimed", plugin: refused }] });
  });

test("an ordinary folder may retain a separate admitted manifest identity", async () => {
  const reading = accept(await readPluginContent({ outliner, parser, capture: {
    directory: "folder-name", files: [], methodFiles, manifest: {
      within: accept(sourcePath(".aidlc-plugin/plugin.json")),
      content: { kind: "text", text:
        '{"name":"metrics","version":"1","description":"","aidlc":{"contributes":{}}}' },
    },
  } }));
  expect(reading.plugin).toBe<string>("metrics");
  expect(reading.content.stages).toEqual<unknown>([]);
});

test("a malformed folder refuses through identity admission", async () => {
  expect(await readPluginContent({ outliner, parser, capture: {
    directory: "Bad Name", files: [], methodFiles, manifest: {
      within: accept(sourcePath(".aidlc-plugin/plugin.json")),
      content: { kind: "text", text:
        '{"name":"metrics","version":"1","description":"","aidlc":{"contributes":{}}}' },
    },
  } })).toEqual<unknown>({ ok: false, refusal: [{ kind: "invalid-file",
    location: { kind: "plugin-manifest", plugin: "Bad Name" },
    issues: ["Invalid plugin identity."] }] });
});

test("captured plugin rules retain phase layers and declared identity without source IO", async () => {
  const reading = accept(await readPluginContent({ outliner, parser, capture: {
    directory: "folder-name", files: [], manifest: {
      within: accept(sourcePath(".aidlc-plugin/plugin.json")), content: { kind: "text", text:
        '{"name":"metrics","version":"1","description":"","aidlc":{"contributes":{},"rulesLevel":"project"}}' },
    }, methodFiles: { ...methodFiles, rules: [
      { within: accept(sourcePath("phases/inception.md")), content: { kind: "text", text: "# Phase\n" } },
      { within: accept(sourcePath("rules.md")), content: { kind: "text", text: "# Rules\n" } },
    ] },
  } }));
  expect(reading.plugin).toBe<string>("metrics");
  expect(reading.content.rules).toMatchObject([
    { id: "metrics/phases/inception", layer: { kind: "phase", phase: "inception" } },
    { id: "metrics/rules", layer: { kind: "project" } },
  ]);
  expect(reading.files).toEqual<unknown>([
    { owner: { kind: "plugin", plugin: "metrics" }, path: "memory/phases/inception.md",
      content: { kind: "text", text: "# Phase\n" } },
    { owner: { kind: "plugin", plugin: "metrics" }, path: "memory/rules.md",
      content: { kind: "text", text: "# Rules\n" } },
  ]);
});