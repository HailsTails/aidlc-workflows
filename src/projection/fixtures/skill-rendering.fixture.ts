import { source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import type { SkillRenderingInputs } from "../application/ports.ts";
import type { AuthoredHostFile } from "../domain/host-surface.ts";
import type { SessionSkill, SkillTableVerb } from "../domain/neutral-surface.ts";
import { tokenBindingsFixture } from "./token-bindings.fixture.ts";
import { text } from "./values.fixture.ts";

export const orchestratorSkillFilesFixture: readonly AuthoredHostFile[] = [
  {
    source: source("skills/aidlc/SKILL.md"),
    content: text([
      "---",
      "name: aidlc",
      "---",
      "",
      "Run `{{INVOKE}} engine orchestrate next` and follow `{{HARNESS_DIR}}/aidlc-common/protocols/stage-protocol.md`.",
    ]),
  },
  {
    source: source("skills/aidlc/question-rendering.md"),
    content: text(["# Question rendering", "", "Offer the options {{OPTION_LETTERS}}."]),
  },
  {
    source: source("skills/aidlc/composer.md"),
    content: text(["# Composer", "", "Read `{{HARNESS_DIR}}/rules/aidlc.md` before you run /aidlc-replay."]),
  },
  {
    source: source("skills/aidlc/tables.md"),
    content: text([
      "# Tables",
      "",
      "<!-- BEGIN: compiled scope grid via `{{INVOKE}} engine gen scope-table` - do NOT hand-edit -->",
      "stale scope grid",
      "<!-- END: compiled scope grid -->",
      "",
      "<!-- BEGIN: compiled stage graph via `{{INVOKE}} engine gen stage-table` - do NOT hand-edit -->",
      "stale stage graph",
      "<!-- END: compiled stage graph -->",
    ]),
  },
];

export const sessionSkillFixture: SessionSkill = {
  name: "aidlc-issue-report",
  files: [
    {
      source: source("skills/aidlc-issue-report/SKILL.md"),
      content: text([
        "---",
        "name: aidlc-issue-report",
        "---",
        "",
        "Run /aidlc-issue-report, then read `{{HARNESS_DIR}}/rules/aidlc.md` and `<record>/aidlc-state.md`.",
      ]),
    },
    {
      source: source("skills/aidlc-issue-report/scripts/collect.ts"),
      content: text(['const invoke = "{{INVOKE}}";', 'const harnessDir = "{{HARNESS_DIR}}";']),
    },
    {
      source: source("skills/aidlc-issue-report/references/data.yaml"),
      content: text(["invoke: {{INVOKE}}"]),
    },
    {
      source: source("skills/aidlc-issue-report/assets/mark.png"),
      content: { kind: "bytes", bytes: new Uint8Array([137, 80, 78, 71]) },
    },
  ],
};

export const SKILL_TABLES_FIXTURE: Readonly<Record<SkillTableVerb, string>> = {
  ["stage-table"]: "| Stage | Phase |\n|---|---|\n| requirements-analysis | inception |\n",
  ["scope-table"]: "| Scope | Stages |\n|---|---|\n| feature | 12 |\n",
};

export const skillRenderingInputsFixture = ({ harnessDir }: { readonly harnessDir: string }): SkillRenderingInputs => ({
  files: orchestratorSkillFilesFixture,
  prepare: (file) => accepted(file),
  tokens: tokenBindingsFixture({ harnessDir }),
  tables: (verb) => accepted(SKILL_TABLES_FIXTURE[verb]),
});
