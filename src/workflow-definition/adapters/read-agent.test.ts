import { accepted } from "../../kernel/result.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { expect, test } from "bun:test";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { readAgent } from "./read-agent.ts";

const source = { owner: { kind: "core" } as const,
  path: methodSource({ kind: "agent", within: "aidlc-developer-agent.md" }) };
const outliner = { outline: (text: string) => ({ text, headings: [] }) };
const raw = `---
name: aidlc-developer-agent
display_name: Developer
description: Writes the approved code
tier: judgment
---
# Developer
`;

test("core agents retain their tier and authored persona", () => {
  const admission = accept(readAgent({ source, raw, outliner, parser: { parse: () => accepted({
    name: "aidlc-developer-agent", ["display_name"]: "Developer", description: "Writes the approved code", tier: "judgment",
  }) } }));
  expect(admission.source).toBe(source.path);
  expect(admission.model).toEqual({ kind: "tier", tier: "judgment" });
  expect(admission.persona).toEqual({ text: "# Developer\n", headings: [] });
});

test("a core agent without a tier is refused by identity", () => {
  expect(readAgent({ source, outliner, parser: { parse: () => accepted({
    name: "aidlc-developer-agent", ["display_name"]: "Developer", description: "Writes the approved code",
  }) }, raw: `---
name: aidlc-developer-agent
display_name: Developer
description: Writes the approved code
---
# Developer
` })).toEqual({ ok: false, refusal: [{ kind: "core-agent-without-tier", source }] });
});
