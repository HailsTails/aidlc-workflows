import { describe, expect, mock, test } from "bun:test";
import { createKiroIdeAgents, kiroIdePermissionLines, type KiroIdePersonaRendering } from "./agent-renderer.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { brand } from "../../../kernel/brand.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { host } from "../../../kernel/fixtures/values.fixture.ts";
import { agent } from "../../../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../../../workflow-definition/fixtures/method-source.fixture.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { SCRATCH_AGENT_INPUTS } from "../../../projection/fixtures/scratch-host.fixture.ts";
import { DELEGATE_SHELL_FACTS } from "../../../projection/fixtures/delegate-shell-facts.fixture.ts";

const architect: Agent = {
  slug: agent("aidlc-architect-agent"), source: methodSource({ kind: "agent", within: "aidlc-architect-agent.md" }),
  displayName: "Architect", description: "Architecture", owner: { kind: "core" },
  model: { kind: "tier", tier: "judgment" }, examples: [], tools: { disallowed: ["Task"] }, maxTurns: null,
  persona: { text: "# Architect\n", headings: [] }, additions: { afterPreflight: [], endOfBody: [] },
};

const surfaced = "---\nname: architect\nmodel: selected\n---\nRead .kiro/steering/project.md.\n";

test("Kiro IDE gives its persona port the exact in-parts model and native policy profile", () => {
  const documents = mock(() => accepted(surfaced));
  const admittedVerbs = mock(DELEGATE_SHELL_FACTS.admittedVerbs);
  const personas = mock<KiroIdePersonaRendering>(() => () => accepted([]));
  createKiroIdeAgents({ personas })({ ...SCRATCH_AGENT_INPUTS,
    host: host({ name: "kiro-ide", directory: ".kiro" }), documents,
    delegateShellFacts: { ...DELEGATE_SHELL_FACTS, admittedVerbs, dispatcherCommands: ["--fixture"] },
  });
  expect(personas).toHaveBeenCalledTimes(1);
  const profile = personas.mock.calls[0]?.[0];
  expect(profile?.modelSurface({ agent: architect, removeKeys: ["disallowedTools"] })).toEqual(accepted(surfaced));
  expect(documents).toHaveBeenCalledWith({ agent: architect,
    text: "authored-file", knowledge: "absorbed", reading: "in-parts",
    frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain",
      insertBeforeKeys: [], removeKeys: ["disallowedTools"], afterProjectionLines: [] },
  });
  expect(profile?.promptLines(architect)).toContain('        - "bun .kiro/tools/aidlc.ts --fixture"');
  expect(admittedVerbs).toHaveBeenCalledWith("aidlc-architect-agent");
  expect(profile?.inlineReading(architect)).toBe("reads-inline");
});

test("Kiro IDE derives inline leads and supports from the admitted Method", () => {
  const personas = mock<KiroIdePersonaRendering>(() => () => accepted([]));
  createKiroIdeAgents({ personas })({ ...SCRATCH_AGENT_INPUTS, method: methodSliceFixture });
  const profile = personas.mock.calls[0]?.[0];
  expect(profile?.inlineReading(architect)).toBe("reads-inline");
  expect(profile?.inlineReading({ ...architect, slug: agent("aidlc-delivery-agent") })).toBe("reads-inline");
  expect(profile?.inlineReading({ ...architect, slug: agent("aidlc-developer-agent") })).toBe("dispatched-only");
});

test("Kiro IDE leaves an agent dispatched when the admitted Method has no inline stage", () => {
  const personas = mock<KiroIdePersonaRendering>(() => () => accepted([]));
  const method = brand<Method>({ ...methodSliceFixture, stages: [] });
  createKiroIdeAgents({ personas })({ ...SCRATCH_AGENT_INPUTS, method });
  expect(personas.mock.calls[0]?.[0].inlineReading(architect)).toBe("dispatched-only");
});

test("Kiro IDE preserves its document refusal and uses the persona port's exact renderer", () => {
  const failure = { kind: "render-failed", concept: "agent", name: "aidlc-architect-agent", reason: "No source." } as const;
  const renderAgent = mock(() => refused(failure));
  const personas = mock<KiroIdePersonaRendering>(() => renderAgent);
  const rendering = createKiroIdeAgents({ personas })({ ...SCRATCH_AGENT_INPUTS, documents: () => refused(failure) });
  expect(personas.mock.calls[0]?.[0].modelSurface({ agent: architect, removeKeys: [] })).toEqual(refused(failure));
  expect(rendering.renderAgent).toBe(renderAgent);
  expect(rendering.renderAgent({ agent: architect, knowledge: [] })).toEqual(refused(failure));
  expect(renderAgent).toHaveBeenCalledWith({ agent: architect, knowledge: [] });
});

const policy = { shellDeny: () => ["    - capability: shell", "      effect: deny",
  "      match:", '        - "forbidden engine route"'], riskyForms: ["$", ">"] };

const expectedLines = [
  'tools: ["read", "write", "shell"]', "includeMcpJson: true", "permissions:", "  rules:",
  "    - capability: shell", "      effect: allow", "      match:",
  '        - "bun .kiro/tools/aidlc-*"', '        - "bun .kiro/tools/aidlc.ts engine *"',
  '        - "bun --version"', "    - capability: shell", "      effect: ask", "      match:",
  '        - "bun .kiro/tools/aidlc.ts engine config set *"',
  '        - "bun .kiro/tools/aidlc.ts engine adapter *"',
  '        - "bun .kiro/tools/aidlc*$*"', '        - "bun .kiro/tools/aidlc*>*"',
  "    - capability: shell", "      effect: deny", "      match:", '        - "forbidden engine route"',
  "    - capability: fs_read", "      effect: allow", "      match:", '        - "**"',
  "    - capability: filesystem", "      effect: allow", "      match:",
  '        - "aidlc/spaces/**"', '        - ".aidlc/worktrees/*/aidlc/spaces/**"',
  "    - capability: fs_write", "      effect: deny", "      match:",
  '        - ".kiro/**"', '        - "aidlc/.aidlc-sessions/**"',
  '        - "aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**"',
];

describe("Kiro IDE persona permissions", () => {
  test("preserves tools, asks, shell denials, workspace writes and engine protection in order", () => {
    expect(kiroIdePermissionLines(policy)("aidlc-architect-agent")).toEqual(expectedLines);
  });

  test("limits the composer to its proposal while preserving every other permission", () => {
    expect(kiroIdePermissionLines(policy)("aidlc-composer-agent")).toEqual(
      [
        'tools: ["read", "write", "shell"]', "includeMcpJson: true", "permissions:", "  rules:",
        "    - capability: shell", "      effect: allow", "      match:",
        '        - "bun .kiro/tools/aidlc-*"', '        - "bun .kiro/tools/aidlc.ts engine *"',
        '        - "bun --version"', "    - capability: shell", "      effect: ask", "      match:",
        '        - "bun .kiro/tools/aidlc.ts engine config set *"',
        '        - "bun .kiro/tools/aidlc.ts engine adapter *"',
        '        - "bun .kiro/tools/aidlc*$*"', '        - "bun .kiro/tools/aidlc*>*"',
        "    - capability: shell", "      effect: deny", "      match:", '        - "forbidden engine route"',
        "    - capability: fs_read", "      effect: allow", "      match:", '        - "**"',
        "    - capability: filesystem", "      effect: allow", "      match:",
        '        - "aidlc/spaces/*/intents/.aidlc-engine/composer-proposal.json"',
        "    - capability: fs_write", "      effect: deny", "      match:",
        '        - ".kiro/**"', '        - "aidlc/.aidlc-sessions/**"',
        '        - "aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**"',
    ]);
  });

  test("uses the same owner for plugin personas and asks its shell policy for their name", () => {
    const shellDeny = mock(policy.shellDeny);
    expect(kiroIdePermissionLines({ ...policy, shellDeny })("plugin-agent")).toEqual(expectedLines);
    expect(shellDeny).toHaveBeenCalledWith("plugin-agent");
  });
});

test("the native persona factory uses legacy allow and ask bytes while retaining the DS deny owner", () => {
  const personas = mock<KiroIdePersonaRendering>(() => () => accepted([]));
  createKiroIdeAgents({ personas })({ ...SCRATCH_AGENT_INPUTS, channel: "native",
    host: host({ name: "kiro-ide", directory: ".kiro" }), delegateShellFacts: DELEGATE_SHELL_FACTS });
  expect(personas.mock.calls[0]?.[0].promptLines(architect)).toEqual(["tools: [\"read\", \"write\", \"shell\"]","includeMcpJson: true","permissions:","  rules:","    - capability: shell","      effect: allow","      match:","        - \"aidlc engine *\"","        - \"bun --version\"","    - capability: shell","      effect: ask","      match:","        - \"aidlc engine config set *\"","        - \"aidlc engine adapter *\"","        - \"aidlc*$*\"","        - \"aidlc*`*\"","        - \"aidlc*>*\"","        - \"aidlc*<*\"","        - \"aidlc*&*\"","        - \"aidlc*@(*\"","        - \"aidlc*@{*\"","        - \"aidlc*\\n*\"",   "    - capability: shell", "      effect: deny", "      match:",
  '        - "bun .kiro/tools/aidlc-*"', '        - "bun .kiro/tools/aidlc.ts engine *"', "      exclude:",
  "    - capability: shell", "      effect: deny", "      match:",
  '        - "bun .kiro/tools/aidlc*$*"', '        - "bun .kiro/tools/aidlc*`*"',
  '        - "bun .kiro/tools/aidlc*>*"', '        - "bun .kiro/tools/aidlc*<*"',
  '        - "bun .kiro/tools/aidlc*&*"', '        - "bun .kiro/tools/aidlc*@(*"',
  '        - "bun .kiro/tools/aidlc*@{*"', '        - "bun .kiro/tools/aidlc*\\n*"',
  "    - capability: fs_read", "      effect: allow", "      match:", '        - "**"',
  "    - capability: filesystem", "      effect: allow", "      match:",
  '        - "aidlc/spaces/**"', '        - ".aidlc/worktrees/*/aidlc/spaces/**"',
  "    - capability: fs_write", "      effect: deny", "      match:",
  '        - ".kiro/**"', '        - "aidlc/.aidlc-sessions/**"',
  '        - "aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**"',
]);
});
