import type { ProjectionRequest } from "../src/domain/model.ts";
import type { ProjectionContent } from "../src/domain/projection-content.ts";
import type { NativeResource } from "../src/domain/native-rendering.ts";
export type SensorCase = {
  readonly baseline: "upstream" | "fork";
  readonly channel: "copy" | "native";
  readonly harness: string;
  readonly directory: string;
  readonly kind: "core" | "plugin";
  readonly input: ProjectionRequest;
  readonly expected: ProjectionContent;
  readonly resources: readonly NativeResource[];
  readonly sensorDirectory: string;
};
const upstreamCopyClaudeCore: SensorCase = {
  baseline: "upstream",
  harness: "claude",
  directory: ".claude",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "claude",
      harnessDir: ".claude",
      rulesSubdir: "rules",
      invocation: "bun .claude/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "claude",
    harnessDir: ".claude",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .claude/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".claude/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .claude/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".claude/sensors",
  channel: "copy",
};
const upstreamCopyClaudePlugin: SensorCase = {
  baseline: "upstream",
  harness: "claude",
  directory: ".claude",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "claude",
      harnessDir: ".claude",
      rulesSubdir: "rules",
      invocation: "bun .claude/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "claude",
    harnessDir: ".claude",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .claude/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .claude/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const upstreamCopyCodexCore: SensorCase = {
  baseline: "upstream",
  harness: "codex",
  directory: ".codex",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "codex",
      harnessDir: ".codex",
      rulesSubdir: "aidlc-rules",
      invocation: "bun .codex/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "codex",
    harnessDir: ".codex",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .codex/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".codex/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .codex/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".codex/sensors",
  channel: "copy",
};
const upstreamCopyCodexPlugin: SensorCase = {
  baseline: "upstream",
  harness: "codex",
  directory: ".codex",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "codex",
      harnessDir: ".codex",
      rulesSubdir: "aidlc-rules",
      invocation: "bun .codex/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "codex",
    harnessDir: ".codex",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .codex/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .codex/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const upstreamCopyCopilotCore: SensorCase = {
  baseline: "upstream",
  harness: "copilot",
  directory: ".aidlc",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "copilot",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "bun .aidlc/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "copilot",
    harnessDir: ".aidlc",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".aidlc/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".aidlc/sensors",
  channel: "copy",
};
const upstreamCopyCopilotPlugin: SensorCase = {
  baseline: "upstream",
  harness: "copilot",
  directory: ".aidlc",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "copilot",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "bun .aidlc/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "copilot",
    harnessDir: ".aidlc",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const upstreamCopyCursorCore: SensorCase = {
  baseline: "upstream",
  harness: "cursor",
  directory: ".cursor",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "cursor",
      harnessDir: ".cursor",
      rulesSubdir: "rules",
      invocation: "bun .cursor/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "cursor",
    harnessDir: ".cursor",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .cursor/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".cursor/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .cursor/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".cursor/sensors",
  channel: "copy",
};
const upstreamCopyCursorPlugin: SensorCase = {
  baseline: "upstream",
  harness: "cursor",
  directory: ".cursor",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "cursor",
      harnessDir: ".cursor",
      rulesSubdir: "rules",
      invocation: "bun .cursor/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "cursor",
    harnessDir: ".cursor",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .cursor/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .cursor/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const upstreamCopyKiroCore: SensorCase = {
  baseline: "upstream",
  harness: "kiro",
  directory: ".kiro",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "bun .kiro/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "kiro",
    harnessDir: ".kiro",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .kiro/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".kiro/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .kiro/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".kiro/sensors",
  channel: "copy",
};
const upstreamCopyKiroPlugin: SensorCase = {
  baseline: "upstream",
  harness: "kiro",
  directory: ".kiro",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "bun .kiro/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "kiro",
    harnessDir: ".kiro",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .kiro/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: ".kiro/aidlc-plugins/aidlc-test-pro/sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .kiro/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: ".kiro/aidlc-plugins/aidlc-test-pro/sensors",
  channel: "copy",
};
const upstreamCopyKiroIdeCore: SensorCase = {
  baseline: "upstream",
  harness: "kiro-ide",
  directory: ".kiro",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro-ide",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "bun .kiro/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "kiro-ide",
    harnessDir: ".kiro",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .kiro/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".kiro/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .kiro/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".kiro/sensors",
  channel: "copy",
};
const upstreamCopyKiroIdePlugin: SensorCase = {
  baseline: "upstream",
  harness: "kiro-ide",
  directory: ".kiro",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro-ide",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "bun .kiro/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "kiro-ide",
    harnessDir: ".kiro",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .kiro/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: ".kiro/aidlc-plugins/aidlc-test-pro/sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .kiro/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: ".kiro/aidlc-plugins/aidlc-test-pro/sensors",
  channel: "copy",
};
const upstreamCopyOpencodeCore: SensorCase = {
  baseline: "upstream",
  harness: "opencode",
  directory: ".aidlc",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "opencode",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "bun .aidlc/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "opencode",
    harnessDir: ".aidlc",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".aidlc/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".aidlc/sensors",
  channel: "copy",
};
const upstreamCopyOpencodePlugin: SensorCase = {
  baseline: "upstream",
  harness: "opencode",
  directory: ".aidlc",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "opencode",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "bun .aidlc/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "opencode",
    harnessDir: ".aidlc",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const forkCopyClaudeCore: SensorCase = {
  baseline: "fork",
  harness: "claude",
  directory: ".claude",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "claude",
      harnessDir: ".claude",
      rulesSubdir: "rules",
      invocation: "bun .claude/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "claude",
    harnessDir: ".claude",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .claude/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".claude/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .claude/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".claude/sensors",
  channel: "copy",
};
const forkCopyClaudePlugin: SensorCase = {
  baseline: "fork",
  harness: "claude",
  directory: ".claude",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "claude",
      harnessDir: ".claude",
      rulesSubdir: "rules",
      invocation: "bun .claude/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "claude",
    harnessDir: ".claude",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .claude/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .claude/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const forkCopyCodexCore: SensorCase = {
  baseline: "fork",
  harness: "codex",
  directory: ".codex",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "codex",
      harnessDir: ".codex",
      rulesSubdir: "aidlc-rules",
      invocation: "bun .codex/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "codex",
    harnessDir: ".codex",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .codex/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".codex/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .codex/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".codex/sensors",
  channel: "copy",
};
const forkCopyCodexPlugin: SensorCase = {
  baseline: "fork",
  harness: "codex",
  directory: ".codex",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "codex",
      harnessDir: ".codex",
      rulesSubdir: "aidlc-rules",
      invocation: "bun .codex/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "codex",
    harnessDir: ".codex",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .codex/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .codex/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const forkCopyCopilotCore: SensorCase = {
  baseline: "fork",
  harness: "copilot",
  directory: ".aidlc",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "copilot",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "bun .aidlc/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "copilot",
    harnessDir: ".aidlc",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".aidlc/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".aidlc/sensors",
  channel: "copy",
};
const forkCopyCopilotPlugin: SensorCase = {
  baseline: "fork",
  harness: "copilot",
  directory: ".aidlc",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "copilot",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "bun .aidlc/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "copilot",
    harnessDir: ".aidlc",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const forkCopyCursorCore: SensorCase = {
  baseline: "fork",
  harness: "cursor",
  directory: ".cursor",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "cursor",
      harnessDir: ".cursor",
      rulesSubdir: "rules",
      invocation: "bun .cursor/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "cursor",
    harnessDir: ".cursor",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .cursor/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".cursor/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .cursor/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".cursor/sensors",
  channel: "copy",
};
const forkCopyCursorPlugin: SensorCase = {
  baseline: "fork",
  harness: "cursor",
  directory: ".cursor",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "cursor",
      harnessDir: ".cursor",
      rulesSubdir: "rules",
      invocation: "bun .cursor/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "cursor",
    harnessDir: ".cursor",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .cursor/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .cursor/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const forkCopyKiroCore: SensorCase = {
  baseline: "fork",
  harness: "kiro",
  directory: ".kiro",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "bun .kiro/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "kiro",
    harnessDir: ".kiro",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .kiro/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".kiro/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .kiro/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".kiro/sensors",
  channel: "copy",
};
const forkCopyKiroPlugin: SensorCase = {
  baseline: "fork",
  harness: "kiro",
  directory: ".kiro",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "bun .kiro/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "kiro",
    harnessDir: ".kiro",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .kiro/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .kiro/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const forkCopyKiroIdeCore: SensorCase = {
  baseline: "fork",
  harness: "kiro-ide",
  directory: ".kiro",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro-ide",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "bun .kiro/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "kiro-ide",
    harnessDir: ".kiro",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .kiro/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".kiro/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .kiro/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".kiro/sensors",
  channel: "copy",
};
const forkCopyKiroIdePlugin: SensorCase = {
  baseline: "fork",
  harness: "kiro-ide",
  directory: ".kiro",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro-ide",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "bun .kiro/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "kiro-ide",
    harnessDir: ".kiro",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .kiro/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .kiro/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const forkCopyOpencodeCore: SensorCase = {
  baseline: "fork",
  harness: "opencode",
  directory: ".aidlc",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "opencode",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "bun .aidlc/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "opencode",
    harnessDir: ".aidlc",
    body: "---\nid: linter\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".aidlc/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc.ts engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".aidlc/sensors",
  channel: "copy",
};
const forkCopyOpencodePlugin: SensorCase = {
  baseline: "fork",
  harness: "opencode",
  directory: ".aidlc",
  kind: "plugin",
  input: {
    documents: [
      {
        source: {
          kind: "plugin",
          id: "test-pro",
        },
        id: "aidlc-coverage-threshold",
        kind: "text",
        body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun {{HARNESS_DIR}}/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: ["test-pro"],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "opencode",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "bun .aidlc/tools/aidlc.ts",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "plugin",
      id: "test-pro",
    },
    id: "aidlc-coverage-threshold",
    kind: "text",
    harness: "opencode",
    harnessDir: ".aidlc",
    body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    nativeTier: null,
    description: null,
    hook: null,
    key: "plugin:test-pro/aidlc-coverage-threshold",
  },
  resources: [
    {
      kind: "file",
      path: "sensors/aidlc-coverage-threshold.md",
      body: '---\nid: coverage-threshold\nkind: deterministic\ncommand: bun .aidlc/tools/aidlc-sensor-coverage-threshold.ts\ndefault_severity: advisory\ndescription: Reports whether branch+line coverage in test-pro-coverage-summary.json meet their targets (test-pro plugin, advisory)\ncategory: document-shape\nmatches: "**/{aidlc-docs,intents}/**"\ninput_schema:\n  output_path: string\n  stage_slug: string\noutput_schema:\n  pass: boolean\n  findings_count: integer\n  line_pct: number\n  branch_pct: number\n  targets: object\ntimeout_seconds: 5\n---\n\n# coverage-threshold sensor (test-pro)\n\nADVISORY. Reads the coverage summary JSON the build-and-test contribution emits\n(`test-pro-coverage-summary.json`) and reports whether `line_pct` and\n`branch_pct` meet their targets. Targets travel inside the JSON (`targets`),\nfalling back to embedded defaults (line 80 / branch 70), so no per-stage config\nor dispatcher flag is needed \u2014 the sensor works from `--output-path` alone.\n\n## Advisory note\n\nThe framework has no blocking sensor severity yet, so a `SENSOR_FAILED` here is\nREPORTED, not enforced. The build-and-test stage prose drives meeting the\ntargets. (A future blocking-severity capability would make this gate hard.)\n',
    },
  ],
  sensorDirectory: "sensors",
  channel: "copy",
};
const upstreamNativeClaudeCore: SensorCase = {
  baseline: "upstream",
  harness: "claude",
  directory: ".claude",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "claude",
      harnessDir: ".claude",
      rulesSubdir: "rules",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "claude",
    harnessDir: ".claude",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".claude/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".claude/sensors",
  channel: "native",
};
const upstreamNativeCodexCore: SensorCase = {
  baseline: "upstream",
  harness: "codex",
  directory: ".codex",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "codex",
      harnessDir: ".codex",
      rulesSubdir: "aidlc-rules",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "codex",
    harnessDir: ".codex",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".codex/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".codex/sensors",
  channel: "native",
};
const upstreamNativeCopilotCore: SensorCase = {
  baseline: "upstream",
  harness: "copilot",
  directory: ".aidlc",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "copilot",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "copilot",
    harnessDir: ".aidlc",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".aidlc/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".aidlc/sensors",
  channel: "native",
};
const upstreamNativeCursorCore: SensorCase = {
  baseline: "upstream",
  harness: "cursor",
  directory: ".cursor",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "cursor",
      harnessDir: ".cursor",
      rulesSubdir: "rules",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "cursor",
    harnessDir: ".cursor",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".cursor/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".cursor/sensors",
  channel: "native",
};
const upstreamNativeKiroCore: SensorCase = {
  baseline: "upstream",
  harness: "kiro",
  directory: ".kiro",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "kiro",
    harnessDir: ".kiro",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".kiro/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".kiro/sensors",
  channel: "native",
};
const upstreamNativeKiroIdeCore: SensorCase = {
  baseline: "upstream",
  harness: "kiro-ide",
  directory: ".kiro",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro-ide",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "kiro-ide",
    harnessDir: ".kiro",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".kiro/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".kiro/sensors",
  channel: "native",
};
const upstreamNativeOpencodeCore: SensorCase = {
  baseline: "upstream",
  harness: "opencode",
  directory: ".aidlc",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "opencode",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "opencode",
    harnessDir: ".aidlc",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".aidlc/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nWraps the project's configured linter. v0.5.0 defaults to eslint; multi-language\nauto-detection (ruff, golangci-lint, clippy) is deferred to v0.6.0+.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation).\n\n## v0.6.0 carry-forward\n\nMulti-language detection at framework boundary (read project type from\npractices `## Tech Stack` section, dispatch appropriate linter).\n",
    },
  ],
  sensorDirectory: ".aidlc/sensors",
  channel: "native",
};
const forkNativeClaudeCore: SensorCase = {
  baseline: "fork",
  harness: "claude",
  directory: ".claude",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "claude",
      harnessDir: ".claude",
      rulesSubdir: "rules",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "claude",
    harnessDir: ".claude",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".claude/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".claude/sensors",
  channel: "native",
};
const forkNativeCodexCore: SensorCase = {
  baseline: "fork",
  harness: "codex",
  directory: ".codex",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "codex",
      harnessDir: ".codex",
      rulesSubdir: "aidlc-rules",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "codex",
    harnessDir: ".codex",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".codex/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".codex/sensors",
  channel: "native",
};
const forkNativeCopilotCore: SensorCase = {
  baseline: "fork",
  harness: "copilot",
  directory: ".aidlc",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "copilot",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "copilot",
    harnessDir: ".aidlc",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".aidlc/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".aidlc/sensors",
  channel: "native",
};
const forkNativeCursorCore: SensorCase = {
  baseline: "fork",
  harness: "cursor",
  directory: ".cursor",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "cursor",
      harnessDir: ".cursor",
      rulesSubdir: "rules",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "cursor",
    harnessDir: ".cursor",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".cursor/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".cursor/sensors",
  channel: "native",
};
const forkNativeKiroCore: SensorCase = {
  baseline: "fork",
  harness: "kiro",
  directory: ".kiro",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "kiro",
    harnessDir: ".kiro",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".kiro/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".kiro/sensors",
  channel: "native",
};
const forkNativeKiroIdeCore: SensorCase = {
  baseline: "fork",
  harness: "kiro-ide",
  directory: ".kiro",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "kiro-ide",
      harnessDir: ".kiro",
      rulesSubdir: "steering",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "kiro-ide",
    harnessDir: ".kiro",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".kiro/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".kiro/sensors",
  channel: "native",
};
const forkNativeOpencodeCore: SensorCase = {
  baseline: "fork",
  harness: "opencode",
  directory: ".aidlc",
  kind: "core",
  input: {
    documents: [
      {
        source: {
          kind: "core",
          id: "framework",
        },
        id: "aidlc-linter",
        kind: "text",
        body: "---\nid: linter\nkind: deterministic\ncommand: {{INVOKE}} engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
        description: null,
        tier: null,
        knowledge: [],
        hook: null,
      },
    ],
    selectedPlugins: [],
    knowledge: [],
    reviewers: [],
    contract: {
      version: 1,
      harness: "opencode",
      harnessDir: ".aidlc",
      rulesSubdir: "rules",
      invocation: "aidlc",
      memoryRoot: "aidlc/spaces/default/memory",
      capabilities: [],
      tiers: {
        templated: {
          model: null,
          effort: null,
        },
        balanced: {
          model: null,
          effort: null,
        },
        judgment: {
          model: null,
          effort: null,
        },
      },
      tierCap: "judgment",
    },
  },
  expected: {
    source: {
      kind: "core",
      id: "framework",
    },
    id: "aidlc-linter",
    kind: "text",
    harness: "opencode",
    harnessDir: ".aidlc",
    body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    nativeTier: null,
    description: null,
    hook: null,
    key: "core:framework/aidlc-linter",
  },
  resources: [
    {
      kind: "file",
      path: ".aidlc/sensors/aidlc-linter.md",
      body: "---\nid: linter\nkind: deterministic\ncommand: aidlc engine sensor-linter\ndefault_severity: advisory\ndescription: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs\ncategory: code-quality\nmatches: \"**/*.{ts,js}\"\ninput_schema:\n  file_path: string\noutput_schema:\n  pass: boolean\n  violations:\n    - file: string\n      line: number\n      rule: string\n      message: string\ntimeout_seconds: 1200\n---\n\n# linter sensor\n\nRuns `package.json`'s non-empty `scripts.lint` through the project's package\nmanager, in the nearest package directory above the written file. The script\nruns exactly as authored: no file path, ESLint flags, formatter, or new rules\nare appended. It may check the whole package or workspace; its exit status\nowns the verdict. Choose a read-only lint script for advisory write checks.\n\nThe package manager comes from `--package-manager`, then the selected\nmanifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,\n`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting\nlockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and\nBun are supported; the manager and the consumer's lint dependencies must\nalready be available. The sensor does not install a manager or change config.\n\nWith no lint script, default `--runner auto` retains the existing pinned\nESLint path. `--runner project` requires the script: a missing manifest or\nscript exits 127 with `no-lint-script`, an unavailable check rather than a\nverified lint pass. An empty or malformed script/manifest, or unsupported\nmanager, is a script error. `--runner eslint` explicitly selects the legacy\nwrapper even when a lint script is present.\n\n## Adoption and workspace directory\n\nAfter installing a producer build containing this correction, an ordinary\npackage with `scripts.lint` needs no sensor override. For automatic sensor\nfires in a monorepo, set these variables **in the process that launches the\nharness**, selecting the directory containing the workspace lint script:\n\n| Process environment | Direct invocation flag | Default |\n| --- | --- | --- |\n| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |\n| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\\|pnpm\\|yarn\\|bun` | Manifest, lockfile, then npm |\n| `AIDLC_LINT_RUNNER` | `--runner auto\\|project\\|eslint` | `auto` |\n\nFor example, a POSIX shell can launch the harness with\n`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.\nIn PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the\nlaunching process before starting the harness. No user-wide configuration is\nrequired. `.` resolves from the sensor invocation's project cwd; an absolute\ndirectory is also accepted. The written file is resolved before changing\nsubprocess cwd. Direct flags override process-scoped defaults.\n\nThe dispatcher currently reconstructs the worker argv from the sensor identity\nand declared path contract; it does not forward suffix flags from `command:`.\nUse process-scoped environment settings for automatic fires rather than\nappending these flags to the manifest. Direct CLI use can pass the flags:\n\n```text\naidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm\n```\n\nThe existing sensor matches, stage binding and severity still determine when\nit runs and whether findings block. Delegating the command does not configure\nwhich CD rules ESLint or Biome enforces; maintain those in the consumer's own\nlint config and its separate discipline sensors.\n\nEchoes Fowler's \"Eslint, Semgrep\" examples from the harness-engineering article.\n\n## Failure mode\n\nEmits `SENSOR_FAILED` and writes detail to\n`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,\nwhere the space and intent come from the active cursors. The fire id is the\n8-hex correlator from the `SENSOR_FIRED` row in the active record's\n`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured\noutput (file, line, rule, message per violation). In project-script mode,\nnonzero exit becomes `pass: false` with one `lint-script-failed` finding and\nbounded stdout/stderr diagnostics. Counts are a command-level failure signal,\nnot an invented count of lint violations; file/line detail is not parsed from\narbitrary tool text. A timeout, signal or spawn error becomes a failed\n`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted\nwithout JSON parsing. The script writes only its sensor JSON to stdout.\n\nMissing-script and selection errors retain the dispatcher's existing\nunavailable/script-error classification; advisory audit rows may say\n`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking\ngate requires a verified evaluation and refuses those unavailable outcomes.\nThis correction does not redesign the dispatcher event vocabulary.\n\n## v0.6.0 carry-forward\n\nDedicated language detection remains separate. A consumer lint script can\nalready delegate to Biome, ESLint or a polyglot command without framework\nlanguage detection.\n",
    },
  ],
  sensorDirectory: ".aidlc/sensors",
  channel: "native",
};
export const sensorRenderingCases: readonly SensorCase[] = [
  upstreamCopyClaudeCore,
  upstreamCopyClaudePlugin,
  upstreamCopyCodexCore,
  upstreamCopyCodexPlugin,
  upstreamCopyCopilotCore,
  upstreamCopyCopilotPlugin,
  upstreamCopyCursorCore,
  upstreamCopyCursorPlugin,
  upstreamCopyKiroCore,
  upstreamCopyKiroPlugin,
  upstreamCopyKiroIdeCore,
  upstreamCopyKiroIdePlugin,
  upstreamCopyOpencodeCore,
  upstreamCopyOpencodePlugin,
  forkCopyClaudeCore,
  forkCopyClaudePlugin,
  forkCopyCodexCore,
  forkCopyCodexPlugin,
  forkCopyCopilotCore,
  forkCopyCopilotPlugin,
  forkCopyCursorCore,
  forkCopyCursorPlugin,
  forkCopyKiroCore,
  forkCopyKiroPlugin,
  forkCopyKiroIdeCore,
  forkCopyKiroIdePlugin,
  forkCopyOpencodeCore,
  forkCopyOpencodePlugin,
  upstreamNativeClaudeCore,
  upstreamNativeCodexCore,
  upstreamNativeCopilotCore,
  upstreamNativeCursorCore,
  upstreamNativeKiroCore,
  upstreamNativeKiroIdeCore,
  upstreamNativeOpencodeCore,
  forkNativeClaudeCore,
  forkNativeCodexCore,
  forkNativeCopilotCore,
  forkNativeCursorCore,
  forkNativeKiroCore,
  forkNativeKiroIdeCore,
  forkNativeOpencodeCore,
];
export const sensorCompositionCases: readonly SensorCase[] = [
  upstreamCopyClaudeCore,
  upstreamCopyCodexCore,
  upstreamCopyCopilotCore,
  upstreamCopyCursorCore,
  upstreamCopyKiroCore,
  upstreamCopyKiroIdeCore,
  upstreamCopyOpencodeCore,
  forkCopyClaudePlugin,
  forkCopyCodexPlugin,
  forkCopyCopilotPlugin,
  forkCopyCursorPlugin,
  forkCopyKiroPlugin,
  forkCopyKiroIdePlugin,
  forkCopyOpencodePlugin,
];
