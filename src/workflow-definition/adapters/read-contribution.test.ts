import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { sourcePath } from "../../kernel/values.ts";
import { readContribution } from "./read-contribution.ts";

const outliner = { outline: (text: string) => ({ text, headings: [] }) };
const manifest = { within: accept(sourcePath("plugin.json")), content: { kind: "text" as const,
  text: '{"name":"metrics","version":"1","description":"Metrics","dependencies":["core","reports"],"aidlc":{"contributes":{},"commands":{"inspect":{"script":"tools/inspect.ts","description":"Inspect"}}}}' } };
const capture = { directory: "metrics", manifest, files: [
  { within: accept(sourcePath("tools/metrics-doctor.ts")),
    content: { kind: "text" as const, text: "doctor" } },
  { within: accept(sourcePath("tools/inspect.ts")),
    content: { kind: "text" as const, text: "inspect" } },
] };

test("contribution admission retains dependencies and declared tool ownership", async () => {
  const reading = accept(await readContribution({ capture, outliner }));
  expect(reading.contribution.dependsOn).toEqual<readonly { kind: string; plugin?: string }[]>([
    { kind: "core" }, { kind: "plugin", plugin: "reports" },
  ]);
  expect(reading.contribution.tools).toMatchObject({
    scripts: ["tools/metrics-doctor.ts", "tools/inspect.ts"],
    doctorCheck: "tools/metrics-doctor.ts",
    commands: [{ name: "inspect", script: "tools/inspect.ts", description: "Inspect" }],
  });
  expect(reading.contribution.overlays).toEqual([]);
});

test("invalid dependency identity refuses at the plugin manifest", async () => {
  const invalid = { ...capture, manifest: { ...manifest, content: { kind: "text" as const,
    text: '{"name":"metrics","version":"1","description":"","dependencies":["Bad Name"],"aidlc":{"contributes":{}}}' } } };
  expect(await readContribution({ capture: invalid, outliner })).toEqual({
    ok: false, refusal: [{ kind: "invalid-file",
      location: { kind: "plugin-manifest", plugin: "metrics" },
      issues: ["Invalid plugin dependency: Bad Name"] }],
  });
});
