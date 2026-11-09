import { describe, expect, test } from "bun:test";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import {
  orchestratorSkillFilesFixture,
  sessionSkillFixture,
  SKILL_TABLES_FIXTURE,
  skillRenderingInputsFixture,
} from "./skill-rendering.fixture.ts";
import { text } from "./values.fixture.ts";

const inputs = skillRenderingInputsFixture({ harnessDir: ".kiro" });

describe("orchestratorSkillFilesFixture", () => {
  test("holds the four authored orchestrator files every host ships", () => {
    expect(orchestratorSkillFilesFixture).toMatchObject([
      { source: source("skills/aidlc/SKILL.md") },
      { source: source("skills/aidlc/question-rendering.md") },
      { source: source("skills/aidlc/composer.md") },
      { source: source("skills/aidlc/tables.md") },
    ]);
  });
});

describe("sessionSkillFixture", () => {
  test("holds a skill with prose, a script, a data file and binary bytes under its own folder", () => {
    expect(sessionSkillFixture).toMatchObject({
      name: "aidlc-issue-report",
      files: [
        { source: source("skills/aidlc-issue-report/SKILL.md"), content: { kind: "text" } },
        { source: source("skills/aidlc-issue-report/scripts/collect.ts"), content: { kind: "text" } },
        { source: source("skills/aidlc-issue-report/references/data.yaml"), content: { kind: "text" } },
        { source: source("skills/aidlc-issue-report/assets/mark.png"), content: { kind: "bytes" } },
      ],
    });
  });
});

describe("skillRenderingInputsFixture", () => {
  test("binds every token from the harness folder", () => {
    expect(inputs.tokens).toEqual({
      ["HARNESS_DIR"]: ".kiro",
      ["INVOKE"]: "bun .kiro/tools/aidlc.ts",
      ["SKILL_INVOKE"]: null,
      ["OPTION_LETTERS"]: "A-E",
      ["TRUSTED_NAMESPACE"]: "aidlc",
      ["TOOL_PREFIX"]: "bun .kiro/tools/",
    });
  });

  test("prepares an authored file unchanged", () => {
    const authored = { source: source("skills/aidlc/SKILL.md"), content: text(["# AI-DLC"]) };

    expect(inputs.prepare(authored)).toEqual({ ok: true, value: authored });
  });

  test.each(["stage-table", "scope-table"] as const)("renders the fixed %s", (verb) => {
    expect(inputs.tables(verb)).toEqual({ ok: true, value: SKILL_TABLES_FIXTURE[verb] });
  });

  test("offers the four orchestrator files as the authored inputs", () => {
    expect(inputs.files).toBe(orchestratorSkillFilesFixture);
  });
});
