import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import {
  commandLineOptionsOf,
  eslintInvocationsOf,
  type SelectedRule,
  scanPackageJson,
  scriptCommandsOf,
  suppressionsLocationValuesOf,
} from "./package-script-scanner.ts";

const classSyntax = clauseAddressSchema.parse("CD-14#class-syntax");
const noTmpFiles = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const noClassAuthoring = "rin-discipline/no-class-authoring";
const rootPackageJson = repoPathSchema.parse("package.json");
const nestedPackageJson = repoPathSchema.parse("packages/a/package.json");

const classRule: SelectedRule = { ruleId: noClassAuthoring, clause: classSyntax };
const tmpRule: SelectedRule = { ruleId: "probe-lint/no-tmp-files", clause: noTmpFiles };

describe("scriptCommandsOf", () => {
  it("splits a command into tokens on runs of whitespace", () => {
    expect(scriptCommandsOf({ script: "eslint  src\t--max-warnings 0" })).toEqual({
      outcome: "ok",
      value: [["eslint", "src", "--max-warnings", "0"]],
    });
  });

  it("keeps single- and double-quoted spans whole and removes their quotes", () => {
    expect(
      scriptCommandsOf({
        script: `eslint --rule 'rin-discipline/no-class-authoring: off' --ignore-pattern "dist/**"`,
      }),
    ).toEqual({
      outcome: "ok",
      value: [["eslint", "--rule", "rin-discipline/no-class-authoring: off", "--ignore-pattern", "dist/**"]],
    });
  });

  it("joins a quoted span to the unquoted text it touches", () => {
    expect(scriptCommandsOf({ script: `eslint --rule='rin-discipline/no-class-authoring: off'` })).toEqual({
      outcome: "ok",
      value: [["eslint", "--rule=rin-discipline/no-class-authoring: off"]],
    });
  });

  it("splits commands at &&, ||, ; and | standing alone", () => {
    expect(scriptCommandsOf({ script: "tsc && eslint . || echo failed ; echo done | cat" })).toEqual({
      outcome: "ok",
      value: [["tsc"], ["eslint", "."], ["echo", "failed"], ["echo", "done"], ["cat"]],
    });
  });

  it("splits commands at &&, ||, ; and | touching other text", () => {
    expect(scriptCommandsOf({ script: "tsc&&eslint .||echo failed;echo done|cat" })).toEqual({
      outcome: "ok",
      value: [["tsc"], ["eslint", "."], ["echo", "failed"], ["echo", "done"], ["cat"]],
    });
  });

  it("does not split at an operator inside quotes", () => {
    expect(scriptCommandsOf({ script: `echo "a && b; c | d" 'e || f'` })).toEqual({
      outcome: "ok",
      value: [["echo", "a && b; c | d", "e || f"]],
    });
  });

  it.each([
    { script: "eslint src;", commands: [["eslint", "src"]] },
    { script: "; eslint src ;;  ; tsc", commands: [["eslint", "src"], ["tsc"]] },
    { script: "   ", commands: [] },
  ])("drops the empty commands in $script", ({ script, commands }) => {
    expect(scriptCommandsOf({ script })).toEqual({ outcome: "ok", value: commands });
  });

  it.each([`eslint --rule 'rin-discipline/no-class-authoring: off`, `"eslint src`])(
    "refuses %s, whose quote is never closed",
    (script) => {
      expect(scriptCommandsOf({ script })).toEqual({
        outcome: "failed",
        error: { kind: "unterminated-quote" },
      });
    },
  );
});

describe("eslintInvocationsOf", () => {
  it.each([
    { command: ["eslint", "src", "--quiet"], options: ["src", "--quiet"] },
    { command: ["npx", "eslint", "src"], options: ["src"] },
    { command: ["npx", "eslint@10", "src"], options: ["src"] },
    { command: ["pnpm", "exec", "eslint", "src"], options: ["src"] },
    { command: ["./node_modules/.bin/eslint", "src"], options: ["src"] },
    { command: ["node", "node_modules/eslint/bin/eslint.js", "src"], options: ["src"] },
  ])("recognises $command as an invocation whose options follow the eslint token", ({ command, options }) => {
    expect(eslintInvocationsOf({ commands: [command] })).toEqual([{ options }]);
  });

  it.each([
    ["eslint-plugin-check", "src"],
    ["myeslint", "src"],
    ["prettier", "--check", "eslint.config.mjs"],
    ["node", "scripts/eslint.mjs"],
    ["tsc", "--noEmit"],
  ])("does not recognise %s as an invocation", (...command) => {
    expect(eslintInvocationsOf({ commands: [command] })).toEqual([]);
  });

  it("reads options a package manager forwards after -- the same way", () => {
    expect(
      eslintInvocationsOf({
        commands: [["pnpm", "exec", "eslint", "src", "--", "--rule", "rin-discipline/no-class-authoring: off"]],
      }),
    ).toEqual([{ options: ["src", "--rule", "rin-discipline/no-class-authoring: off"] }]);
  });

  it("finds each invocation among a script's other commands, counting any command with an eslint token", () => {
    expect(
      eslintInvocationsOf({ commands: [["cd", "sub"], ["eslint", "src"], ["echo", "eslint"]] }),
    ).toEqual([{ options: ["src"] }, { options: [] }]);
  });
});

describe("commandLineOptionsOf", () => {
  it("reports --rule in space form when its value names a selected rule id", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["src", "--rule", "rin-discipline/no-class-authoring: off"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([
      { option: "--rule rin-discipline/no-class-authoring: off", ruleIds: [noClassAuthoring] },
    ]);
  });

  it("reports --rule in = form when its value names a selected rule id", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule=rin-discipline/no-class-authoring: off"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([
      { option: "--rule=rin-discipline/no-class-authoring: off", ruleIds: [noClassAuthoring] },
    ]);
  });

  it("matches a selected rule id after a comma and spaces in the --rule value", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule", "no-console: off,   rin-discipline/no-class-authoring : off"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([
      {
        option: "--rule no-console: off,   rin-discipline/no-class-authoring : off",
        ruleIds: [noClassAuthoring],
      },
    ]);
  });

  it.each([
    [`"rin-discipline/no-class-authoring": off`, `--rule "rin-discipline/no-class-authoring": off`],
    [`'rin-discipline/no-class-authoring': off`, `--rule 'rin-discipline/no-class-authoring': off`],
  ])("matches the quoted key in the --rule value %s", (ruleValue, option) => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule", ruleValue] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([{ option, ruleIds: [noClassAuthoring] }]);
  });

  it.each([
    [`no-console: off, "rin-discipline/no-class-authoring": off`],
    [`no-console: off,'rin-discipline/no-class-authoring':off`],
    [`'no-console':off,  "rin-discipline/no-class-authoring"  :  off`],
  ])("strips the quotes around each part after splitting the --rule value %s on , and :", (ruleValue) => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule", ruleValue] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([{ option: `--rule ${ruleValue}`, ruleIds: [noClassAuthoring] }]);
  });

  it("names only the selected rule ids a --rule value names", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule", "probe-lint/no-tmp-files: off"] },
        selectedRuleIds: [noClassAuthoring, "probe-lint/no-tmp-files"],
      }),
    ).toEqual([{ option: "--rule probe-lint/no-tmp-files: off", ruleIds: ["probe-lint/no-tmp-files"] }]);
  });

  it.each([
    "rin-discipline/no-class-authoring-x: off",
    "no-console: off",
    "rin-discipline: off",
  ])("does not report --rule whose value %s names no selected rule id as a whole id", (ruleValue) => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule", ruleValue] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([]);
  });

  it.each([
    [["--suppress-rule", "rin-discipline/no-class-authoring"], "--suppress-rule rin-discipline/no-class-authoring"],
    [["--suppress-rule=rin-discipline/no-class-authoring"], "--suppress-rule=rin-discipline/no-class-authoring"],
    [["--suppress-rule", "no-console,rin-discipline/no-class-authoring"], "--suppress-rule no-console,rin-discipline/no-class-authoring"],
  ])("reports %j when it names a selected rule id", (options, option) => {
    expect(
      commandLineOptionsOf({ invocation: { options }, selectedRuleIds: [noClassAuthoring] }),
    ).toEqual([{ option, ruleIds: [noClassAuthoring] }]);
  });

  it("does not report --suppress-rule naming a rule id that only extends a selected one", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--suppress-rule", "rin-discipline/no-class-authoring-x"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([]);
  });

  it.each([
    [["--suppress-all"], "--suppress-all"],
    [["--ignore-pattern", "dist/**"], "--ignore-pattern dist/**"],
    [["--ignore-pattern=dist/**"], "--ignore-pattern=dist/**"],
    [["-c", "alt.config.mjs"], "-c alt.config.mjs"],
    [["--config", "alt.config.mjs"], "--config alt.config.mjs"],
    [["--config=alt.config.mjs"], "--config=alt.config.mjs"],
    [["--no-config-lookup"], "--no-config-lookup"],
    [["--parser", "espree"], "--parser espree"],
    [["--parser-options", "ecmaVersion:2020"], "--parser-options ecmaVersion:2020"],
    [["--plugin", "local"], "--plugin local"],
  ])("reports %j for every selected rule id", (options, option) => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["src", ...options] },
        selectedRuleIds: [noClassAuthoring, "probe-lint/no-tmp-files"],
      }),
    ).toEqual([{ option, ruleIds: [noClassAuthoring, "probe-lint/no-tmp-files"] }]);
  });

  it.each([
    [["-c=alt.config.mjs"], "-c=alt.config.mjs"],
    [["--parser=espree"], "--parser=espree"],
    [["--parser-options=ecmaVersion:2020"], "--parser-options=ecmaVersion:2020"],
    [["--plugin=local"], "--plugin=local"],
  ])("reports the = form %j for every selected rule id", (options, option) => {
    expect(
      commandLineOptionsOf({
        invocation: { options },
        selectedRuleIds: [noClassAuthoring, "probe-lint/no-tmp-files"],
      }),
    ).toEqual([{ option, ruleIds: [noClassAuthoring, "probe-lint/no-tmp-files"] }]);
  });

  it.each(["--ignore-pattern", "-c", "--config", "--parser", "--parser-options", "--plugin"])(
    "reports %s given last with no value as the bare option name",
    (name) => {
      expect(
        commandLineOptionsOf({
          invocation: { options: ["src", name] },
          selectedRuleIds: [noClassAuthoring],
        }),
      ).toEqual([{ option: name, ruleIds: [noClassAuthoring] }]);
    },
  );

  it.each([
    ["--prune-suppressions"],
    ["--no-inline-config"],
    ["--max-warnings", "0"],
    ["--quiet"],
    ["--no-ignore"],
    ["--fix"],
    ["--cache"],
    ["--format", "json"],
    ["--suppressions-location", "lint-suppressions.json"],
    ["--concurrency", "4"],
  ])("does not report %s, which is stricter, report-only or inert for a selected rule", (...options) => {
    expect(
      commandLineOptionsOf({ invocation: { options }, selectedRuleIds: [noClassAuthoring] }),
    ).toEqual([]);
  });

  it("reports every occurrence of an option", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--ignore-pattern", "dist/**", "--ignore-pattern", "build/**"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([
      { option: "--ignore-pattern dist/**", ruleIds: [noClassAuthoring] },
      { option: "--ignore-pattern build/**", ruleIds: [noClassAuthoring] },
    ]);
  });
});

describe("suppressionsLocationValuesOf", () => {
  it("reads --suppressions-location in space form", () => {
    expect(
      suppressionsLocationValuesOf({
        invocation: { options: ["src", "--suppressions-location", "lint-suppressions.json"] },
      }),
    ).toEqual(["lint-suppressions.json"]);
  });

  it("reads --suppressions-location in = form", () => {
    expect(
      suppressionsLocationValuesOf({
        invocation: { options: ["--suppressions-location=lint-suppressions.json", "src"] },
      }),
    ).toEqual(["lint-suppressions.json"]);
  });

  it("reads nothing from an invocation with no --suppressions-location", () => {
    expect(suppressionsLocationValuesOf({ invocation: { options: ["src", "--quiet"] } })).toEqual([]);
  });
});

describe("scanPackageJson", () => {
  it("reports malformed JSON as tool-failed", () => {
    expect(
      scanPackageJson({ path: rootPackageJson, text: `{ "scripts": `, selectedRules: [classRule] }),
    ).toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });

  it("reports a script value that is not a string as tool-failed", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { lint: 3 } }),
        selectedRules: [classRule],
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });

  it("finds nothing in a package.json with no scripts", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ name: "app" }),
        selectedRules: [classRule],
      }),
    ).toEqual({ outcome: "ok", value: { nativeExceptions: [], suppressionsLocations: [] } });
  });

  it("reports a script with an unterminated quote as tool-failed naming the script", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { "lint:strict": "eslint --rule 'x: off" } }),
        selectedRules: [classRule],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "tool-failed", detail: expect.stringContaining("lint:strict") },
    });
  });

  it("reports a dormant --rule turning a selected rule off as a command-line-option at the declaring package.json", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { lint: "eslint --rule 'rin-discipline/no-class-authoring: off' src" } }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        nativeExceptions: [
          {
            kind: "command-line-option",
            clause: classSyntax,
            location: "package.json",
            script: "lint",
            option: "--rule rin-discipline/no-class-authoring: off",
          },
        ],
        suppressionsLocations: [],
      },
    });
  });

  it("does not report a --rule for a rule id that merely extends a selected one", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { lint: "eslint --rule 'rin-discipline/no-class-authoring-x: off' src" } }),
        selectedRules: [classRule],
      }),
    ).toEqual({ outcome: "ok", value: { nativeExceptions: [], suppressionsLocations: [] } });
  });

  it("reports an every-clause option once per selected clause", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { lint: "eslint -c alt.config.mjs src" } }),
        selectedRules: [classRule, tmpRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        nativeExceptions: [
          {
            kind: "command-line-option",
            clause: classSyntax,
            location: "package.json",
            script: "lint",
            option: "-c alt.config.mjs",
          },
          {
            kind: "command-line-option",
            clause: noTmpFiles,
            location: "package.json",
            script: "lint",
            option: "-c alt.config.mjs",
          },
        ],
        suppressionsLocations: [],
      },
    });
  });

  it("ignores an option outside a recognised ESLint invocation", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { format: "prettier --config .prettierrc --ignore-pattern dist ." } }),
        selectedRules: [classRule],
      }),
    ).toEqual({ outcome: "ok", value: { nativeExceptions: [], suppressionsLocations: [] } });
  });

  it("reads --suppressions-location in space and = forms from a root package.json", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({
          scripts: {
            lint: "eslint --suppressions-location lint-suppressions.json src",
            "lint:ci": "eslint --suppressions-location=ci/suppressions.json src",
          },
        }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        nativeExceptions: [],
        suppressionsLocations: [
          { location: "lint-suppressions.json", script: "lint" },
          { location: "ci/suppressions.json", script: "lint:ci" },
        ],
      },
    });
  });

  it("resolves a nested script's --suppressions-location ../x against the declaring package.json's directory", () => {
    expect(
      scanPackageJson({
        path: nestedPackageJson,
        text: JSON.stringify({ scripts: { lint: "eslint --suppressions-location ../x/suppressions.json src" } }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        nativeExceptions: [],
        suppressionsLocations: [{ location: "packages/x/suppressions.json", script: "lint" }],
      },
    });
  });

  it("treats cd sub && eslint as an invocation and keeps the declaring package.json's directory as the resolution base, not following the cd", () => {
    expect(
      scanPackageJson({
        path: nestedPackageJson,
        text: JSON.stringify({ scripts: { lint: "cd sub && eslint --suppressions-location suppressions.json ." } }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        nativeExceptions: [],
        suppressionsLocations: [{ location: "packages/a/suppressions.json", script: "lint" }],
      },
    });
  });

  it.each(["../outside.json", "/tmp/suppressions.json"])(
    "reports a --suppressions-location %s that is no repo path as tool-failed naming the script",
    (location) => {
      expect(
        scanPackageJson({
          path: rootPackageJson,
          text: JSON.stringify({ scripts: { "lint:ci": `eslint --suppressions-location ${location} src` } }),
          selectedRules: [classRule],
        }),
      ).toMatchObject({
        outcome: "failed",
        error: { kind: "tool-failed", detail: expect.stringContaining("lint:ci") },
      });
    },
  );
});
