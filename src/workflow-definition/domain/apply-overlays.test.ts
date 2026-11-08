import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { pluginId } from "./identities.ts";
import type { Contribution } from "./contribution.ts";
import type { CoreContent } from "./method.ts";
import { agent } from "../fixtures/identities.fixture.ts";
import { applyOverlays } from "./apply-overlays.ts";

const content: CoreContent = { stages: [], agents: [], scopes: [], memberships: [],
  freeformDefaults: [], sensors: [], rules: [], knowledge: [], hooks: [] };
const contribution: Contribution = {
  plugin: accept(pluginId("metrics")), version: "1", description: "Metrics",
  dependsOn: [{ kind: "core" }], rulesLevel: "team",
  content: { stages: [], agents: [], scopes: [], memberships: [],
    freeformDefaults: [], sensors: [], rules: [], knowledge: [] },
  tools: { scripts: [], doctorCheck: null, commands: [] },
  overlays: [{ kind: "agent", agent: agent("missing-agent"), fragments: [
    { anchor: { kind: "end-of-body" }, order: 1, text: "Never silently invented." },
  ] }],
};
const outline = (text: string) => ({ text, headings: [] });

test("missing persona targets produce attributed findings and preserve the admitted content", () => {
  expect(applyOverlays({ content, contributions: [contribution], outline })).toMatchObject({
    content, findings: [{ kind: "overlay-dropped", plugin: "metrics", target: "agent",
      name: "missing-agent", anchor: null, reason: "missing-target" }],
  });
});

test("an empty contribution set leaves content and findings unchanged", () => {
  expect(applyOverlays({ content, contributions: [], outline })).toEqual({ content, findings: [] });
});
