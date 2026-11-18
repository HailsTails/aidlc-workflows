


import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  declaredSlots,
  renderNeutralOnboarding as renderNeutral,
  renderOnboarding as renderForHost,
} from "../../src/projection/domain/onboarding.ts";
import type { OnboardingFills } from "../../src/projection/domain/neutral-surface.ts";
import { admitOnboardingSource, bindOnboardingSource } from "../../src/projection/domain/onboardin\
g-source.ts";
import type { DistributionChannel } from "../../src/projection/domain/projected-file.ts";
import { accept } from "../../src/kernel/fixtures/accept.ts";
import { bindTemplateTokens } from "../../src/projection/domain/token-binding.ts";
import { tokenBindingsFixture } from "../../src/projection/fixtures/token-bindings.fixture.ts";
const REPO_ROOT = join(import.meta.dir, "..", "..");

function renderOnboarding(skeleton: string, fills: OnboardingFills): string {
  const rendered = renderForHost(skeleton, fills);
  if (!rendered.ok) throw new Error(rendered.refusal);
  return rendered.value;
}

function renderNeutralOnboarding(skeleton: string): string {
  const rendered = renderNeutral(skeleton);
  if (!rendered.ok) throw new Error(rendered.refusal);
  return rendered.value;
}

const NEUTRAL = readFileSync(join(REPO_ROOT, "core", "templates", "onboarding.md"), "utf-8");
const HARNESS = readFileSync(join(REPO_ROOT, "core", "templates", "onboarding-harness.md"), "utf-8\
");

function renderDeclaredOnboarding({ skeleton, fills, channel, neutral = NEUTRAL,
   invoke = "aidlc" }: {
  readonly skeleton: string; readonly fills: OnboardingFills; readonly channel: DistributionChannel;
  readonly neutral?: string; readonly invoke?: string;
}): string {
  const admitted = accept(admitOnboardingSource({ neutral, harnessSkeleton: skeleton,
    hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" }));
  const bound = bindOnboardingSource(admitted, channel);
  renderNeutralOnboarding(bound.neutral);
  return bindTemplateTokens({ text: renderOnboarding(bound.harnessSkeleton, fills),
    tokens: { ...tokenBindingsFixture({ harnessDir: ".foo" }), ["INVOKE"]: invoke }, selected: ["H\
ARNESS_DIR", "INVOKE"] });
}
const NEUTRAL_SECTIONS = [
  "## What AI-DLC does for you",
  "## Where things live",
  "## Harness onboarding",
  "## Conventions",
  "## Documentation",
  "## Session Resumption",
  "## Git Integration",
];
const HARNESS_SECTIONS = ["## Prerequisites", "## AI-DLC Structure", "## Plugins"];

function noLeftoverMarkers(rendered: string): RegExpMatchArray | null {
  return rendered.match(/\{\{[^}]+\}\}/);
}

function releasePath(path: string): string {
  return path.replace(join(REPO_ROOT, "dist"), join(REPO_ROOT, "dist-release"));
}

  test("t151 source onboarding contract > neutral onboarding is marker-free and rejects \
harness-specific tokens", () => {
    expect(noLeftoverMarkers(NEUTRAL)).toBeNull();
    expect(NEUTRAL).not.toMatch(/^# /m);
    for (const marker of ["{{HARNESS_DIR}}", "{{INVOKE}}", "{{SKILL_INVOKE}}", "{{SLOT:title_block\
}}"] ) {
      expect(() => renderNeutralOnboarding(NEUTRAL + marker)).toThrow(
        /must not contain template markers/);
    }
    expect(renderNeutralOnboarding(NEUTRAL)).toBe(NEUTRAL);
  });

  test("t151 source onboarding contract > the native skeleton exposes nine host fills and two \
independently admitted guidance positions", () => {
    expect(HARNESS).toStartWith("{{SLOT:frontmatter}}\n{{SLOT:title_block}}\n");
    const slots = declaredSlots(HARNESS);
    expect(slots).toHaveLength(11);
    expect(slots).toEqual(expect.arrayContaining([
      "agents_note",
      "framework_hook_runtime",
      "framework_tools_runtime",
      "frontmatter",
      "hook_permissions_note",
      "prereq_bullets",
      "prereq_bullets_tail",
      "sections_after_resumption",
      "sections_before_resumption",
      "structure_extra",
      "title_block",
    ]));
  });

  test.each([
    { invoke: "/aidlc", sessionCost: "/aidlc-session-cost", replay: "/aidlc-replay",
       outcomesPack: "/aidlc-outcomes-pack", knowledge: "/aidlc-knowledge", init: "/aidlc-init" },
    { invoke: "$aidlc", sessionCost: "$aidlc-session-cost", replay: "$aidlc-replay",
       outcomesPack: "$aidlc-outcomes-pack", knowledge: "$aidlc-knowledge", init: "$aidlc-init" },
  ])("t151 source onboarding contract > user-typed skill names carry the harness's skill prefix, \
not the shell invocation: %j", (skillNames) => {




    expect(HARNESS).not.toMatch(/\{\{INVOKE\}\}-/);

    const rendered = renderDeclaredOnboarding({ skeleton: HARNESS, fills: {
       invoke: skillNames.invoke, slots: {} }, channel: "copy",
          invoke: "bun .foo/tools/aidlc.ts" });
    expect(rendered).toContain(skillNames.sessionCost);
    expect(rendered).toContain(skillNames.replay);
    expect(rendered).toContain(skillNames.outcomesPack);
    expect(rendered).toContain(skillNames.knowledge);
    expect(rendered).toContain(skillNames.init);
    expect(rendered).not.toContain("aidlc.ts-");
  });

  test("t151 source onboarding contract > runtime examples on {{INVOKE}} name commands the CLI \
routes", () => {




    expect(HARNESS).not.toMatch(/\{\{INVOKE\}\} --stage /);
    expect(HARNESS).not.toMatch(/\{\{INVOKE\}\} knowledge /);
  });

  test.each([
    ["copy", { hook: "- **Hook permissions**: All 17 hooks are TypeScript (`.ts`) and run via \
`bun`. No executable bits required — works identically on macOS, Linux, and native Windows \
PowerShell.", tools: "TypeScript, run via bun" }],
    ["native", { hook: "- **Hook permissions**: Framework hooks run through the self-contained \
`aidlc` binary. No separate script runtime or executable bits are required.", tools: "TypeScript \
sources invoked through the self-contained `aidlc` runtime" }],
  ] as const)("t151 source onboarding contract > a new harness gets complete %s onboarding \
through admitted channel binding", (channel, guidance) => {
    const fills: OnboardingFills = {
      invoke: "@aidlc",
      slots: {
        ["title_block"]: "# AI-DLC on Foo CLI\n\nRun `@aidlc` to begin.",
        ["prereq_bullets"]: "- **Foo CLI**: install per its docs.",
      },
    };
    const rendered = renderDeclaredOnboarding({ skeleton: HARNESS + "\n" + NEUTRAL, fills,
       channel });
    expect(rendered).toContain("## What AI-DLC does for you");
    expect(rendered).toContain("## Where things live");
    expect(rendered).toContain("## Harness onboarding");
    expect(rendered).toContain("## Conventions");
    expect(rendered).toContain("## Documentation");
    expect(rendered).toContain("## Session Resumption");
    expect(rendered).toContain("## Git Integration");
    expect(rendered).toContain("## Prerequisites");
    expect(rendered).toContain("## AI-DLC Structure");
    expect(rendered).toContain("## Plugins");
    expect(rendered).toContain("@aidlc");
    expect(rendered).toContain(guidance.hook);
    expect(rendered).toContain(`small command-line programs (${guidance.tools})`);
    expect(noLeftoverMarkers(rendered)).toBeNull();
    expect(rendered).not.toMatch(/\n{3,}/);
  });

  test("t151 source onboarding contract > alternate source positions bind their admitted meaning \
in authored order", () => {
    expect(renderDeclaredOnboarding({ skeleton: "Tools: \
{{SLOT:framework_tools_runtime}}\n{{SLOT:framework_hook_runtime}}\n", fills: { invoke: "@aidlc",
   slots: {} }, channel: "native" }))
      .toBe("Tools: TypeScript sources invoked through the self-contained `aidlc` runtime\n- \
**Hook permissions**: Framework hooks run through the self-contained `aidlc` binary. No separate \
script runtime or executable bits are required.\n");
  });
  test("t151 source onboarding contract > combined malformed declarations precede neutral-render \
refusal with deliberate Hook then Tools order", () => {
    expect(() => renderDeclaredOnboarding({ skeleton: "Missing", fills: { invoke: "@aidlc",
       slots: {} }, channel: "copy", neutral: "{{UNKNOWN}}" }))
      .toThrow("Declared framework Hook guidance requires exactly one \
{{SLOT:framework_hook_runtime}} marker.");
    expect(() => renderDeclaredOnboarding({ skeleton: "{{SLOT:framework_hook_runtime}}", fills: {
       invoke: "@aidlc", slots: {} }, channel: "copy", neutral: "{{UNKNOWN}}" }))
      .toThrow("Declared framework Tools guidance requires exactly one \
{{SLOT:framework_tools_runtime}} marker.");
    expect(() => renderDeclaredOnboarding({ skeleton: "{{SLOT:framework_hook_runtime}}{{SLOT:frame\
work_tools_runtime}}", fills: { invoke: "@aidlc", slots: {} }, channel: "copy", neutral: "{{UNKNOW\
N}}" }))
      .toThrow("neutral onboarding must not contain template markers");
  });
  test.each(["copy", "native"] as const)("t151 source onboarding contract > legacy %s source \
retains empty and custom guidance-slot behavior", (channel) => {
    const admitted = accept(admitOnboardingSource({ neutral: NEUTRAL,
      harnessSkeleton: "Hook={{SLOT:framework_hook_runtime}}|Tools={{SLOT:framework_tools_runtime}\
}\n",
      hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" }));
    const bound = bindOnboardingSource(admitted, channel);
    expect(renderOnboarding(bound.harnessSkeleton, { invoke: "@aidlc", slots: {} })).toBe("Hook=|T\
ools=\n");
    expect(renderOnboarding(bound.harnessSkeleton, { invoke: "@aidlc", slots: { ["framework_hook_r\
untime"]: "Custom Hook", ["framework_tools_runtime"]: "Custom Tools" } }))
      .toBe("Hook=Custom Hook|Tools=Custom Tools\n");
  });

  test("t151 source onboarding contract > omitted slots disappear, and malformed fills cannot \
leak template markers", () => {
    const out = renderOnboarding(
      "# T {{SLOT:inline}} x\n\n{{SLOT:lone}}\nbody {{SKILL_INVOKE}} runs {{INVOKE}}\n",
      { invoke: "/aidlc", slots: {} },
    );
    expect(out).toBe("# T  x\n\nbody /aidlc runs {{INVOKE}}\n");
    expect(() => renderOnboarding("body {{SKILL_INVOKE}}\n", {
      invoke: "{{SKILL_INVOKE}}",
      slots: {},
    })).toThrow(/render incomplete/);
  });

describe("t151 shipped onboarding artifacts", () => {
  test("every harness ships complete onboarding in both invocation channels", async () => {
    const { HARNESS_MATRIX } = await import("../harness/harness-matrix.ts");
    for (const harness of HARNESS_MATRIX) {
      const fills = harness.fills;
      for (const native of [false, true]) {
        const root = readFileSync(native ? releasePath(
          harness.onboardingDist) : harness.onboardingDist, "utf-8");
        const setup = readFileSync(native ? releasePath(
          harness.harnessOnboardingDist) : harness.harnessOnboardingDist, "utf-8");
        expect(noLeftoverMarkers(root), harness.name).toBeNull();
        expect(noLeftoverMarkers(setup), harness.name).toBeNull();
        for (const section of NEUTRAL_SECTIONS) expect(root, harness.name).toContain(section);
        for (const section of HARNESS_SECTIONS) expect(setup, harness.name).toContain(section);
        expect(setup, harness.name).toContain(
          `${native ? "aidlc" : `bun ${harness.manifest.harnessDir}/tools/aidlc.ts`} engine \
runtime summary --json`,
        );
        expect(setup, harness.name).not.toContain(`${fills.invoke} engine`);
        expect(setup, harness.name).toContain(
          `${native ? "aidlc" : `bun ${harness.manifest.harnessDir}/tools/aidlc.ts`} engine \
knowledge <verb>`,
        );
        expect(setup, harness.name).toContain(`\`${fills.invoke} --stage <slug> --single\``);
        if (harness.manifest.onboarding?.harnessDst) {
          expect(root, harness.name).toBe(NEUTRAL);
          expect(setup, harness.name).not.toContain("## Where things live");
        } else {
          expect(setup.match(/^#+ .+$/gm)?.[0], harness.name).toBe("# AI-DLC");
          expect(setup.endsWith("\n## Shared AI-DLC onboarding\n\n" + NEUTRAL),
             harness.name).toBe(true);
        }
      }
    }
  });

  test("the Kiro onboarding names the command that refreshes each harness tree, not the framework's packaging", async () => {
    const { HARNESS_MATRIX } = await import("../harness/harness-matrix.ts");
    const kiro = HARNESS_MATRIX.find((harness) => harness.name === "kiro-ide");
    expect(kiro).toBeDefined();
    for (const native of [false, true]) {
      const path = kiro?.harnessOnboardingDist ?? "";
      const setup = readFileSync(native ? releasePath(path) : path, "utf-8");
      const invoke = native ? "aidlc" : "bun .kiro/tools/aidlc.ts";
      const bullet = setup.split("\n").find((line) => line.includes("workspace tree is harness-neutral")) ?? "";
      expect(bullet).not.toContain("packaging");
      expect(bullet).toContain(`\`${invoke} config --harness <name>\` (\`claude\`, \`kiro\`)`);
      expect(bullet).toContain("which a copied install may need to run with `--download` or `--from`");
      expect(bullet).toContain(`\`${invoke} doctor\` names the commands`);
    }
  });

  test("all five identical-sharing harnesses ship byte-identical root instructions", async () => {
    const { HARNESS_MATRIX } = await import("../harness/harness-matrix.ts");
    const sharing = HARNESS_MATRIX.filter((h) => h.manifest.rootIntegrations.some(
      (integration) => integration.path === "AGENTS.md" && integration.shared === "identical",
    ));
    expect(sharing.map((h) => h.name)).toEqual(["codex", "cursor", "kiro", "kiro-ide", "opencode"]);
    const expected = Buffer.from(NEUTRAL);
    for (const harness of sharing) {
      expect(readFileSync(harness.onboardingDist), harness.name).toEqual(expected);
      expect(readFileSync(releasePath(harness.onboardingDist)), harness.name).toEqual(expected);
    }
  });

  test("neutral onboarding documents the full DocumentKB verb surface exactly once", async () => {
    const { HARNESS_MATRIX } = await import("../harness/harness-matrix.ts");
    for (const harness of HARNESS_MATRIX) {
      const root = readFileSync(harness.onboardingDist, "utf-8");
      const paragraphs = root.split("\n").filter((line) => line.includes("Document knowledge \
(DocumentKB)"));
      expect(paragraphs, harness.name).toHaveLength(1);
      const paragraph = paragraphs[0];
      expect(paragraph).toContain("`knowledge <verb>`");
      expect(paragraph.match(/`summarize <id>/g), harness.name).toHaveLength(1);
      for (const verb of ["onboard", "sync", "list", "show", "associate", "dissociate", "rebind",
         "summarize"]) {
        expect(paragraph, `${harness.name}: ${verb}`).toContain(verb);
      }
      expect(paragraph).not.toMatch(/`remove\s+<id>/);
    }
  });
});
