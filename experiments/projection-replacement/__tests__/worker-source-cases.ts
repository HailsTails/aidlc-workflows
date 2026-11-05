import { declaredKiroTargets, declaredKasTargets } from "./worker-target-contracts.ts";
import { expect } from "bun:test";
import { agentSourceCases } from "./agent-source-cases.ts";
import type { AgentContext, AgentOrigin } from "../src/domain/agent-definition.ts";
import type { WorkerAdmissions } from "../src/domain/worker-policy.ts";
import type { NativeResource } from "../src/domain/native-rendering.ts";
import type { KiroCommandPatternDialect } from "../src/adapters/kiro-agent.ts";
const kiroRows: readonly ({readonly baseline: string; readonly harness: string; readonly context: AgentContext; readonly policyOrigin: AgentOrigin; readonly templateName: string; readonly templateAdmissions: WorkerAdmissions; readonly targetAdmissions: WorkerAdmissions; readonly admissionMismatch: WorkerAdmissions["verbs"]; readonly classification: string; readonly expected: readonly NativeResource[]; readonly profileText: string; readonly dispatcherCommands: readonly string[]; readonly toolScripts: readonly string[]; readonly sharedResources: readonly string[] | null; readonly hookSuffix: string; readonly commandDialect: KiroCommandPatternDialect; readonly promptAdditions: readonly string[];})[] = [
  {
    "baseline": "upstream",
    "harness": "kiro",
    "context": {
      "harness": "kiro",
      "directory": ".kiro",
      "invocation": "bun .kiro/tools/aidlc.ts",
      "tierCap": "judgment",
      "sharedKnowledge": "methodology-only",
      "models": {
        "tiers": {
          "judgment": {
            "model": null,
            "effort": null
          },
          "balanced": {
            "model": null,
            "effort": null
          },
          "templated": {
            "model": null,
            "effort": null
          }
        },
        "explicit": "inherit"
      },
      "memoryReference": null,
      "rulesSubdir": "steering",
      "knowledgeRead": "ordinary"
    },
    "policyOrigin": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "cc6f50d678da7a7a0228e47bb7429ed22f952a77",
      "path": "harness/kiro/agents/aidlc-quality-agent.json"
    },
    "templateName": "aidlc-quality-agent",
    "templateAdmissions": {
      "origin": {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "cc6f50d678da7a7a0228e47bb7429ed22f952a77",
        "path": "core/hooks/aidlc-state-transition-guard.ts"
      },
      "name": "aidlc-quality-agent",
      "verbs": {
        "aidlc-utility.ts": [
          "help",
          "version",
          "now",
          "status",
          "detect",
          "project-description",
          "codekb-path",
          "codekb-scope-diff",
          "codekb-snapshot",
          "codekb-publish",
          "plugin-list",
          "plugin-validate",
          "config-get",
          "config-list",
          "resolve-env-scope",
          "scope-table",
          "stage-table",
          "select-plugins",
          "document-input"
        ],
        "aidlc-state.ts": [
          "get",
          "count",
          "resume",
          "lookup"
        ],
        "aidlc-orchestrate.ts": [
          "wait",
          "team-board"
        ],
        "aidlc-jump.ts": [
          "resolve"
        ],
        "aidlc-unit.ts": [
          "merge-status",
          "status"
        ],
        "aidlc-log.ts": [
          "answers"
        ],
        "aidlc-learnings.ts": [
          "surface"
        ],
        "aidlc-runtime.ts": [
          "read",
          "summary"
        ],
        "aidlc-testing-posture.ts": [
          "resolve",
          "render",
          "verify",
          "reply",
          "brief"
        ],
        "aidlc-swarm.ts": [
          "check"
        ],
        "aidlc-worktree.ts": [
          "list",
          "verify",
          "info"
        ],
        "aidlc-audit.ts": [
          "history"
        ],
        "aidlc-plugin.ts": [
          "list"
        ],
        "aidlc-graph.ts": [
          "artifacts",
          "producers",
          "consumers",
          "topo",
          "cycles",
          "scope",
          "validate-scope",
          "validate-grid",
          "ars",
          "export"
        ],
        "aidlc-sensor.ts": [
          "list",
          "describe",
          "fire"
        ],
        "aidlc-validate.ts": [
          "outputs"
        ],
        "aidlc-review-brief.ts": [
          "review",
          "context",
          "summary"
        ],
        "aidlc-attest.ts": [
          "resolve"
        ],
        "aidlc-knowledge.ts": [
          "list",
          "show"
        ]
      }
    },
    "targetAdmissions": {
      "origin": {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "cc6f50d678da7a7a0228e47bb7429ed22f952a77",
        "path": "core/hooks/aidlc-state-transition-guard.ts"
      },
      "name": "test-pro-metrics-agent",
      "verbs": {
        "aidlc-utility.ts": [
          "help",
          "version",
          "now",
          "status",
          "detect",
          "project-description",
          "codekb-path",
          "codekb-scope-diff",
          "codekb-snapshot",
          "codekb-publish",
          "plugin-list",
          "plugin-validate",
          "config-get",
          "config-list",
          "resolve-env-scope",
          "scope-table",
          "stage-table",
          "select-plugins",
          "document-input"
        ],
        "aidlc-state.ts": [
          "get",
          "count",
          "resume",
          "lookup"
        ],
        "aidlc-orchestrate.ts": [
          "wait",
          "team-board"
        ],
        "aidlc-jump.ts": [
          "resolve"
        ],
        "aidlc-unit.ts": [
          "merge-status",
          "status"
        ],
        "aidlc-log.ts": [
          "answers"
        ],
        "aidlc-learnings.ts": [
          "surface"
        ],
        "aidlc-runtime.ts": [
          "read",
          "summary"
        ],
        "aidlc-testing-posture.ts": [
          "resolve",
          "render",
          "verify",
          "reply",
          "brief"
        ],
        "aidlc-swarm.ts": [
          "check"
        ],
        "aidlc-worktree.ts": [
          "list",
          "verify",
          "info"
        ],
        "aidlc-audit.ts": [
          "history"
        ],
        "aidlc-plugin.ts": [
          "list"
        ],
        "aidlc-graph.ts": [
          "artifacts",
          "producers",
          "consumers",
          "topo",
          "cycles",
          "scope",
          "validate-scope",
          "validate-grid",
          "ars",
          "export"
        ],
        "aidlc-sensor.ts": [
          "list",
          "describe",
          "fire"
        ],
        "aidlc-validate.ts": [
          "outputs"
        ],
        "aidlc-review-brief.ts": [
          "review",
          "context",
          "summary"
        ],
        "aidlc-attest.ts": [
          "resolve"
        ],
        "aidlc-knowledge.ts": [
          "list",
          "show"
        ]
      }
    },
    "admissionMismatch": {
      "aidlc-utility.ts": [
        "help",
        "version",
        "now",
        "status",
        "detect",
        "project-description",
        "codekb-path",
        "codekb-scope-diff",
        "codekb-snapshot",
        "codekb-publish",
        "plugin-list",
        "plugin-validate",
        "config-get",
        "config-list",
        "resolve-env-scope",
        "scope-table",
        "stage-table",
        "select-plugins",
        "document-input"
      ],
      "aidlc-state.ts": [
        "get",
        "count",
        "resume",
        "lookup"
      ],
      "aidlc-orchestrate.ts": [
        "wait",
        "team-board"
      ],
      "aidlc-jump.ts": [
        "resolve"
      ],
      "aidlc-unit.ts": [
        "merge-status",
        "status"
      ],
      "aidlc-log.ts": [
        "answers"
      ],
      "aidlc-learnings.ts": [
        "surface"
      ],
      "aidlc-runtime.ts": [
        "read",
        "summary"
      ],
      "aidlc-testing-posture.ts": [
        "resolve",
        "render",
        "verify",
        "reply",
        "brief"
      ],
      "aidlc-swarm.ts": [
        "check"
      ],
      "aidlc-worktree.ts": [
        "list",
        "verify",
        "info",
        "create",
        "merge",
        "discard",
        "restore"
      ],
      "aidlc-audit.ts": [
        "history"
      ],
      "aidlc-plugin.ts": [
        "list"
      ],
      "aidlc-graph.ts": [
        "artifacts",
        "producers",
        "consumers",
        "topo",
        "cycles",
        "scope",
        "validate-scope",
        "validate-grid",
        "ars",
        "export"
      ],
      "aidlc-sensor.ts": [
        "list",
        "describe",
        "fire"
      ],
      "aidlc-validate.ts": [
        "outputs"
      ],
      "aidlc-review-brief.ts": [
        "review",
        "context",
        "summary"
      ],
      "aidlc-attest.ts": [
        "resolve"
      ],
      "aidlc-knowledge.ts": [
        "list",
        "show"
      ]
    },
    "classification": "curated-native-plugin-improvement",
    "expected": [
      {
        "kind": "file",
        "path": ".kiro/agents/test-pro-metrics-agent.md",
        "body": "---\nname: test-pro-metrics-agent\ndisplay_name: Test Pro Metrics Agent\nplugin: test-pro\nexamples:\n  - methodology.md\ndescription: >\n  Testing metrics specialist responsible for coverage interpretation, defect trends, and release-quality evidence.\ntools: [\"read\", \"write\", \"shell\"]\nincludeMcpJson: true\n---\n<!-- aidlc-delegated-knowledge-preflight -->\n**Delegated knowledge preflight (mandatory):** Before substantive work, ensure every readable Markdown file under these directories is loaded, in order: `.kiro/knowledge/aidlc-shared/` (all but its format references `audit-format.md`, `knowledge-readme-template.md`, `memory-template.md`, `state-template.md` and `worktree-info-schema.md`: a step that needs one names it), `.kiro/knowledge/test-pro-metrics-agent/`, `aidlc/spaces/<active-space>/knowledge/aidlc-shared/`, then `aidlc/spaces/<active-space>/knowledge/test-pro-metrics-agent/`. A native resource preload satisfies this requirement; otherwise read the files now. The dispatch brief supplies rules and artifact paths separately.\n\n\n# Test Pro Metrics Agent\n\nYou are a testing metrics specialist. You interpret coverage, defect, and\nquality-gate signals into concise release evidence for the test-pro validation\npath.\n\n## Core Responsibilities\n\n- Summarize coverage deltas and gaps across unit, integration, and regression suites.\n- Identify defect trends that affect release readiness.\n- Translate raw test results into pass/fail evidence tied to requirements.\n\n## Stages Supported\n\n**Supporting:**\n- test-pro-integration — Cross-Unit Integration Testing (Construction)\n\n## Memory Focus\n\n`.kiro/steering/` — organization and project guardrails\n\n## Key Principles\n\n1. **Metrics explain risk** — Report what the numbers imply for release confidence.\n2. **Trace evidence to requirements** — Coverage without requirement context is incomplete.\n3. **Prefer concise signals** — Highlight the few gaps that change a decision.\n"
      },
      {
        "kind": "file",
        "path": ".kiro/agents/test-pro-metrics-agent.json",
        "body": "{\n  \"name\": \"test-pro-metrics-agent\",\n  \"description\": \"Testing metrics specialist responsible for coverage interpretation, defect trends, and release-quality evidence.\",\n  \"prompt\": \"file://test-pro-metrics-agent.md\",\n  \"includeMcpJson\": true,\n  \"tools\": [\n    \"fs_read\",\n    \"fs_write\",\n    \"execute_bash\",\n    \"thinking\",\n    \"@context7\",\n    \"@aws-mcp\",\n    \"@aws-pricing\",\n    \"@aws-iac\",\n    \"@aws-serverless\"\n  ],\n  \"allowedTools\": [\n    \"fs_read\",\n    \"thinking\"\n  ],\n  \"toolsSettings\": {\n    \"execute_bash\": {\n      \"allowedCommands\": [\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') engine( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') doctor\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') doctor --verbose\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') version\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') --doctor\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') --doctor --verbose\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') --version\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') status\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') --status\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config --help\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config --show\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config --show --json\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config models --show\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config models --show --json\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config models --help\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config runtime --show\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config runtime --show --json\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config runtime --help\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config providers --show\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config providers --show --json\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config providers --help\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config trust --show\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config trust --show --json\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config trust --help\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --show\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --show --json\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --help\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config project --show\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config project --show --json\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config project --help\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\\"\\\\.kiro/tools/aidlc\\\\.ts\\\"|'\\\\.kiro/tools/aidlc\\\\.ts') config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-attest\\\\.ts|\\\"\\\\.kiro/tools/aidlc-attest\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-attest\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-audit\\\\.ts|\\\"\\\\.kiro/tools/aidlc-audit\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-audit\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-bolt\\\\.ts|\\\"\\\\.kiro/tools/aidlc-bolt\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-bolt\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-completions\\\\.ts|\\\"\\\\.kiro/tools/aidlc-completions\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-completions\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-graph\\\\.ts|\\\"\\\\.kiro/tools/aidlc-graph\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-graph\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-jump\\\\.ts|\\\"\\\\.kiro/tools/aidlc-jump\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-jump\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-knowledge\\\\.ts|\\\"\\\\.kiro/tools/aidlc-knowledge\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-knowledge\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-learnings\\\\.ts|\\\"\\\\.kiro/tools/aidlc-learnings\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-learnings\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-log\\\\.ts|\\\"\\\\.kiro/tools/aidlc-log\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-log\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-orchestrate\\\\.ts|\\\"\\\\.kiro/tools/aidlc-orchestrate\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-orchestrate\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-plugin\\\\.ts|\\\"\\\\.kiro/tools/aidlc-plugin\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-plugin\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-review-brief\\\\.ts|\\\"\\\\.kiro/tools/aidlc-review-brief\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-review-brief\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-runner-gen\\\\.ts|\\\"\\\\.kiro/tools/aidlc-runner-gen\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-runner-gen\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-runtime\\\\.ts|\\\"\\\\.kiro/tools/aidlc-runtime\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-runtime\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-sensor-claim-sources\\\\.ts|\\\"\\\\.kiro/tools/aidlc-sensor-claim-sources\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-sensor-claim-sources\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-sensor-linter\\\\.ts|\\\"\\\\.kiro/tools/aidlc-sensor-linter\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-sensor-linter\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-sensor-required-sections\\\\.ts|\\\"\\\\.kiro/tools/aidlc-sensor-required-sections\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-sensor-required-sections\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-sensor-traceability\\\\.ts|\\\"\\\\.kiro/tools/aidlc-sensor-traceability\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-sensor-traceability\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-sensor-type-check\\\\.ts|\\\"\\\\.kiro/tools/aidlc-sensor-type-check\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-sensor-type-check\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-sensor-upstream-coverage\\\\.ts|\\\"\\\\.kiro/tools/aidlc-sensor-upstream-coverage\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-sensor-upstream-coverage\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-sensor\\\\.ts|\\\"\\\\.kiro/tools/aidlc-sensor\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-sensor\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-state\\\\.ts|\\\"\\\\.kiro/tools/aidlc-state\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-state\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-swarm\\\\.ts|\\\"\\\\.kiro/tools/aidlc-swarm\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-swarm\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-testing-posture\\\\.ts|\\\"\\\\.kiro/tools/aidlc-testing-posture\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-testing-posture\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-unit\\\\.ts|\\\"\\\\.kiro/tools/aidlc-unit\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-unit\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-utility\\\\.ts|\\\"\\\\.kiro/tools/aidlc-utility\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-utility\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-validate\\\\.ts|\\\"\\\\.kiro/tools/aidlc-validate\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-validate\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-workspace-sync\\\\.ts|\\\"\\\\.kiro/tools/aidlc-workspace-sync\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-workspace-sync\\\\.ts')( .*)?\",\n        \"bun (run )?(\\\\.kiro/tools/aidlc-worktree\\\\.ts|\\\"\\\\.kiro/tools/aidlc-worktree\\\\.ts\\\"|'\\\\.kiro/tools/aidlc-worktree\\\\.ts')( .*)?\"\n      ]\n    },\n    \"fs_write\": {\n      \"allowedPaths\": [\n        \"aidlc/spaces/**\"\n      ]\n    }\n  },\n  \"resources\": [\n    \"file://.kiro/agents/test-pro-metrics-agent.md\",\n    \"file://.kiro/knowledge/test-pro-metrics-agent/*.md\",\n    \"file://.kiro/knowledge/aidlc-shared/adding-a-repo.md\",\n    \"file://.kiro/knowledge/aidlc-shared/ai-dlc-principles.md\",\n    \"file://.kiro/knowledge/aidlc-shared/brownfield.md\",\n    \"file://.kiro/knowledge/aidlc-shared/rules-reading.md\",\n    \"file://.kiro/knowledge/aidlc-shared/verification.md\",\n    \"file://aidlc/active-memory/**/*.md\"\n  ],\n  \"hooks\": {\n    \"preToolUse\": [\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro state-transition-guard test-pro-metrics-agent; exit $LASTEXITCODE\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro review-freeze; exit $LASTEXITCODE\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro review-freeze; exit $LASTEXITCODE\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro plan-approval-guard; exit $LASTEXITCODE\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro plan-approval-guard; exit $LASTEXITCODE\",\n        \"timeout_ms\": 1800000\n      }\n    ],\n    \"postToolUse\": [\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro audit-and-sensors; exit $LASTEXITCODE\",\n        \"timeout_ms\": 3600000\n      }\n    ]\n  }\n}\n"
      },
      {
        "kind": "file",
        "path": ".kiro/knowledge/test-pro-metrics-agent/methodology.md",
        "body": "# Test Pro Metrics Methodology\n\nWhen supporting a validation stage, compare the new results against the prior\nstage's stated coverage target, then report only the deltas that affect release\nreadiness: uncovered requirements, repeated failure categories, and regressions\nin branch or API negative-path coverage.\n"
      }
    ],
    "profileText": "{\n  \"name\": \"aidlc-quality-agent\",\n  \"description\": \"AI-DLC Quality Agent - delegation target for ensemble stages (test strategy, testability, quality-gate perspective).\",\n  \"prompt\": \"file://aidlc-quality-agent.md\",\n  \"includeMcpJson\": true,\n  \"tools\": [\n    \"fs_read\",\n    \"fs_write\",\n    \"execute_bash\",\n    \"thinking\",\n    \"@context7\",\n    \"@aws-mcp\",\n    \"@aws-pricing\",\n    \"@aws-iac\",\n    \"@aws-serverless\"\n  ],\n  \"allowedTools\": [\n    \"fs_read\",\n    \"thinking\"\n  ],\n  \"toolsSettings\": {\n    \"execute_bash\": {\n      \"allowedCommands\": [\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/[A-Za-z0-9._-]+\\\\.ts[\\\"']?( .*)?\"\n      ]\n    },\n    \"fs_write\": {\n      \"allowedPaths\": [\n        \"aidlc/spaces/**\"\n      ]\n    }\n  },\n  \"resources\": [\n    \"file://.kiro/agents/aidlc-quality-agent.md\",\n    \"file://.kiro/knowledge/aidlc-quality-agent/*.md\",\n    \"file://.kiro/knowledge/aidlc-shared/*.md\",\n    \"file://aidlc/active-memory/**/*.md\"\n  ],\n  \"hooks\": {\n    \"preToolUse\": [\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"{{INVOKE}} engine adapter kiro state-transition-guard aidlc-quality-agent\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"{{INVOKE}} engine adapter kiro review-freeze\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"{{INVOKE}} engine adapter kiro review-freeze\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"{{INVOKE}} engine adapter kiro plan-approval-guard\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"{{INVOKE}} engine adapter kiro plan-approval-guard\",\n        \"timeout_ms\": 1800000\n      }\n    ],\n    \"postToolUse\": [\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"{{INVOKE}} engine adapter kiro audit-and-sensors\",\n        \"timeout_ms\": 3600000\n      }\n    ]\n  }\n}\n",
    "dispatcherCommands": [
      "doctor",
      "doctor --verbose",
      "version",
      "--doctor",
      "--doctor --verbose",
      "--version",
      "status",
      "--status",
      "config --help",
      "config --show",
      "config --show --json",
      "config models --show",
      "config models --show --json",
      "config models --help",
      "config runtime --show",
      "config runtime --show --json",
      "config runtime --help",
      "config providers --show",
      "config providers --show --json",
      "config providers --help",
      "config trust --show",
      "config trust --show --json",
      "config trust --help",
      "config flags --show",
      "config flags --show --json",
      "config flags --help",
      "config project --show",
      "config project --show --json",
      "config project --help",
      "config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes",
      "config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes",
      "config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes",
      "config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes",
      "config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes",
      "config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes",
      "config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes",
      "config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes",
      "config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes",
      "config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes",
      "config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes",
      "config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes"
    ],
    "toolScripts": [
      "aidlc-attest.ts",
      "aidlc-audit.ts",
      "aidlc-bolt.ts",
      "aidlc-completions.ts",
      "aidlc-graph.ts",
      "aidlc-jump.ts",
      "aidlc-knowledge.ts",
      "aidlc-learnings.ts",
      "aidlc-log.ts",
      "aidlc-orchestrate.ts",
      "aidlc-plugin.ts",
      "aidlc-review-brief.ts",
      "aidlc-runner-gen.ts",
      "aidlc-runtime.ts",
      "aidlc-sensor-claim-sources.ts",
      "aidlc-sensor-linter.ts",
      "aidlc-sensor-required-sections.ts",
      "aidlc-sensor-traceability.ts",
      "aidlc-sensor-type-check.ts",
      "aidlc-sensor-upstream-coverage.ts",
      "aidlc-sensor.ts",
      "aidlc-state.ts",
      "aidlc-swarm.ts",
      "aidlc-testing-posture.ts",
      "aidlc-unit.ts",
      "aidlc-utility.ts",
      "aidlc-validate.ts",
      "aidlc-workspace-sync.ts",
      "aidlc-worktree.ts"
    ],
    "sharedResources": [
      "file://.kiro/knowledge/aidlc-shared/adding-a-repo.md",
      "file://.kiro/knowledge/aidlc-shared/ai-dlc-principles.md",
      "file://.kiro/knowledge/aidlc-shared/brownfield.md",
      "file://.kiro/knowledge/aidlc-shared/rules-reading.md",
      "file://.kiro/knowledge/aidlc-shared/verification.md"
    ],
    "hookSuffix": "; exit $LASTEXITCODE",
    "commandDialect": "paired-quotes",
    "promptAdditions": [
      "tools: [\"read\", \"write\", \"shell\"]",
      "includeMcpJson: true"
    ]
  },
  {
    "baseline": "fork",
    "harness": "kiro",
    "context": {
      "harness": "kiro",
      "directory": ".kiro",
      "invocation": "bun .kiro/tools/aidlc.ts",
      "tierCap": "judgment",
      "sharedKnowledge": "all",
      "models": {
        "tiers": {
          "judgment": {
            "model": null,
            "effort": null
          },
          "balanced": {
            "model": null,
            "effort": null
          },
          "templated": {
            "model": null,
            "effort": null
          }
        },
        "explicit": "inherit"
      },
      "memoryReference": null,
      "rulesSubdir": "steering",
      "knowledgeRead": "ordinary"
    },
    "policyOrigin": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "harness/kiro/agents/aidlc-quality-agent.json"
    },
    "templateName": "aidlc-quality-agent",
    "templateAdmissions": {
      "origin": {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
        "path": "core/hooks/aidlc-state-transition-guard.ts"
      },
      "name": "aidlc-quality-agent",
      "verbs": {
        "aidlc-utility.ts": [
          "help",
          "version",
          "now",
          "status",
          "detect",
          "project-description",
          "codekb-path",
          "codekb-scope-diff",
          "codekb-snapshot",
          "codekb-publish",
          "plugin-list",
          "plugin-validate",
          "config-get",
          "config-list",
          "resolve-env-scope",
          "scope-table",
          "stage-table",
          "select-plugins",
          "document-input"
        ],
        "aidlc-state.ts": [
          "get",
          "count",
          "resume",
          "lookup"
        ],
        "aidlc-orchestrate.ts": [
          "wait",
          "team-board"
        ],
        "aidlc-jump.ts": [
          "resolve"
        ],
        "aidlc-unit.ts": [
          "merge-status",
          "status"
        ],
        "aidlc-log.ts": [
          "answers"
        ],
        "aidlc-learnings.ts": [
          "surface"
        ],
        "aidlc-runtime.ts": [
          "read",
          "summary"
        ],
        "aidlc-testing-posture.ts": [
          "resolve",
          "render",
          "verify",
          "reply",
          "brief"
        ],
        "aidlc-worktree.ts": [
          "list",
          "verify",
          "info"
        ],
        "aidlc-audit.ts": [
          "history"
        ],
        "aidlc-plugin.ts": [
          "list"
        ],
        "aidlc-graph.ts": [
          "artifacts",
          "producers",
          "consumers",
          "topo",
          "cycles",
          "scope",
          "validate-scope",
          "validate-grid",
          "ars",
          "export"
        ],
        "aidlc-sensor.ts": [
          "list",
          "describe",
          "fire"
        ],
        "aidlc-validate.ts": [
          "outputs"
        ],
        "aidlc-review-brief.ts": [
          "review",
          "context",
          "summary"
        ],
        "aidlc-attest.ts": [
          "resolve"
        ],
        "aidlc-knowledge.ts": [
          "list",
          "show"
        ]
      }
    },
    "targetAdmissions": {
      "origin": {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
        "path": "core/hooks/aidlc-state-transition-guard.ts"
      },
      "name": "test-pro-metrics-agent",
      "verbs": {
        "aidlc-utility.ts": [
          "help",
          "version",
          "now",
          "status",
          "detect",
          "project-description",
          "codekb-path",
          "codekb-scope-diff",
          "codekb-snapshot",
          "codekb-publish",
          "plugin-list",
          "plugin-validate",
          "config-get",
          "config-list",
          "resolve-env-scope",
          "scope-table",
          "stage-table",
          "select-plugins",
          "document-input"
        ],
        "aidlc-state.ts": [
          "get",
          "count",
          "resume",
          "lookup"
        ],
        "aidlc-orchestrate.ts": [
          "wait",
          "team-board"
        ],
        "aidlc-jump.ts": [
          "resolve"
        ],
        "aidlc-unit.ts": [
          "merge-status",
          "status"
        ],
        "aidlc-log.ts": [
          "answers"
        ],
        "aidlc-learnings.ts": [
          "surface"
        ],
        "aidlc-runtime.ts": [
          "read",
          "summary"
        ],
        "aidlc-testing-posture.ts": [
          "resolve",
          "render",
          "verify",
          "reply",
          "brief"
        ],
        "aidlc-worktree.ts": [
          "list",
          "verify",
          "info"
        ],
        "aidlc-audit.ts": [
          "history"
        ],
        "aidlc-plugin.ts": [
          "list"
        ],
        "aidlc-graph.ts": [
          "artifacts",
          "producers",
          "consumers",
          "topo",
          "cycles",
          "scope",
          "validate-scope",
          "validate-grid",
          "ars",
          "export"
        ],
        "aidlc-sensor.ts": [
          "list",
          "describe",
          "fire"
        ],
        "aidlc-validate.ts": [
          "outputs"
        ],
        "aidlc-review-brief.ts": [
          "review",
          "context",
          "summary"
        ],
        "aidlc-attest.ts": [
          "resolve"
        ],
        "aidlc-knowledge.ts": [
          "list",
          "show"
        ]
      }
    },
    "admissionMismatch": {
      "aidlc-utility.ts": [
        "help",
        "version",
        "now",
        "status",
        "detect",
        "project-description",
        "codekb-path",
        "codekb-scope-diff",
        "codekb-snapshot",
        "codekb-publish",
        "plugin-list",
        "plugin-validate",
        "config-get",
        "config-list",
        "resolve-env-scope",
        "scope-table",
        "stage-table",
        "select-plugins",
        "document-input"
      ],
      "aidlc-state.ts": [
        "get",
        "count",
        "resume",
        "lookup"
      ],
      "aidlc-orchestrate.ts": [
        "wait",
        "team-board"
      ],
      "aidlc-jump.ts": [
        "resolve"
      ],
      "aidlc-unit.ts": [
        "merge-status",
        "status"
      ],
      "aidlc-log.ts": [
        "answers"
      ],
      "aidlc-learnings.ts": [
        "surface"
      ],
      "aidlc-runtime.ts": [
        "read",
        "summary"
      ],
      "aidlc-testing-posture.ts": [
        "resolve",
        "render",
        "verify",
        "reply",
        "brief"
      ],
      "aidlc-worktree.ts": [
        "list",
        "verify",
        "info",
        "create",
        "merge",
        "discard",
        "restore"
      ],
      "aidlc-audit.ts": [
        "history"
      ],
      "aidlc-plugin.ts": [
        "list"
      ],
      "aidlc-graph.ts": [
        "artifacts",
        "producers",
        "consumers",
        "topo",
        "cycles",
        "scope",
        "validate-scope",
        "validate-grid",
        "ars",
        "export"
      ],
      "aidlc-sensor.ts": [
        "list",
        "describe",
        "fire"
      ],
      "aidlc-validate.ts": [
        "outputs"
      ],
      "aidlc-review-brief.ts": [
        "review",
        "context",
        "summary"
      ],
      "aidlc-attest.ts": [
        "resolve"
      ],
      "aidlc-knowledge.ts": [
        "list",
        "show"
      ]
    },
    "classification": "curated-native-plugin-improvement",
    "expected": [
      {
        "kind": "file",
        "path": ".kiro/agents/test-pro-metrics-agent.md",
        "body": "---\nname: test-pro-metrics-agent\ndisplay_name: Test Pro Metrics Agent\nplugin: test-pro\nexamples:\n  - methodology.md\ndescription: >\n  Testing metrics specialist responsible for coverage interpretation, defect trends, and release-quality evidence.\n---\n<!-- aidlc-delegated-knowledge-preflight -->\n**Delegated knowledge preflight (mandatory):** Before substantive work, ensure every readable Markdown file under these directories is loaded, in order: `.kiro/knowledge/aidlc-shared/`, `.kiro/knowledge/test-pro-metrics-agent/`, `aidlc/spaces/<active-space>/knowledge/aidlc-shared/`, then `aidlc/spaces/<active-space>/knowledge/test-pro-metrics-agent/`. A native resource preload satisfies this requirement; otherwise read the files now. The dispatch brief supplies rules and artifact paths separately.\n\n\n# Test Pro Metrics Agent\n\nYou are a testing metrics specialist. You interpret coverage, defect, and\nquality-gate signals into concise release evidence for the test-pro validation\npath.\n\n## Core Responsibilities\n\n- Summarize coverage deltas and gaps across unit, integration, and regression suites.\n- Identify defect trends that affect release readiness.\n- Translate raw test results into pass/fail evidence tied to requirements.\n\n## Stages Supported\n\n**Supporting:**\n- test-pro-integration — Cross-Unit Integration Testing (Construction)\n\n## Memory Focus\n\n`.kiro/steering/` — organization and project guardrails\n\n## Key Principles\n\n1. **Metrics explain risk** — Report what the numbers imply for release confidence.\n2. **Trace evidence to requirements** — Coverage without requirement context is incomplete.\n3. **Prefer concise signals** — Highlight the few gaps that change a decision.\n"
      },
      {
        "kind": "file",
        "path": ".kiro/agents/test-pro-metrics-agent.json",
        "body": "{\n  \"name\": \"test-pro-metrics-agent\",\n  \"description\": \"Testing metrics specialist responsible for coverage interpretation, defect trends, and release-quality evidence.\",\n  \"prompt\": \"file://test-pro-metrics-agent.md\",\n  \"includeMcpJson\": true,\n  \"tools\": [\n    \"fs_read\",\n    \"fs_write\",\n    \"execute_bash\",\n    \"thinking\",\n    \"@context7\",\n    \"@aws-mcp\",\n    \"@aws-pricing\",\n    \"@aws-iac\",\n    \"@aws-serverless\"\n  ],\n  \"allowedTools\": [\n    \"fs_read\",\n    \"thinking\"\n  ],\n  \"toolsSettings\": {\n    \"execute_bash\": {\n      \"allowedCommands\": [\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? engine( .*)?\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? doctor\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? doctor --verbose\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? version\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? --doctor\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? --doctor --verbose\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? --version\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? status\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? --status\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config --help\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config --show\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config --show --json\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config models --show\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config models --show --json\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config models --help\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config runtime --show\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config runtime --show --json\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config runtime --help\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config providers --show\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config providers --show --json\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config providers --help\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config trust --show\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config trust --show --json\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config trust --help\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --show\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --show --json\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --help\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config project --show\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config project --show --json\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config project --help\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/aidlc\\\\.ts[\\\"']? config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes\",\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/(aidlc-attest|aidlc-audit|aidlc-bolt|aidlc-completions|aidlc-graph|aidlc-jump|aidlc-knowledge|aidlc-learnings|aidlc-log|aidlc-orchestrate|aidlc-plugin|aidlc-review-brief|aidlc-runner-gen|aidlc-runtime|aidlc-sensor-claim-sources|aidlc-sensor-linter|aidlc-sensor-required-sections|aidlc-sensor-traceability|aidlc-sensor-type-check|aidlc-sensor-upstream-coverage|aidlc-sensor|aidlc-state|aidlc-swarm|aidlc-testing-posture|aidlc-unit|aidlc-utility|aidlc-validate|aidlc-workspace-sync|aidlc-worktree)\\\\.ts[\\\"']?( .*)?\"\n      ],\n      \"deniedCommands\": [\n        \"([^\\\\s]*/)?rm( [^\\\\s]+)* -[A-Za-z]*[rR][A-Za-z]*( .*)?\",\n        \"([^\\\\s]*/)?rm( [^\\\\s]+)* --recursive( .*)?\",\n        \"([^\\\\s]*/)?git( -[^\\\\s]+( (\\\"[^\\\"]*\\\"|'[^']*'|[^\\\\s]+))?)* push( .*)?\"\n      ]\n    },\n    \"fs_write\": {\n      \"allowedPaths\": [\n        \"aidlc/spaces/**\"\n      ]\n    }\n  },\n  \"resources\": [\n    \"file://.kiro/agents/test-pro-metrics-agent.md\",\n    \"file://.kiro/knowledge/test-pro-metrics-agent/*.md\",\n    \"file://.kiro/knowledge/aidlc-shared/*.md\",\n    \"file://aidlc/spaces/default/memory/**/*.md\"\n  ],\n  \"hooks\": {\n    \"preToolUse\": [\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro state-transition-guard test-pro-metrics-agent\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro review-freeze\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro review-freeze\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro plan-approval-guard\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro plan-approval-guard\",\n        \"timeout_ms\": 1800000\n      }\n    ],\n    \"postToolUse\": [\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"bun .kiro/tools/aidlc.ts engine adapter kiro audit-and-sensors\",\n        \"timeout_ms\": 3600000\n      }\n    ]\n  }\n}\n"
      },
      {
        "kind": "file",
        "path": ".kiro/knowledge/test-pro-metrics-agent/methodology.md",
        "body": "# Test Pro Metrics Methodology\n\nWhen supporting a validation stage, compare the new results against the prior\nstage's stated coverage target, then report only the deltas that affect release\nreadiness: uncovered requirements, repeated failure categories, and regressions\nin branch or API negative-path coverage.\n"
      }
    ],
    "profileText": "{\n  \"name\": \"aidlc-quality-agent\",\n  \"description\": \"AI-DLC Quality Agent - delegation target for ensemble stages (test strategy, testability, quality-gate perspective).\",\n  \"prompt\": \"file://aidlc-quality-agent.md\",\n  \"includeMcpJson\": true,\n  \"tools\": [\n    \"fs_read\",\n    \"fs_write\",\n    \"execute_bash\",\n    \"thinking\",\n    \"@context7\",\n    \"@aws-mcp\",\n    \"@aws-pricing\",\n    \"@aws-iac\",\n    \"@aws-serverless\"\n  ],\n  \"allowedTools\": [\n    \"fs_read\",\n    \"thinking\"\n  ],\n  \"toolsSettings\": {\n    \"execute_bash\": {\n      \"allowedCommands\": [\n        \"bun (run )?[\\\"']?\\\\.kiro/tools/[A-Za-z0-9._-]+\\\\.ts[\\\"']?( .*)?\"\n      ],\n      \"deniedCommands\": [\n        \"([^\\\\s]*/)?rm( [^\\\\s]+)* -[A-Za-z]*[rR][A-Za-z]*( .*)?\",\n        \"([^\\\\s]*/)?rm( [^\\\\s]+)* --recursive( .*)?\",\n        \"([^\\\\s]*/)?git( -[^\\\\s]+( (\\\"[^\\\"]*\\\"|'[^']*'|[^\\\\s]+))?)* push( .*)?\"\n      ]\n    },\n    \"fs_write\": {\n      \"allowedPaths\": [\n        \"aidlc/spaces/**\"\n      ]\n    }\n  },\n  \"resources\": [\n    \"file://.kiro/agents/aidlc-quality-agent.md\",\n    \"file://.kiro/knowledge/aidlc-quality-agent/*.md\",\n    \"file://.kiro/knowledge/aidlc-shared/*.md\",\n    \"file://aidlc/spaces/default/memory/**/*.md\"\n  ],\n  \"hooks\": {\n    \"preToolUse\": [\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"{{INVOKE}} engine adapter kiro state-transition-guard aidlc-quality-agent\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"{{INVOKE}} engine adapter kiro review-freeze\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"{{INVOKE}} engine adapter kiro review-freeze\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"{{INVOKE}} engine adapter kiro plan-approval-guard\",\n        \"timeout_ms\": 1800000\n      },\n      {\n        \"matcher\": \"execute_bash\",\n        \"command\": \"{{INVOKE}} engine adapter kiro plan-approval-guard\",\n        \"timeout_ms\": 1800000\n      }\n    ],\n    \"postToolUse\": [\n      {\n        \"matcher\": \"fs_write\",\n        \"command\": \"{{INVOKE}} engine adapter kiro audit-and-sensors\",\n        \"timeout_ms\": 3600000\n      }\n    ]\n  }\n}\n",
    "dispatcherCommands": [
      "doctor",
      "doctor --verbose",
      "version",
      "--doctor",
      "--doctor --verbose",
      "--version",
      "status",
      "--status",
      "config --help",
      "config --show",
      "config --show --json",
      "config models --show",
      "config models --show --json",
      "config models --help",
      "config runtime --show",
      "config runtime --show --json",
      "config runtime --help",
      "config providers --show",
      "config providers --show --json",
      "config providers --help",
      "config trust --show",
      "config trust --show --json",
      "config trust --help",
      "config flags --show",
      "config flags --show --json",
      "config flags --help",
      "config project --show",
      "config project --show --json",
      "config project --help",
      "config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes",
      "config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes",
      "config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes",
      "config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes",
      "config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes",
      "config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes",
      "config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes",
      "config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes",
      "config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes",
      "config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes",
      "config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes",
      "config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes"
    ],
    "toolScripts": [
      "aidlc-attest.ts",
      "aidlc-audit.ts",
      "aidlc-bolt.ts",
      "aidlc-completions.ts",
      "aidlc-graph.ts",
      "aidlc-jump.ts",
      "aidlc-knowledge.ts",
      "aidlc-learnings.ts",
      "aidlc-log.ts",
      "aidlc-orchestrate.ts",
      "aidlc-plugin.ts",
      "aidlc-review-brief.ts",
      "aidlc-runner-gen.ts",
      "aidlc-runtime.ts",
      "aidlc-sensor-claim-sources.ts",
      "aidlc-sensor-linter.ts",
      "aidlc-sensor-required-sections.ts",
      "aidlc-sensor-traceability.ts",
      "aidlc-sensor-type-check.ts",
      "aidlc-sensor-upstream-coverage.ts",
      "aidlc-sensor.ts",
      "aidlc-state.ts",
      "aidlc-swarm.ts",
      "aidlc-testing-posture.ts",
      "aidlc-unit.ts",
      "aidlc-utility.ts",
      "aidlc-validate.ts",
      "aidlc-workspace-sync.ts",
      "aidlc-worktree.ts"
    ],
    "sharedResources": null,
    "hookSuffix": "",
    "commandDialect": "optional-quotes",
    "promptAdditions": []
  }
];
const kasRows: readonly ({readonly baseline: string; readonly harness: string; readonly context: AgentContext; readonly policyOrigin: AgentOrigin; readonly templateName: string; readonly templateAdmissions: WorkerAdmissions; readonly targetAdmissions: WorkerAdmissions; readonly admissionMismatch: WorkerAdmissions["verbs"]; readonly classification: string; readonly expected: readonly NativeResource[]; readonly policyLines: readonly string[]; readonly denialComparison: string;})[] = [
  {
    "baseline": "upstream",
    "harness": "kiro-ide",
    "context": {
      "harness": "kiro-ide",
      "directory": ".kiro",
      "invocation": "bun .kiro/tools/aidlc.ts",
      "tierCap": "judgment",
      "sharedKnowledge": "methodology-only",
      "models": {
        "tiers": {
          "judgment": {
            "model": null,
            "effort": null
          },
          "balanced": {
            "model": null,
            "effort": null
          },
          "templated": {
            "model": null,
            "effort": null
          }
        },
        "explicit": "inherit"
      },
      "memoryReference": null,
      "rulesSubdir": "steering",
      "knowledgeRead": "ordinary"
    },
    "policyOrigin": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "cc6f50d678da7a7a0228e47bb7429ed22f952a77",
      "path": "harness/kiro-ide/manifest.ts"
    },
    "templateName": "aidlc-quality-agent",
    "templateAdmissions": {
      "origin": {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "cc6f50d678da7a7a0228e47bb7429ed22f952a77",
        "path": "core/hooks/aidlc-state-transition-guard.ts"
      },
      "name": "aidlc-quality-agent",
      "verbs": {
        "aidlc-utility.ts": [
          "help",
          "version",
          "now",
          "status",
          "detect",
          "project-description",
          "codekb-path",
          "codekb-scope-diff",
          "codekb-snapshot",
          "codekb-publish",
          "plugin-list",
          "plugin-validate",
          "config-get",
          "config-list",
          "resolve-env-scope",
          "scope-table",
          "stage-table",
          "select-plugins",
          "document-input"
        ],
        "aidlc-state.ts": [
          "get",
          "count",
          "resume",
          "lookup"
        ],
        "aidlc-orchestrate.ts": [
          "wait",
          "team-board"
        ],
        "aidlc-jump.ts": [
          "resolve"
        ],
        "aidlc-unit.ts": [
          "merge-status",
          "status"
        ],
        "aidlc-log.ts": [
          "answers"
        ],
        "aidlc-learnings.ts": [
          "surface"
        ],
        "aidlc-runtime.ts": [
          "read",
          "summary"
        ],
        "aidlc-testing-posture.ts": [
          "resolve",
          "render",
          "verify",
          "reply",
          "brief"
        ],
        "aidlc-swarm.ts": [
          "check"
        ],
        "aidlc-worktree.ts": [
          "list",
          "verify",
          "info"
        ],
        "aidlc-audit.ts": [
          "history"
        ],
        "aidlc-plugin.ts": [
          "list"
        ],
        "aidlc-graph.ts": [
          "artifacts",
          "producers",
          "consumers",
          "topo",
          "cycles",
          "scope",
          "validate-scope",
          "validate-grid",
          "ars",
          "export"
        ],
        "aidlc-sensor.ts": [
          "list",
          "describe",
          "fire"
        ],
        "aidlc-validate.ts": [
          "outputs"
        ],
        "aidlc-review-brief.ts": [
          "review",
          "context",
          "summary"
        ],
        "aidlc-attest.ts": [
          "resolve"
        ],
        "aidlc-knowledge.ts": [
          "list",
          "show"
        ]
      }
    },
    "targetAdmissions": {
      "origin": {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "cc6f50d678da7a7a0228e47bb7429ed22f952a77",
        "path": "core/hooks/aidlc-state-transition-guard.ts"
      },
      "name": "test-pro-metrics-agent",
      "verbs": {
        "aidlc-utility.ts": [
          "help",
          "version",
          "now",
          "status",
          "detect",
          "project-description",
          "codekb-path",
          "codekb-scope-diff",
          "codekb-snapshot",
          "codekb-publish",
          "plugin-list",
          "plugin-validate",
          "config-get",
          "config-list",
          "resolve-env-scope",
          "scope-table",
          "stage-table",
          "select-plugins",
          "document-input"
        ],
        "aidlc-state.ts": [
          "get",
          "count",
          "resume",
          "lookup"
        ],
        "aidlc-orchestrate.ts": [
          "wait",
          "team-board"
        ],
        "aidlc-jump.ts": [
          "resolve"
        ],
        "aidlc-unit.ts": [
          "merge-status",
          "status"
        ],
        "aidlc-log.ts": [
          "answers"
        ],
        "aidlc-learnings.ts": [
          "surface"
        ],
        "aidlc-runtime.ts": [
          "read",
          "summary"
        ],
        "aidlc-testing-posture.ts": [
          "resolve",
          "render",
          "verify",
          "reply",
          "brief"
        ],
        "aidlc-swarm.ts": [
          "check"
        ],
        "aidlc-worktree.ts": [
          "list",
          "verify",
          "info"
        ],
        "aidlc-audit.ts": [
          "history"
        ],
        "aidlc-plugin.ts": [
          "list"
        ],
        "aidlc-graph.ts": [
          "artifacts",
          "producers",
          "consumers",
          "topo",
          "cycles",
          "scope",
          "validate-scope",
          "validate-grid",
          "ars",
          "export"
        ],
        "aidlc-sensor.ts": [
          "list",
          "describe",
          "fire"
        ],
        "aidlc-validate.ts": [
          "outputs"
        ],
        "aidlc-review-brief.ts": [
          "review",
          "context",
          "summary"
        ],
        "aidlc-attest.ts": [
          "resolve"
        ],
        "aidlc-knowledge.ts": [
          "list",
          "show"
        ]
      }
    },
    "admissionMismatch": {
      "aidlc-utility.ts": [
        "help",
        "version",
        "now",
        "status",
        "detect",
        "project-description",
        "codekb-path",
        "codekb-scope-diff",
        "codekb-snapshot",
        "codekb-publish",
        "plugin-list",
        "plugin-validate",
        "config-get",
        "config-list",
        "resolve-env-scope",
        "scope-table",
        "stage-table",
        "select-plugins",
        "document-input"
      ],
      "aidlc-state.ts": [
        "get",
        "count",
        "resume",
        "lookup"
      ],
      "aidlc-orchestrate.ts": [
        "wait",
        "team-board"
      ],
      "aidlc-jump.ts": [
        "resolve"
      ],
      "aidlc-unit.ts": [
        "merge-status",
        "status"
      ],
      "aidlc-log.ts": [
        "answers"
      ],
      "aidlc-learnings.ts": [
        "surface"
      ],
      "aidlc-runtime.ts": [
        "read",
        "summary"
      ],
      "aidlc-testing-posture.ts": [
        "resolve",
        "render",
        "verify",
        "reply",
        "brief"
      ],
      "aidlc-swarm.ts": [
        "check"
      ],
      "aidlc-worktree.ts": [
        "list",
        "verify",
        "info",
        "create",
        "merge",
        "discard",
        "restore"
      ],
      "aidlc-audit.ts": [
        "history"
      ],
      "aidlc-plugin.ts": [
        "list"
      ],
      "aidlc-graph.ts": [
        "artifacts",
        "producers",
        "consumers",
        "topo",
        "cycles",
        "scope",
        "validate-scope",
        "validate-grid",
        "ars",
        "export"
      ],
      "aidlc-sensor.ts": [
        "list",
        "describe",
        "fire"
      ],
      "aidlc-validate.ts": [
        "outputs"
      ],
      "aidlc-review-brief.ts": [
        "review",
        "context",
        "summary"
      ],
      "aidlc-attest.ts": [
        "resolve"
      ],
      "aidlc-knowledge.ts": [
        "list",
        "show"
      ]
    },
    "classification": "curated-native-plugin-improvement",
    "expected": [
      {
        "kind": "file",
        "path": ".kiro/agents/test-pro-metrics-agent.md",
        "body": "---\nname: test-pro-metrics-agent\ndisplay_name: Test Pro Metrics Agent\nplugin: test-pro\nexamples:\n  - methodology.md\ndescription: >\n  Testing metrics specialist responsible for coverage interpretation, defect trends, and release-quality evidence.\ntools: [\"read\", \"write\", \"shell\"]\nincludeMcpJson: true\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"bun .kiro/tools/aidlc-*\"\n        - \"bun .kiro/tools/aidlc.ts engine *\"\n        - \"bun --version\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine config set *\"\n        - \"bun .kiro/tools/aidlc.ts engine adapter *\"\n        - \"bun .kiro/tools/aidlc*$*\"\n        - \"bun .kiro/tools/aidlc*`*\"\n        - \"bun .kiro/tools/aidlc*>*\"\n        - \"bun .kiro/tools/aidlc*<*\"\n        - \"bun .kiro/tools/aidlc*&*\"\n        - \"bun .kiro/tools/aidlc*@(*\"\n        - \"bun .kiro/tools/aidlc*@{*\"\n        - \"bun .kiro/tools/aidlc*\\n*\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-*\"\n        - \"bun .kiro/tools/aidlc.ts engine *\"\n        - \"bun .kiro/tools/aidlc.ts doctor\"\n        - \"bun .kiro/tools/aidlc.ts doctor --verbose\"\n        - \"bun .kiro/tools/aidlc.ts version\"\n        - \"bun .kiro/tools/aidlc.ts --doctor\"\n        - \"bun .kiro/tools/aidlc.ts --doctor --verbose\"\n        - \"bun .kiro/tools/aidlc.ts --version\"\n        - \"bun .kiro/tools/aidlc.ts status\"\n        - \"bun .kiro/tools/aidlc.ts --status\"\n        - \"bun .kiro/tools/aidlc.ts config --help\"\n        - \"bun .kiro/tools/aidlc.ts config --show\"\n        - \"bun .kiro/tools/aidlc.ts config --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config models --show\"\n        - \"bun .kiro/tools/aidlc.ts config models --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config models --help\"\n        - \"bun .kiro/tools/aidlc.ts config runtime --show\"\n        - \"bun .kiro/tools/aidlc.ts config runtime --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config runtime --help\"\n        - \"bun .kiro/tools/aidlc.ts config providers --show\"\n        - \"bun .kiro/tools/aidlc.ts config providers --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config providers --help\"\n        - \"bun .kiro/tools/aidlc.ts config trust --show\"\n        - \"bun .kiro/tools/aidlc.ts config trust --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config trust --help\"\n        - \"bun .kiro/tools/aidlc.ts config flags --show\"\n        - \"bun .kiro/tools/aidlc.ts config flags --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config flags --help\"\n        - \"bun .kiro/tools/aidlc.ts config project --show\"\n        - \"bun .kiro/tools/aidlc.ts config project --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config project --help\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-attest.ts\"\n        - \"bun .kiro/tools/aidlc-attest.ts *\"\n        - \"bun .kiro/tools/aidlc-audit.ts\"\n        - \"bun .kiro/tools/aidlc-audit.ts *\"\n        - \"bun .kiro/tools/aidlc-graph.ts\"\n        - \"bun .kiro/tools/aidlc-graph.ts *\"\n        - \"bun .kiro/tools/aidlc-jump.ts\"\n        - \"bun .kiro/tools/aidlc-jump.ts *\"\n        - \"bun .kiro/tools/aidlc-knowledge.ts\"\n        - \"bun .kiro/tools/aidlc-knowledge.ts *\"\n        - \"bun .kiro/tools/aidlc-learnings.ts\"\n        - \"bun .kiro/tools/aidlc-learnings.ts *\"\n        - \"bun .kiro/tools/aidlc-log.ts\"\n        - \"bun .kiro/tools/aidlc-log.ts *\"\n        - \"bun .kiro/tools/aidlc-orchestrate.ts\"\n        - \"bun .kiro/tools/aidlc-orchestrate.ts *\"\n        - \"bun .kiro/tools/aidlc-plugin.ts\"\n        - \"bun .kiro/tools/aidlc-plugin.ts *\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts *\"\n        - \"bun .kiro/tools/aidlc-runtime.ts\"\n        - \"bun .kiro/tools/aidlc-runtime.ts *\"\n        - \"bun .kiro/tools/aidlc-sensor.ts\"\n        - \"bun .kiro/tools/aidlc-sensor.ts *\"\n        - \"bun .kiro/tools/aidlc-state.ts\"\n        - \"bun .kiro/tools/aidlc-state.ts *\"\n        - \"bun .kiro/tools/aidlc-swarm.ts\"\n        - \"bun .kiro/tools/aidlc-swarm.ts *\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts *\"\n        - \"bun .kiro/tools/aidlc-unit.ts\"\n        - \"bun .kiro/tools/aidlc-unit.ts *\"\n        - \"bun .kiro/tools/aidlc-utility.ts\"\n        - \"bun .kiro/tools/aidlc-utility.ts *\"\n        - \"bun .kiro/tools/aidlc-validate.ts\"\n        - \"bun .kiro/tools/aidlc-validate.ts *\"\n        - \"bun .kiro/tools/aidlc-worktree.ts\"\n        - \"bun .kiro/tools/aidlc-worktree.ts *\"\n        - \"bun .kiro/tools/aidlc.ts engine intent\"\n        - \"bun .kiro/tools/aidlc.ts engine intent *\"\n        - \"bun .kiro/tools/aidlc.ts engine space\"\n        - \"bun .kiro/tools/aidlc.ts engine space *\"\n        - \"bun .kiro/tools/aidlc.ts engine status\"\n        - \"bun .kiro/tools/aidlc.ts engine status *\"\n        - \"bun .kiro/tools/aidlc.ts engine now\"\n        - \"bun .kiro/tools/aidlc.ts engine now *\"\n        - \"bun .kiro/tools/aidlc.ts engine state\"\n        - \"bun .kiro/tools/aidlc.ts engine state *\"\n        - \"bun .kiro/tools/aidlc.ts engine audit\"\n        - \"bun .kiro/tools/aidlc.ts engine audit *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph\"\n        - \"bun .kiro/tools/aidlc.ts engine graph *\"\n        - \"bun .kiro/tools/aidlc.ts engine runtime\"\n        - \"bun .kiro/tools/aidlc.ts engine runtime *\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor *\"\n        - \"bun .kiro/tools/aidlc.ts engine swarm\"\n        - \"bun .kiro/tools/aidlc.ts engine swarm *\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree *\"\n        - \"bun .kiro/tools/aidlc.ts engine jump\"\n        - \"bun .kiro/tools/aidlc.ts engine jump *\"\n        - \"bun .kiro/tools/aidlc.ts engine log\"\n        - \"bun .kiro/tools/aidlc.ts engine log *\"\n        - \"bun .kiro/tools/aidlc.ts engine learnings\"\n        - \"bun .kiro/tools/aidlc.ts engine learnings *\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture *\"\n        - \"bun .kiro/tools/aidlc.ts engine validate\"\n        - \"bun .kiro/tools/aidlc.ts engine validate *\"\n        - \"bun .kiro/tools/aidlc.ts engine scope\"\n        - \"bun .kiro/tools/aidlc.ts engine scope *\"\n        - \"bun .kiro/tools/aidlc.ts engine config\"\n        - \"bun .kiro/tools/aidlc.ts engine config *\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin *\"\n        - \"bun .kiro/tools/aidlc.ts engine knowledge\"\n        - \"bun .kiro/tools/aidlc.ts engine knowledge *\"\n        - \"bun .kiro/tools/aidlc.ts engine gen\"\n        - \"bun .kiro/tools/aidlc.ts engine gen *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace *\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief *\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-attest.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-attest.ts resolve\"\n        - \"bun .kiro/tools/aidlc-attest.ts resolve *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-audit.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-audit.ts history\"\n        - \"bun .kiro/tools/aidlc-audit.ts history *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-graph.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-graph.ts artifacts\"\n        - \"bun .kiro/tools/aidlc-graph.ts artifacts *\"\n        - \"bun .kiro/tools/aidlc-graph.ts producers\"\n        - \"bun .kiro/tools/aidlc-graph.ts producers *\"\n        - \"bun .kiro/tools/aidlc-graph.ts consumers\"\n        - \"bun .kiro/tools/aidlc-graph.ts consumers *\"\n        - \"bun .kiro/tools/aidlc-graph.ts topo\"\n        - \"bun .kiro/tools/aidlc-graph.ts topo *\"\n        - \"bun .kiro/tools/aidlc-graph.ts cycles\"\n        - \"bun .kiro/tools/aidlc-graph.ts cycles *\"\n        - \"bun .kiro/tools/aidlc-graph.ts scope\"\n        - \"bun .kiro/tools/aidlc-graph.ts scope *\"\n        - \"bun .kiro/tools/aidlc-graph.ts validate-scope\"\n        - \"bun .kiro/tools/aidlc-graph.ts validate-scope *\"\n        - \"bun .kiro/tools/aidlc-graph.ts validate-grid\"\n        - \"bun .kiro/tools/aidlc-graph.ts validate-grid *\"\n        - \"bun .kiro/tools/aidlc-graph.ts ars\"\n        - \"bun .kiro/tools/aidlc-graph.ts ars *\"\n        - \"bun .kiro/tools/aidlc-graph.ts export\"\n        - \"bun .kiro/tools/aidlc-graph.ts export *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-jump.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-jump.ts resolve\"\n        - \"bun .kiro/tools/aidlc-jump.ts resolve *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-knowledge.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-knowledge.ts list\"\n        - \"bun .kiro/tools/aidlc-knowledge.ts list *\"\n        - \"bun .kiro/tools/aidlc-knowledge.ts show\"\n        - \"bun .kiro/tools/aidlc-knowledge.ts show *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-learnings.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-learnings.ts surface\"\n        - \"bun .kiro/tools/aidlc-learnings.ts surface *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-log.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-log.ts answers\"\n        - \"bun .kiro/tools/aidlc-log.ts answers *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-orchestrate.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-orchestrate.ts wait\"\n        - \"bun .kiro/tools/aidlc-orchestrate.ts wait *\"\n        - \"bun .kiro/tools/aidlc-orchestrate.ts team-board\"\n        - \"bun .kiro/tools/aidlc-orchestrate.ts team-board *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-plugin.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-plugin.ts list\"\n        - \"bun .kiro/tools/aidlc-plugin.ts list *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-review-brief.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-review-brief.ts review\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts review *\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts context\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts context *\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts summary\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts summary *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-runtime.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-runtime.ts read\"\n        - \"bun .kiro/tools/aidlc-runtime.ts read *\"\n        - \"bun .kiro/tools/aidlc-runtime.ts summary\"\n        - \"bun .kiro/tools/aidlc-runtime.ts summary *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-sensor.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-sensor.ts list\"\n        - \"bun .kiro/tools/aidlc-sensor.ts list *\"\n        - \"bun .kiro/tools/aidlc-sensor.ts describe\"\n        - \"bun .kiro/tools/aidlc-sensor.ts describe *\"\n        - \"bun .kiro/tools/aidlc-sensor.ts fire\"\n        - \"bun .kiro/tools/aidlc-sensor.ts fire *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-state.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-state.ts get\"\n        - \"bun .kiro/tools/aidlc-state.ts get *\"\n        - \"bun .kiro/tools/aidlc-state.ts count\"\n        - \"bun .kiro/tools/aidlc-state.ts count *\"\n        - \"bun .kiro/tools/aidlc-state.ts resume\"\n        - \"bun .kiro/tools/aidlc-state.ts resume *\"\n        - \"bun .kiro/tools/aidlc-state.ts lookup\"\n        - \"bun .kiro/tools/aidlc-state.ts lookup *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-swarm.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-swarm.ts check\"\n        - \"bun .kiro/tools/aidlc-swarm.ts check *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-testing-posture.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-testing-posture.ts resolve\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts resolve *\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts render\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts render *\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts verify\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts verify *\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts reply\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts reply *\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts brief\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts brief *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-unit.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-unit.ts merge-status\"\n        - \"bun .kiro/tools/aidlc-unit.ts merge-status *\"\n        - \"bun .kiro/tools/aidlc-unit.ts status\"\n        - \"bun .kiro/tools/aidlc-unit.ts status *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-utility.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-utility.ts help\"\n        - \"bun .kiro/tools/aidlc-utility.ts help *\"\n        - \"bun .kiro/tools/aidlc-utility.ts version\"\n        - \"bun .kiro/tools/aidlc-utility.ts version *\"\n        - \"bun .kiro/tools/aidlc-utility.ts now\"\n        - \"bun .kiro/tools/aidlc-utility.ts now *\"\n        - \"bun .kiro/tools/aidlc-utility.ts status\"\n        - \"bun .kiro/tools/aidlc-utility.ts status *\"\n        - \"bun .kiro/tools/aidlc-utility.ts detect\"\n        - \"bun .kiro/tools/aidlc-utility.ts detect *\"\n        - \"bun .kiro/tools/aidlc-utility.ts project-description\"\n        - \"bun .kiro/tools/aidlc-utility.ts project-description *\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-path\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-path *\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-scope-diff\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-scope-diff *\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-snapshot\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-snapshot *\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-publish\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-publish *\"\n        - \"bun .kiro/tools/aidlc-utility.ts plugin-list\"\n        - \"bun .kiro/tools/aidlc-utility.ts plugin-list *\"\n        - \"bun .kiro/tools/aidlc-utility.ts plugin-validate\"\n        - \"bun .kiro/tools/aidlc-utility.ts plugin-validate *\"\n        - \"bun .kiro/tools/aidlc-utility.ts config-get\"\n        - \"bun .kiro/tools/aidlc-utility.ts config-get *\"\n        - \"bun .kiro/tools/aidlc-utility.ts config-list\"\n        - \"bun .kiro/tools/aidlc-utility.ts config-list *\"\n        - \"bun .kiro/tools/aidlc-utility.ts resolve-env-scope\"\n        - \"bun .kiro/tools/aidlc-utility.ts resolve-env-scope *\"\n        - \"bun .kiro/tools/aidlc-utility.ts scope-table\"\n        - \"bun .kiro/tools/aidlc-utility.ts scope-table *\"\n        - \"bun .kiro/tools/aidlc-utility.ts stage-table\"\n        - \"bun .kiro/tools/aidlc-utility.ts stage-table *\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --json\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --quiet\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --no-color\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --yes\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --offline\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --verbose\"\n        - \"bun .kiro/tools/aidlc-utility.ts document-input\"\n        - \"bun .kiro/tools/aidlc-utility.ts document-input *\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --json\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --quiet\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --no-color\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --yes\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --offline\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --verbose\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent list\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent list *\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --json\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --quiet\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --no-color\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --yes\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --offline\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --verbose\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent help\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent help *\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent -h\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent -h *\"\n        - \"bun .kiro/tools/aidlc-utility.ts space\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --json\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --quiet\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --no-color\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --yes\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --offline\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --verbose\"\n        - \"bun .kiro/tools/aidlc-utility.ts space list\"\n        - \"bun .kiro/tools/aidlc-utility.ts space list *\"\n        - \"bun .kiro/tools/aidlc-utility.ts space help\"\n        - \"bun .kiro/tools/aidlc-utility.ts space help *\"\n        - \"bun .kiro/tools/aidlc-utility.ts space -h\"\n        - \"bun .kiro/tools/aidlc-utility.ts space -h *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-validate.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-validate.ts outputs\"\n        - \"bun .kiro/tools/aidlc-validate.ts outputs *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-worktree.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-worktree.ts list\"\n        - \"bun .kiro/tools/aidlc-worktree.ts list *\"\n        - \"bun .kiro/tools/aidlc-worktree.ts verify\"\n        - \"bun .kiro/tools/aidlc-worktree.ts verify *\"\n        - \"bun .kiro/tools/aidlc-worktree.ts info\"\n        - \"bun .kiro/tools/aidlc-worktree.ts info *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine intent *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine intent\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --json\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --quiet\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --no-color\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --yes\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --offline\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --verbose\"\n        - \"bun .kiro/tools/aidlc.ts engine intent list\"\n        - \"bun .kiro/tools/aidlc.ts engine intent list *\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --all\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --all *\"\n        - \"bun .kiro/tools/aidlc.ts engine intent help\"\n        - \"bun .kiro/tools/aidlc.ts engine intent help *\"\n        - \"bun .kiro/tools/aidlc.ts engine intent -h\"\n        - \"bun .kiro/tools/aidlc.ts engine intent -h *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine space *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine space\"\n        - \"bun .kiro/tools/aidlc.ts engine space --json\"\n        - \"bun .kiro/tools/aidlc.ts engine space --quiet\"\n        - \"bun .kiro/tools/aidlc.ts engine space --no-color\"\n        - \"bun .kiro/tools/aidlc.ts engine space --yes\"\n        - \"bun .kiro/tools/aidlc.ts engine space --offline\"\n        - \"bun .kiro/tools/aidlc.ts engine space --verbose\"\n        - \"bun .kiro/tools/aidlc.ts engine space list\"\n        - \"bun .kiro/tools/aidlc.ts engine space list *\"\n        - \"bun .kiro/tools/aidlc.ts engine space help\"\n        - \"bun .kiro/tools/aidlc.ts engine space help *\"\n        - \"bun .kiro/tools/aidlc.ts engine space -h\"\n        - \"bun .kiro/tools/aidlc.ts engine space -h *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine status *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine status\"\n        - \"bun .kiro/tools/aidlc.ts engine status *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine now *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine now\"\n        - \"bun .kiro/tools/aidlc.ts engine now *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine state *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine state get\"\n        - \"bun .kiro/tools/aidlc.ts engine state get *\"\n        - \"bun .kiro/tools/aidlc.ts engine state count\"\n        - \"bun .kiro/tools/aidlc.ts engine state count *\"\n        - \"bun .kiro/tools/aidlc.ts engine state resume\"\n        - \"bun .kiro/tools/aidlc.ts engine state resume *\"\n        - \"bun .kiro/tools/aidlc.ts engine state lookup\"\n        - \"bun .kiro/tools/aidlc.ts engine state lookup *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine audit *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine audit history\"\n        - \"bun .kiro/tools/aidlc.ts engine audit history *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine graph *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine graph artifacts\"\n        - \"bun .kiro/tools/aidlc.ts engine graph artifacts *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph producers\"\n        - \"bun .kiro/tools/aidlc.ts engine graph producers *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph consumers\"\n        - \"bun .kiro/tools/aidlc.ts engine graph consumers *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph topo\"\n        - \"bun .kiro/tools/aidlc.ts engine graph topo *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph cycles\"\n        - \"bun .kiro/tools/aidlc.ts engine graph cycles *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph scope\"\n        - \"bun .kiro/tools/aidlc.ts engine graph scope *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph validate-scope\"\n        - \"bun .kiro/tools/aidlc.ts engine graph validate-scope *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph validate-grid\"\n        - \"bun .kiro/tools/aidlc.ts engine graph validate-grid *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph ars\"\n        - \"bun .kiro/tools/aidlc.ts engine graph ars *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph export\"\n        - \"bun .kiro/tools/aidlc.ts engine graph export *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine runtime *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine runtime read\"\n        - \"bun .kiro/tools/aidlc.ts engine runtime read *\"\n        - \"bun .kiro/tools/aidlc.ts engine runtime summary\"\n        - \"bun .kiro/tools/aidlc.ts engine runtime summary *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine sensor *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine sensor list\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor list *\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor describe\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor describe *\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor fire\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor fire *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine swarm *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine swarm check\"\n        - \"bun .kiro/tools/aidlc.ts engine swarm check *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine worktree *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine worktree list\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree list *\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree verify\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree verify *\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree info\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree info *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine jump *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine jump resolve\"\n        - \"bun .kiro/tools/aidlc.ts engine jump resolve *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine log *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine log answers\"\n        - \"bun .kiro/tools/aidlc.ts engine log answers *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine learnings *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine learnings surface\"\n        - \"bun .kiro/tools/aidlc.ts engine learnings surface *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture resolve\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture resolve *\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture render\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture render *\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture verify\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture verify *\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture brief\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture brief *\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture reply\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture reply *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine validate *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine validate outputs\"\n        - \"bun .kiro/tools/aidlc.ts engine validate outputs *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine scope *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine scope resolve-env\"\n        - \"bun .kiro/tools/aidlc.ts engine scope resolve-env *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine config *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine config get\"\n        - \"bun .kiro/tools/aidlc.ts engine config get *\"\n        - \"bun .kiro/tools/aidlc.ts engine config list\"\n        - \"bun .kiro/tools/aidlc.ts engine config list *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine plugin *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine plugin select\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --json\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --quiet\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --no-color\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --yes\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --offline\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --verbose\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin list\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin list *\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin validate\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin validate *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine knowledge *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine knowledge list\"\n        - \"bun .kiro/tools/aidlc.ts engine knowledge list *\"\n        - \"bun .kiro/tools/aidlc.ts engine knowledge show\"\n        - \"bun .kiro/tools/aidlc.ts engine knowledge show *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine gen *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine gen stage-table\"\n        - \"bun .kiro/tools/aidlc.ts engine gen stage-table *\"\n        - \"bun .kiro/tools/aidlc.ts engine gen scope-table\"\n        - \"bun .kiro/tools/aidlc.ts engine gen scope-table *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine workspace *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine workspace detect\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace detect *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-scope-diff\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-scope-diff *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-snapshot\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-snapshot *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-publish\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-publish *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace project-description\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace project-description *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace document-input\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace document-input *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine review-brief *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine review-brief review\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief review *\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief context\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief context *\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief summary\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief summary *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate wait\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate wait *\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate team-board\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate team-board *\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate help\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate help *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc*$*\"\n        - \"bun .kiro/tools/aidlc*`*\"\n        - \"bun .kiro/tools/aidlc*>*\"\n        - \"bun .kiro/tools/aidlc*<*\"\n        - \"bun .kiro/tools/aidlc*&*\"\n        - \"bun .kiro/tools/aidlc*@(*\"\n        - \"bun .kiro/tools/aidlc*@{*\"\n        - \"bun .kiro/tools/aidlc*\\n*\"\n    - capability: fs_read\n      effect: allow\n      match:\n        - \"**\"\n    - capability: filesystem\n      effect: allow\n      match:\n        - \"aidlc/spaces/**\"\n        - \".aidlc/worktrees/*/aidlc/spaces/**\"\n    - capability: fs_write\n      effect: deny\n      match:\n        - \".kiro/**\"\n        - \"aidlc/.aidlc-sessions/**\"\n        - \"aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**\"\n---\n<!-- aidlc-delegated-knowledge-preflight -->\n**Delegated knowledge preflight (mandatory):** Before substantive work, ensure every readable Markdown file under these directories is loaded, in order: `.kiro/knowledge/aidlc-shared/` (all but its format references `audit-format.md`, `knowledge-readme-template.md`, `memory-template.md`, `state-template.md` and `worktree-info-schema.md`: a step that needs one names it), `.kiro/knowledge/test-pro-metrics-agent/`, `aidlc/spaces/<active-space>/knowledge/aidlc-shared/`, then `aidlc/spaces/<active-space>/knowledge/test-pro-metrics-agent/`. A native resource preload satisfies this requirement; otherwise read the files now. The dispatch brief supplies rules and artifact paths separately.\n\n\n# Test Pro Metrics Agent\n\nYou are a testing metrics specialist. You interpret coverage, defect, and\nquality-gate signals into concise release evidence for the test-pro validation\npath.\n\n## Core Responsibilities\n\n- Summarize coverage deltas and gaps across unit, integration, and regression suites.\n- Identify defect trends that affect release readiness.\n- Translate raw test results into pass/fail evidence tied to requirements.\n\n## Stages Supported\n\n**Supporting:**\n- test-pro-integration — Cross-Unit Integration Testing (Construction)\n\n## Memory Focus\n\n`.kiro/steering/` — organization and project guardrails\n\n## Key Principles\n\n1. **Metrics explain risk** — Report what the numbers imply for release confidence.\n2. **Trace evidence to requirements** — Coverage without requirement context is incomplete.\n3. **Prefer concise signals** — Highlight the few gaps that change a decision.\n"
      },
      {
        "kind": "file",
        "path": ".kiro/knowledge/test-pro-metrics-agent/methodology.md",
        "body": "# Test Pro Metrics Methodology\n\nWhen supporting a validation stage, compare the new results against the prior\nstage's stated coverage target, then report only the deltas that affect release\nreadiness: uncovered requirements, repeated failure categories, and regressions\nin branch or API negative-path coverage.\n"
      }
    ],
    "policyLines": [
      "tools: [\"read\", \"write\", \"shell\"]",
      "includeMcpJson: true",
      "permissions:",
      "  rules:",
      "    - capability: shell",
      "      effect: allow",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-*\"",
      "        - \"bun .kiro/tools/aidlc.ts engine *\"",
      "        - \"bun --version\"",
      "    - capability: shell",
      "      effect: ask",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine config set *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine adapter *\"",
      "        - \"bun .kiro/tools/aidlc*$*\"",
      "        - \"bun .kiro/tools/aidlc*`*\"",
      "        - \"bun .kiro/tools/aidlc*>*\"",
      "        - \"bun .kiro/tools/aidlc*<*\"",
      "        - \"bun .kiro/tools/aidlc*&*\"",
      "        - \"bun .kiro/tools/aidlc*@(*\"",
      "        - \"bun .kiro/tools/aidlc*@{*\"",
      "        - \"bun .kiro/tools/aidlc*\\n*\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-*\"",
      "        - \"bun .kiro/tools/aidlc.ts engine *\"",
      "        - \"bun .kiro/tools/aidlc.ts doctor\"",
      "        - \"bun .kiro/tools/aidlc.ts doctor --verbose\"",
      "        - \"bun .kiro/tools/aidlc.ts version\"",
      "        - \"bun .kiro/tools/aidlc.ts --doctor\"",
      "        - \"bun .kiro/tools/aidlc.ts --doctor --verbose\"",
      "        - \"bun .kiro/tools/aidlc.ts --version\"",
      "        - \"bun .kiro/tools/aidlc.ts status\"",
      "        - \"bun .kiro/tools/aidlc.ts --status\"",
      "        - \"bun .kiro/tools/aidlc.ts config --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config models --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config models --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config models --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config runtime --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config runtime --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config runtime --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config providers --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config providers --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config providers --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config trust --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config trust --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config trust --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config project --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config project --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config project --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-attest.ts\"",
      "        - \"bun .kiro/tools/aidlc-attest.ts *\"",
      "        - \"bun .kiro/tools/aidlc-audit.ts\"",
      "        - \"bun .kiro/tools/aidlc-audit.ts *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts *\"",
      "        - \"bun .kiro/tools/aidlc-jump.ts\"",
      "        - \"bun .kiro/tools/aidlc-jump.ts *\"",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts\"",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts *\"",
      "        - \"bun .kiro/tools/aidlc-learnings.ts\"",
      "        - \"bun .kiro/tools/aidlc-learnings.ts *\"",
      "        - \"bun .kiro/tools/aidlc-log.ts\"",
      "        - \"bun .kiro/tools/aidlc-log.ts *\"",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts\"",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts *\"",
      "        - \"bun .kiro/tools/aidlc-plugin.ts\"",
      "        - \"bun .kiro/tools/aidlc-plugin.ts *\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts *\"",
      "        - \"bun .kiro/tools/aidlc-runtime.ts\"",
      "        - \"bun .kiro/tools/aidlc-runtime.ts *\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts *\"",
      "        - \"bun .kiro/tools/aidlc-state.ts\"",
      "        - \"bun .kiro/tools/aidlc-state.ts *\"",
      "        - \"bun .kiro/tools/aidlc-swarm.ts\"",
      "        - \"bun .kiro/tools/aidlc-swarm.ts *\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts *\"",
      "        - \"bun .kiro/tools/aidlc-unit.ts\"",
      "        - \"bun .kiro/tools/aidlc-unit.ts *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts *\"",
      "        - \"bun .kiro/tools/aidlc-validate.ts\"",
      "        - \"bun .kiro/tools/aidlc-validate.ts *\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine status\"",
      "        - \"bun .kiro/tools/aidlc.ts engine status *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine now\"",
      "        - \"bun .kiro/tools/aidlc.ts engine now *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine audit\"",
      "        - \"bun .kiro/tools/aidlc.ts engine audit *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime\"",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine swarm\"",
      "        - \"bun .kiro/tools/aidlc.ts engine swarm *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine jump\"",
      "        - \"bun .kiro/tools/aidlc.ts engine jump *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine log\"",
      "        - \"bun .kiro/tools/aidlc.ts engine log *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine learnings\"",
      "        - \"bun .kiro/tools/aidlc.ts engine learnings *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine validate\"",
      "        - \"bun .kiro/tools/aidlc.ts engine validate *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine scope\"",
      "        - \"bun .kiro/tools/aidlc.ts engine scope *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine config\"",
      "        - \"bun .kiro/tools/aidlc.ts engine config *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge\"",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine gen\"",
      "        - \"bun .kiro/tools/aidlc.ts engine gen *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-attest.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-attest.ts resolve\"",
      "        - \"bun .kiro/tools/aidlc-attest.ts resolve *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-audit.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-audit.ts history\"",
      "        - \"bun .kiro/tools/aidlc-audit.ts history *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-graph.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-graph.ts artifacts\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts artifacts *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts producers\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts producers *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts consumers\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts consumers *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts topo\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts topo *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts cycles\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts cycles *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts scope\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts scope *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts validate-scope\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts validate-scope *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts validate-grid\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts validate-grid *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts ars\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts ars *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts export\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts export *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-jump.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-jump.ts resolve\"",
      "        - \"bun .kiro/tools/aidlc-jump.ts resolve *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts list\"",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts list *\"",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts show\"",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts show *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-learnings.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-learnings.ts surface\"",
      "        - \"bun .kiro/tools/aidlc-learnings.ts surface *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-log.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-log.ts answers\"",
      "        - \"bun .kiro/tools/aidlc-log.ts answers *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts wait\"",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts wait *\"",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts team-board\"",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts team-board *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-plugin.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-plugin.ts list\"",
      "        - \"bun .kiro/tools/aidlc-plugin.ts list *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts review\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts review *\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts context\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts context *\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts summary\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts summary *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-runtime.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-runtime.ts read\"",
      "        - \"bun .kiro/tools/aidlc-runtime.ts read *\"",
      "        - \"bun .kiro/tools/aidlc-runtime.ts summary\"",
      "        - \"bun .kiro/tools/aidlc-runtime.ts summary *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-sensor.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-sensor.ts list\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts list *\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts describe\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts describe *\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts fire\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts fire *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-state.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-state.ts get\"",
      "        - \"bun .kiro/tools/aidlc-state.ts get *\"",
      "        - \"bun .kiro/tools/aidlc-state.ts count\"",
      "        - \"bun .kiro/tools/aidlc-state.ts count *\"",
      "        - \"bun .kiro/tools/aidlc-state.ts resume\"",
      "        - \"bun .kiro/tools/aidlc-state.ts resume *\"",
      "        - \"bun .kiro/tools/aidlc-state.ts lookup\"",
      "        - \"bun .kiro/tools/aidlc-state.ts lookup *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-swarm.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-swarm.ts check\"",
      "        - \"bun .kiro/tools/aidlc-swarm.ts check *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts resolve\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts resolve *\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts render\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts render *\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts verify\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts verify *\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts reply\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts reply *\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts brief\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts brief *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-unit.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-unit.ts merge-status\"",
      "        - \"bun .kiro/tools/aidlc-unit.ts merge-status *\"",
      "        - \"bun .kiro/tools/aidlc-unit.ts status\"",
      "        - \"bun .kiro/tools/aidlc-unit.ts status *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-utility.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-utility.ts help\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts help *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts version\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts version *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts now\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts now *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts status\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts status *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts detect\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts detect *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts project-description\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts project-description *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-path\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-path *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-scope-diff\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-scope-diff *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-snapshot\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-snapshot *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-publish\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-publish *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts plugin-list\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts plugin-list *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts plugin-validate\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts plugin-validate *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts config-get\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts config-get *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts config-list\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts config-list *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts resolve-env-scope\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts resolve-env-scope *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts scope-table\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts scope-table *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts stage-table\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts stage-table *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --json\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --quiet\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --no-color\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --yes\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --offline\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --verbose\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts document-input\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts document-input *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --json\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --quiet\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --no-color\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --yes\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --offline\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --verbose\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent list\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent list *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --json\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --quiet\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --no-color\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --yes\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --offline\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --verbose\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent help\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent help *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent -h\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent -h *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --json\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --quiet\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --no-color\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --yes\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --offline\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --verbose\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space list\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space list *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space help\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space help *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space -h\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space -h *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-validate.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-validate.ts outputs\"",
      "        - \"bun .kiro/tools/aidlc-validate.ts outputs *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-worktree.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-worktree.ts list\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts list *\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts verify\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts verify *\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts info\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts info *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine intent *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine intent\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --json\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --quiet\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --no-color\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --offline\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --verbose\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --all\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --all *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent help\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent help *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent -h\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent -h *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine space *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine space\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --json\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --quiet\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --no-color\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --offline\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --verbose\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space help\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space help *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space -h\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space -h *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine status *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine status\"",
      "        - \"bun .kiro/tools/aidlc.ts engine status *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine now *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine now\"",
      "        - \"bun .kiro/tools/aidlc.ts engine now *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine state *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine state get\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state get *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state count\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state count *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state resume\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state resume *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state lookup\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state lookup *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine audit *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine audit history\"",
      "        - \"bun .kiro/tools/aidlc.ts engine audit history *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine graph *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine graph artifacts\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph artifacts *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph producers\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph producers *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph consumers\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph consumers *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph topo\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph topo *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph cycles\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph cycles *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph scope\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph scope *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph validate-scope\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph validate-scope *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph validate-grid\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph validate-grid *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph ars\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph ars *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph export\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph export *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime read\"",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime read *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime summary\"",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime summary *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor describe\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor describe *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor fire\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor fire *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine swarm *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine swarm check\"",
      "        - \"bun .kiro/tools/aidlc.ts engine swarm check *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree verify\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree verify *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree info\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree info *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine jump *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine jump resolve\"",
      "        - \"bun .kiro/tools/aidlc.ts engine jump resolve *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine log *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine log answers\"",
      "        - \"bun .kiro/tools/aidlc.ts engine log answers *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine learnings *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine learnings surface\"",
      "        - \"bun .kiro/tools/aidlc.ts engine learnings surface *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture resolve\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture resolve *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture render\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture render *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture verify\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture verify *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture brief\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture brief *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture reply\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture reply *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine validate *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine validate outputs\"",
      "        - \"bun .kiro/tools/aidlc.ts engine validate outputs *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine scope *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine scope resolve-env\"",
      "        - \"bun .kiro/tools/aidlc.ts engine scope resolve-env *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine config *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine config get\"",
      "        - \"bun .kiro/tools/aidlc.ts engine config get *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine config list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine config list *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --json\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --quiet\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --no-color\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --offline\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --verbose\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin validate\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin validate *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge show\"",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge show *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine gen *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine gen stage-table\"",
      "        - \"bun .kiro/tools/aidlc.ts engine gen stage-table *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine gen scope-table\"",
      "        - \"bun .kiro/tools/aidlc.ts engine gen scope-table *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace detect\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace detect *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-scope-diff\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-scope-diff *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-snapshot\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-snapshot *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-publish\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-publish *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace project-description\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace project-description *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace document-input\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace document-input *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief review\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief review *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief context\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief context *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief summary\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief summary *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate wait\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate wait *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate team-board\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate team-board *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate help\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate help *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc*$*\"",
      "        - \"bun .kiro/tools/aidlc*`*\"",
      "        - \"bun .kiro/tools/aidlc*>*\"",
      "        - \"bun .kiro/tools/aidlc*<*\"",
      "        - \"bun .kiro/tools/aidlc*&*\"",
      "        - \"bun .kiro/tools/aidlc*@(*\"",
      "        - \"bun .kiro/tools/aidlc*@{*\"",
      "        - \"bun .kiro/tools/aidlc*\\n*\"",
      "    - capability: fs_read",
      "      effect: allow",
      "      match:",
      "        - \"**\"",
      "    - capability: filesystem",
      "      effect: allow",
      "      match:",
      "        - \"aidlc/spaces/**\"",
      "        - \".aidlc/worktrees/*/aidlc/spaces/**\"",
      "    - capability: fs_write",
      "      effect: deny",
      "      match:",
      "        - \".kiro/**\"",
      "        - \"aidlc/.aidlc-sessions/**\"",
      "        - \"aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**\""
    ],
    "denialComparison": "equivalent"
  },
  {
    "baseline": "fork",
    "harness": "kiro-ide",
    "context": {
      "harness": "kiro-ide",
      "directory": ".kiro",
      "invocation": "bun .kiro/tools/aidlc.ts",
      "tierCap": "judgment",
      "sharedKnowledge": "all",
      "models": {
        "tiers": {
          "judgment": {
            "model": null,
            "effort": null
          },
          "balanced": {
            "model": null,
            "effort": null
          },
          "templated": {
            "model": null,
            "effort": null
          }
        },
        "explicit": "inherit"
      },
      "memoryReference": null,
      "rulesSubdir": "steering",
      "knowledgeRead": "ordinary"
    },
    "policyOrigin": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "harness/kiro-ide/manifest.ts"
    },
    "templateName": "aidlc-quality-agent",
    "templateAdmissions": {
      "origin": {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
        "path": "core/hooks/aidlc-state-transition-guard.ts"
      },
      "name": "aidlc-quality-agent",
      "verbs": {
        "aidlc-utility.ts": [
          "help",
          "version",
          "now",
          "status",
          "detect",
          "project-description",
          "codekb-path",
          "codekb-scope-diff",
          "codekb-snapshot",
          "codekb-publish",
          "plugin-list",
          "plugin-validate",
          "config-get",
          "config-list",
          "resolve-env-scope",
          "scope-table",
          "stage-table",
          "select-plugins",
          "document-input"
        ],
        "aidlc-state.ts": [
          "get",
          "count",
          "resume",
          "lookup"
        ],
        "aidlc-orchestrate.ts": [
          "wait",
          "team-board"
        ],
        "aidlc-jump.ts": [
          "resolve"
        ],
        "aidlc-unit.ts": [
          "merge-status",
          "status"
        ],
        "aidlc-log.ts": [
          "answers"
        ],
        "aidlc-learnings.ts": [
          "surface"
        ],
        "aidlc-runtime.ts": [
          "read",
          "summary"
        ],
        "aidlc-testing-posture.ts": [
          "resolve",
          "render",
          "verify",
          "reply",
          "brief"
        ],
        "aidlc-worktree.ts": [
          "list",
          "verify",
          "info"
        ],
        "aidlc-audit.ts": [
          "history"
        ],
        "aidlc-plugin.ts": [
          "list"
        ],
        "aidlc-graph.ts": [
          "artifacts",
          "producers",
          "consumers",
          "topo",
          "cycles",
          "scope",
          "validate-scope",
          "validate-grid",
          "ars",
          "export"
        ],
        "aidlc-sensor.ts": [
          "list",
          "describe",
          "fire"
        ],
        "aidlc-validate.ts": [
          "outputs"
        ],
        "aidlc-review-brief.ts": [
          "review",
          "context",
          "summary"
        ],
        "aidlc-attest.ts": [
          "resolve"
        ],
        "aidlc-knowledge.ts": [
          "list",
          "show"
        ]
      }
    },
    "targetAdmissions": {
      "origin": {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
        "path": "core/hooks/aidlc-state-transition-guard.ts"
      },
      "name": "test-pro-metrics-agent",
      "verbs": {
        "aidlc-utility.ts": [
          "help",
          "version",
          "now",
          "status",
          "detect",
          "project-description",
          "codekb-path",
          "codekb-scope-diff",
          "codekb-snapshot",
          "codekb-publish",
          "plugin-list",
          "plugin-validate",
          "config-get",
          "config-list",
          "resolve-env-scope",
          "scope-table",
          "stage-table",
          "select-plugins",
          "document-input"
        ],
        "aidlc-state.ts": [
          "get",
          "count",
          "resume",
          "lookup"
        ],
        "aidlc-orchestrate.ts": [
          "wait",
          "team-board"
        ],
        "aidlc-jump.ts": [
          "resolve"
        ],
        "aidlc-unit.ts": [
          "merge-status",
          "status"
        ],
        "aidlc-log.ts": [
          "answers"
        ],
        "aidlc-learnings.ts": [
          "surface"
        ],
        "aidlc-runtime.ts": [
          "read",
          "summary"
        ],
        "aidlc-testing-posture.ts": [
          "resolve",
          "render",
          "verify",
          "reply",
          "brief"
        ],
        "aidlc-worktree.ts": [
          "list",
          "verify",
          "info"
        ],
        "aidlc-audit.ts": [
          "history"
        ],
        "aidlc-plugin.ts": [
          "list"
        ],
        "aidlc-graph.ts": [
          "artifacts",
          "producers",
          "consumers",
          "topo",
          "cycles",
          "scope",
          "validate-scope",
          "validate-grid",
          "ars",
          "export"
        ],
        "aidlc-sensor.ts": [
          "list",
          "describe",
          "fire"
        ],
        "aidlc-validate.ts": [
          "outputs"
        ],
        "aidlc-review-brief.ts": [
          "review",
          "context",
          "summary"
        ],
        "aidlc-attest.ts": [
          "resolve"
        ],
        "aidlc-knowledge.ts": [
          "list",
          "show"
        ]
      }
    },
    "admissionMismatch": {
      "aidlc-utility.ts": [
        "help",
        "version",
        "now",
        "status",
        "detect",
        "project-description",
        "codekb-path",
        "codekb-scope-diff",
        "codekb-snapshot",
        "codekb-publish",
        "plugin-list",
        "plugin-validate",
        "config-get",
        "config-list",
        "resolve-env-scope",
        "scope-table",
        "stage-table",
        "select-plugins",
        "document-input"
      ],
      "aidlc-state.ts": [
        "get",
        "count",
        "resume",
        "lookup"
      ],
      "aidlc-orchestrate.ts": [
        "wait",
        "team-board"
      ],
      "aidlc-jump.ts": [
        "resolve"
      ],
      "aidlc-unit.ts": [
        "merge-status",
        "status"
      ],
      "aidlc-log.ts": [
        "answers"
      ],
      "aidlc-learnings.ts": [
        "surface"
      ],
      "aidlc-runtime.ts": [
        "read",
        "summary"
      ],
      "aidlc-testing-posture.ts": [
        "resolve",
        "render",
        "verify",
        "reply",
        "brief"
      ],
      "aidlc-worktree.ts": [
        "list",
        "verify",
        "info",
        "create",
        "merge",
        "discard",
        "restore"
      ],
      "aidlc-audit.ts": [
        "history"
      ],
      "aidlc-plugin.ts": [
        "list"
      ],
      "aidlc-graph.ts": [
        "artifacts",
        "producers",
        "consumers",
        "topo",
        "cycles",
        "scope",
        "validate-scope",
        "validate-grid",
        "ars",
        "export"
      ],
      "aidlc-sensor.ts": [
        "list",
        "describe",
        "fire"
      ],
      "aidlc-validate.ts": [
        "outputs"
      ],
      "aidlc-review-brief.ts": [
        "review",
        "context",
        "summary"
      ],
      "aidlc-attest.ts": [
        "resolve"
      ],
      "aidlc-knowledge.ts": [
        "list",
        "show"
      ]
    },
    "classification": "curated-native-plugin-improvement",
    "expected": [
      {
        "kind": "file",
        "path": ".kiro/agents/test-pro-metrics-agent.md",
        "body": "---\nname: test-pro-metrics-agent\ndisplay_name: Test Pro Metrics Agent\nplugin: test-pro\nexamples:\n  - methodology.md\ndescription: >\n  Testing metrics specialist responsible for coverage interpretation, defect trends, and release-quality evidence.\ntools: [\"read\", \"write\", \"shell\"]\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"bun .kiro/tools/aidlc-*\"\n        - \"bun .kiro/tools/aidlc.ts engine *\"\n        - \"bun --version\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine config set *\"\n        - \"bun .kiro/tools/aidlc.ts engine adapter *\"\n        - \"*$*\"\n        - \"*`*\"\n        - \"*>*\"\n        - \"*<*\"\n        - \"*&*\"\n        - \"*@(*\"\n        - \"*@{*\"\n        - \"*\\n*\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-*\"\n        - \"bun .kiro/tools/aidlc.ts engine *\"\n        - \"bun .kiro/tools/aidlc.ts doctor\"\n        - \"bun .kiro/tools/aidlc.ts doctor --verbose\"\n        - \"bun .kiro/tools/aidlc.ts version\"\n        - \"bun .kiro/tools/aidlc.ts --doctor\"\n        - \"bun .kiro/tools/aidlc.ts --doctor --verbose\"\n        - \"bun .kiro/tools/aidlc.ts --version\"\n        - \"bun .kiro/tools/aidlc.ts status\"\n        - \"bun .kiro/tools/aidlc.ts --status\"\n        - \"bun .kiro/tools/aidlc.ts config --help\"\n        - \"bun .kiro/tools/aidlc.ts config --show\"\n        - \"bun .kiro/tools/aidlc.ts config --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config models --show\"\n        - \"bun .kiro/tools/aidlc.ts config models --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config models --help\"\n        - \"bun .kiro/tools/aidlc.ts config runtime --show\"\n        - \"bun .kiro/tools/aidlc.ts config runtime --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config runtime --help\"\n        - \"bun .kiro/tools/aidlc.ts config providers --show\"\n        - \"bun .kiro/tools/aidlc.ts config providers --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config providers --help\"\n        - \"bun .kiro/tools/aidlc.ts config trust --show\"\n        - \"bun .kiro/tools/aidlc.ts config trust --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config trust --help\"\n        - \"bun .kiro/tools/aidlc.ts config flags --show\"\n        - \"bun .kiro/tools/aidlc.ts config flags --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config flags --help\"\n        - \"bun .kiro/tools/aidlc.ts config project --show\"\n        - \"bun .kiro/tools/aidlc.ts config project --show --json\"\n        - \"bun .kiro/tools/aidlc.ts config project --help\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes\"\n        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-attest.ts\"\n        - \"bun .kiro/tools/aidlc-attest.ts *\"\n        - \"bun .kiro/tools/aidlc-audit.ts\"\n        - \"bun .kiro/tools/aidlc-audit.ts *\"\n        - \"bun .kiro/tools/aidlc-graph.ts\"\n        - \"bun .kiro/tools/aidlc-graph.ts *\"\n        - \"bun .kiro/tools/aidlc-jump.ts\"\n        - \"bun .kiro/tools/aidlc-jump.ts *\"\n        - \"bun .kiro/tools/aidlc-knowledge.ts\"\n        - \"bun .kiro/tools/aidlc-knowledge.ts *\"\n        - \"bun .kiro/tools/aidlc-learnings.ts\"\n        - \"bun .kiro/tools/aidlc-learnings.ts *\"\n        - \"bun .kiro/tools/aidlc-log.ts\"\n        - \"bun .kiro/tools/aidlc-log.ts *\"\n        - \"bun .kiro/tools/aidlc-orchestrate.ts\"\n        - \"bun .kiro/tools/aidlc-orchestrate.ts *\"\n        - \"bun .kiro/tools/aidlc-plugin.ts\"\n        - \"bun .kiro/tools/aidlc-plugin.ts *\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts *\"\n        - \"bun .kiro/tools/aidlc-runtime.ts\"\n        - \"bun .kiro/tools/aidlc-runtime.ts *\"\n        - \"bun .kiro/tools/aidlc-sensor.ts\"\n        - \"bun .kiro/tools/aidlc-sensor.ts *\"\n        - \"bun .kiro/tools/aidlc-state.ts\"\n        - \"bun .kiro/tools/aidlc-state.ts *\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts *\"\n        - \"bun .kiro/tools/aidlc-unit.ts\"\n        - \"bun .kiro/tools/aidlc-unit.ts *\"\n        - \"bun .kiro/tools/aidlc-utility.ts\"\n        - \"bun .kiro/tools/aidlc-utility.ts *\"\n        - \"bun .kiro/tools/aidlc-validate.ts\"\n        - \"bun .kiro/tools/aidlc-validate.ts *\"\n        - \"bun .kiro/tools/aidlc-worktree.ts\"\n        - \"bun .kiro/tools/aidlc-worktree.ts *\"\n        - \"bun .kiro/tools/aidlc.ts engine intent\"\n        - \"bun .kiro/tools/aidlc.ts engine intent *\"\n        - \"bun .kiro/tools/aidlc.ts engine space\"\n        - \"bun .kiro/tools/aidlc.ts engine space *\"\n        - \"bun .kiro/tools/aidlc.ts engine status\"\n        - \"bun .kiro/tools/aidlc.ts engine status *\"\n        - \"bun .kiro/tools/aidlc.ts engine now\"\n        - \"bun .kiro/tools/aidlc.ts engine now *\"\n        - \"bun .kiro/tools/aidlc.ts engine state\"\n        - \"bun .kiro/tools/aidlc.ts engine state *\"\n        - \"bun .kiro/tools/aidlc.ts engine audit\"\n        - \"bun .kiro/tools/aidlc.ts engine audit *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph\"\n        - \"bun .kiro/tools/aidlc.ts engine graph *\"\n        - \"bun .kiro/tools/aidlc.ts engine runtime\"\n        - \"bun .kiro/tools/aidlc.ts engine runtime *\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor *\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree *\"\n        - \"bun .kiro/tools/aidlc.ts engine jump\"\n        - \"bun .kiro/tools/aidlc.ts engine jump *\"\n        - \"bun .kiro/tools/aidlc.ts engine log\"\n        - \"bun .kiro/tools/aidlc.ts engine log *\"\n        - \"bun .kiro/tools/aidlc.ts engine learnings\"\n        - \"bun .kiro/tools/aidlc.ts engine learnings *\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture *\"\n        - \"bun .kiro/tools/aidlc.ts engine validate\"\n        - \"bun .kiro/tools/aidlc.ts engine validate *\"\n        - \"bun .kiro/tools/aidlc.ts engine scope\"\n        - \"bun .kiro/tools/aidlc.ts engine scope *\"\n        - \"bun .kiro/tools/aidlc.ts engine config\"\n        - \"bun .kiro/tools/aidlc.ts engine config *\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin *\"\n        - \"bun .kiro/tools/aidlc.ts engine knowledge\"\n        - \"bun .kiro/tools/aidlc.ts engine knowledge *\"\n        - \"bun .kiro/tools/aidlc.ts engine gen\"\n        - \"bun .kiro/tools/aidlc.ts engine gen *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace *\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief *\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-attest.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-attest.ts resolve\"\n        - \"bun .kiro/tools/aidlc-attest.ts resolve *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-audit.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-audit.ts history\"\n        - \"bun .kiro/tools/aidlc-audit.ts history *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-graph.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-graph.ts artifacts\"\n        - \"bun .kiro/tools/aidlc-graph.ts artifacts *\"\n        - \"bun .kiro/tools/aidlc-graph.ts producers\"\n        - \"bun .kiro/tools/aidlc-graph.ts producers *\"\n        - \"bun .kiro/tools/aidlc-graph.ts consumers\"\n        - \"bun .kiro/tools/aidlc-graph.ts consumers *\"\n        - \"bun .kiro/tools/aidlc-graph.ts topo\"\n        - \"bun .kiro/tools/aidlc-graph.ts topo *\"\n        - \"bun .kiro/tools/aidlc-graph.ts cycles\"\n        - \"bun .kiro/tools/aidlc-graph.ts cycles *\"\n        - \"bun .kiro/tools/aidlc-graph.ts scope\"\n        - \"bun .kiro/tools/aidlc-graph.ts scope *\"\n        - \"bun .kiro/tools/aidlc-graph.ts validate-scope\"\n        - \"bun .kiro/tools/aidlc-graph.ts validate-scope *\"\n        - \"bun .kiro/tools/aidlc-graph.ts validate-grid\"\n        - \"bun .kiro/tools/aidlc-graph.ts validate-grid *\"\n        - \"bun .kiro/tools/aidlc-graph.ts ars\"\n        - \"bun .kiro/tools/aidlc-graph.ts ars *\"\n        - \"bun .kiro/tools/aidlc-graph.ts export\"\n        - \"bun .kiro/tools/aidlc-graph.ts export *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-jump.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-jump.ts resolve\"\n        - \"bun .kiro/tools/aidlc-jump.ts resolve *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-knowledge.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-knowledge.ts list\"\n        - \"bun .kiro/tools/aidlc-knowledge.ts list *\"\n        - \"bun .kiro/tools/aidlc-knowledge.ts show\"\n        - \"bun .kiro/tools/aidlc-knowledge.ts show *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-learnings.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-learnings.ts surface\"\n        - \"bun .kiro/tools/aidlc-learnings.ts surface *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-log.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-log.ts answers\"\n        - \"bun .kiro/tools/aidlc-log.ts answers *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-orchestrate.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-orchestrate.ts wait\"\n        - \"bun .kiro/tools/aidlc-orchestrate.ts wait *\"\n        - \"bun .kiro/tools/aidlc-orchestrate.ts team-board\"\n        - \"bun .kiro/tools/aidlc-orchestrate.ts team-board *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-plugin.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-plugin.ts list\"\n        - \"bun .kiro/tools/aidlc-plugin.ts list *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-review-brief.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-review-brief.ts review\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts review *\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts context\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts context *\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts summary\"\n        - \"bun .kiro/tools/aidlc-review-brief.ts summary *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-runtime.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-runtime.ts read\"\n        - \"bun .kiro/tools/aidlc-runtime.ts read *\"\n        - \"bun .kiro/tools/aidlc-runtime.ts summary\"\n        - \"bun .kiro/tools/aidlc-runtime.ts summary *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-sensor.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-sensor.ts list\"\n        - \"bun .kiro/tools/aidlc-sensor.ts list *\"\n        - \"bun .kiro/tools/aidlc-sensor.ts describe\"\n        - \"bun .kiro/tools/aidlc-sensor.ts describe *\"\n        - \"bun .kiro/tools/aidlc-sensor.ts fire\"\n        - \"bun .kiro/tools/aidlc-sensor.ts fire *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-state.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-state.ts get\"\n        - \"bun .kiro/tools/aidlc-state.ts get *\"\n        - \"bun .kiro/tools/aidlc-state.ts count\"\n        - \"bun .kiro/tools/aidlc-state.ts count *\"\n        - \"bun .kiro/tools/aidlc-state.ts resume\"\n        - \"bun .kiro/tools/aidlc-state.ts resume *\"\n        - \"bun .kiro/tools/aidlc-state.ts lookup\"\n        - \"bun .kiro/tools/aidlc-state.ts lookup *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-testing-posture.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-testing-posture.ts resolve\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts resolve *\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts render\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts render *\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts verify\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts verify *\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts reply\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts reply *\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts brief\"\n        - \"bun .kiro/tools/aidlc-testing-posture.ts brief *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-unit.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-unit.ts merge-status\"\n        - \"bun .kiro/tools/aidlc-unit.ts merge-status *\"\n        - \"bun .kiro/tools/aidlc-unit.ts status\"\n        - \"bun .kiro/tools/aidlc-unit.ts status *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-utility.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-utility.ts help\"\n        - \"bun .kiro/tools/aidlc-utility.ts help *\"\n        - \"bun .kiro/tools/aidlc-utility.ts version\"\n        - \"bun .kiro/tools/aidlc-utility.ts version *\"\n        - \"bun .kiro/tools/aidlc-utility.ts now\"\n        - \"bun .kiro/tools/aidlc-utility.ts now *\"\n        - \"bun .kiro/tools/aidlc-utility.ts status\"\n        - \"bun .kiro/tools/aidlc-utility.ts status *\"\n        - \"bun .kiro/tools/aidlc-utility.ts detect\"\n        - \"bun .kiro/tools/aidlc-utility.ts detect *\"\n        - \"bun .kiro/tools/aidlc-utility.ts project-description\"\n        - \"bun .kiro/tools/aidlc-utility.ts project-description *\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-path\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-path *\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-scope-diff\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-scope-diff *\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-snapshot\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-snapshot *\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-publish\"\n        - \"bun .kiro/tools/aidlc-utility.ts codekb-publish *\"\n        - \"bun .kiro/tools/aidlc-utility.ts plugin-list\"\n        - \"bun .kiro/tools/aidlc-utility.ts plugin-list *\"\n        - \"bun .kiro/tools/aidlc-utility.ts plugin-validate\"\n        - \"bun .kiro/tools/aidlc-utility.ts plugin-validate *\"\n        - \"bun .kiro/tools/aidlc-utility.ts config-get\"\n        - \"bun .kiro/tools/aidlc-utility.ts config-get *\"\n        - \"bun .kiro/tools/aidlc-utility.ts config-list\"\n        - \"bun .kiro/tools/aidlc-utility.ts config-list *\"\n        - \"bun .kiro/tools/aidlc-utility.ts resolve-env-scope\"\n        - \"bun .kiro/tools/aidlc-utility.ts resolve-env-scope *\"\n        - \"bun .kiro/tools/aidlc-utility.ts scope-table\"\n        - \"bun .kiro/tools/aidlc-utility.ts scope-table *\"\n        - \"bun .kiro/tools/aidlc-utility.ts stage-table\"\n        - \"bun .kiro/tools/aidlc-utility.ts stage-table *\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --json\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --quiet\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --no-color\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --yes\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --offline\"\n        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --verbose\"\n        - \"bun .kiro/tools/aidlc-utility.ts document-input\"\n        - \"bun .kiro/tools/aidlc-utility.ts document-input *\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --json\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --quiet\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --no-color\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --yes\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --offline\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --verbose\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent list\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent list *\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --json\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --quiet\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --no-color\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --yes\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --offline\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent --all --verbose\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent help\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent help *\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent -h\"\n        - \"bun .kiro/tools/aidlc-utility.ts intent -h *\"\n        - \"bun .kiro/tools/aidlc-utility.ts space\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --json\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --quiet\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --no-color\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --yes\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --offline\"\n        - \"bun .kiro/tools/aidlc-utility.ts space --verbose\"\n        - \"bun .kiro/tools/aidlc-utility.ts space list\"\n        - \"bun .kiro/tools/aidlc-utility.ts space list *\"\n        - \"bun .kiro/tools/aidlc-utility.ts space help\"\n        - \"bun .kiro/tools/aidlc-utility.ts space help *\"\n        - \"bun .kiro/tools/aidlc-utility.ts space -h\"\n        - \"bun .kiro/tools/aidlc-utility.ts space -h *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-validate.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-validate.ts outputs\"\n        - \"bun .kiro/tools/aidlc-validate.ts outputs *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-worktree.ts *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc-worktree.ts list\"\n        - \"bun .kiro/tools/aidlc-worktree.ts list *\"\n        - \"bun .kiro/tools/aidlc-worktree.ts verify\"\n        - \"bun .kiro/tools/aidlc-worktree.ts verify *\"\n        - \"bun .kiro/tools/aidlc-worktree.ts info\"\n        - \"bun .kiro/tools/aidlc-worktree.ts info *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine intent *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine intent\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --json\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --quiet\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --no-color\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --yes\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --offline\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --verbose\"\n        - \"bun .kiro/tools/aidlc.ts engine intent list\"\n        - \"bun .kiro/tools/aidlc.ts engine intent list *\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --all\"\n        - \"bun .kiro/tools/aidlc.ts engine intent --all *\"\n        - \"bun .kiro/tools/aidlc.ts engine intent help\"\n        - \"bun .kiro/tools/aidlc.ts engine intent help *\"\n        - \"bun .kiro/tools/aidlc.ts engine intent -h\"\n        - \"bun .kiro/tools/aidlc.ts engine intent -h *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine space *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine space\"\n        - \"bun .kiro/tools/aidlc.ts engine space --json\"\n        - \"bun .kiro/tools/aidlc.ts engine space --quiet\"\n        - \"bun .kiro/tools/aidlc.ts engine space --no-color\"\n        - \"bun .kiro/tools/aidlc.ts engine space --yes\"\n        - \"bun .kiro/tools/aidlc.ts engine space --offline\"\n        - \"bun .kiro/tools/aidlc.ts engine space --verbose\"\n        - \"bun .kiro/tools/aidlc.ts engine space list\"\n        - \"bun .kiro/tools/aidlc.ts engine space list *\"\n        - \"bun .kiro/tools/aidlc.ts engine space help\"\n        - \"bun .kiro/tools/aidlc.ts engine space help *\"\n        - \"bun .kiro/tools/aidlc.ts engine space -h\"\n        - \"bun .kiro/tools/aidlc.ts engine space -h *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine status *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine status\"\n        - \"bun .kiro/tools/aidlc.ts engine status *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine now *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine now\"\n        - \"bun .kiro/tools/aidlc.ts engine now *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine state *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine state get\"\n        - \"bun .kiro/tools/aidlc.ts engine state get *\"\n        - \"bun .kiro/tools/aidlc.ts engine state count\"\n        - \"bun .kiro/tools/aidlc.ts engine state count *\"\n        - \"bun .kiro/tools/aidlc.ts engine state resume\"\n        - \"bun .kiro/tools/aidlc.ts engine state resume *\"\n        - \"bun .kiro/tools/aidlc.ts engine state lookup\"\n        - \"bun .kiro/tools/aidlc.ts engine state lookup *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine audit *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine audit history\"\n        - \"bun .kiro/tools/aidlc.ts engine audit history *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine graph *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine graph artifacts\"\n        - \"bun .kiro/tools/aidlc.ts engine graph artifacts *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph producers\"\n        - \"bun .kiro/tools/aidlc.ts engine graph producers *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph consumers\"\n        - \"bun .kiro/tools/aidlc.ts engine graph consumers *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph topo\"\n        - \"bun .kiro/tools/aidlc.ts engine graph topo *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph cycles\"\n        - \"bun .kiro/tools/aidlc.ts engine graph cycles *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph scope\"\n        - \"bun .kiro/tools/aidlc.ts engine graph scope *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph validate-scope\"\n        - \"bun .kiro/tools/aidlc.ts engine graph validate-scope *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph validate-grid\"\n        - \"bun .kiro/tools/aidlc.ts engine graph validate-grid *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph ars\"\n        - \"bun .kiro/tools/aidlc.ts engine graph ars *\"\n        - \"bun .kiro/tools/aidlc.ts engine graph export\"\n        - \"bun .kiro/tools/aidlc.ts engine graph export *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine runtime *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine runtime read\"\n        - \"bun .kiro/tools/aidlc.ts engine runtime read *\"\n        - \"bun .kiro/tools/aidlc.ts engine runtime summary\"\n        - \"bun .kiro/tools/aidlc.ts engine runtime summary *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine sensor *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine sensor list\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor list *\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor describe\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor describe *\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor fire\"\n        - \"bun .kiro/tools/aidlc.ts engine sensor fire *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine worktree *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine worktree list\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree list *\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree verify\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree verify *\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree info\"\n        - \"bun .kiro/tools/aidlc.ts engine worktree info *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine jump *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine jump resolve\"\n        - \"bun .kiro/tools/aidlc.ts engine jump resolve *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine log *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine log answers\"\n        - \"bun .kiro/tools/aidlc.ts engine log answers *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine learnings *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine learnings surface\"\n        - \"bun .kiro/tools/aidlc.ts engine learnings surface *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture resolve\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture resolve *\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture render\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture render *\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture verify\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture verify *\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture brief\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture brief *\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture reply\"\n        - \"bun .kiro/tools/aidlc.ts engine testing-posture reply *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine validate *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine validate outputs\"\n        - \"bun .kiro/tools/aidlc.ts engine validate outputs *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine scope *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine scope resolve-env\"\n        - \"bun .kiro/tools/aidlc.ts engine scope resolve-env *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine config *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine config get\"\n        - \"bun .kiro/tools/aidlc.ts engine config get *\"\n        - \"bun .kiro/tools/aidlc.ts engine config list\"\n        - \"bun .kiro/tools/aidlc.ts engine config list *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine plugin *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine plugin select\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --json\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --quiet\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --no-color\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --yes\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --offline\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin select --verbose\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin list\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin list *\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin validate\"\n        - \"bun .kiro/tools/aidlc.ts engine plugin validate *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine knowledge *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine knowledge list\"\n        - \"bun .kiro/tools/aidlc.ts engine knowledge list *\"\n        - \"bun .kiro/tools/aidlc.ts engine knowledge show\"\n        - \"bun .kiro/tools/aidlc.ts engine knowledge show *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine gen *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine gen stage-table\"\n        - \"bun .kiro/tools/aidlc.ts engine gen stage-table *\"\n        - \"bun .kiro/tools/aidlc.ts engine gen scope-table\"\n        - \"bun .kiro/tools/aidlc.ts engine gen scope-table *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine workspace *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine workspace detect\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace detect *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-scope-diff\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-scope-diff *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-snapshot\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-snapshot *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-publish\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-publish *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace project-description\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace project-description *\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace document-input\"\n        - \"bun .kiro/tools/aidlc.ts engine workspace document-input *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine review-brief *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine review-brief review\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief review *\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief context\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief context *\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief summary\"\n        - \"bun .kiro/tools/aidlc.ts engine review-brief summary *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate *\"\n      exclude:\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate wait\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate wait *\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate team-board\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate team-board *\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate help\"\n        - \"bun .kiro/tools/aidlc.ts engine orchestrate help *\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc*$*\"\n        - \"bun .kiro/tools/aidlc*`*\"\n        - \"bun .kiro/tools/aidlc*>*\"\n        - \"bun .kiro/tools/aidlc*<*\"\n        - \"bun .kiro/tools/aidlc*&*\"\n        - \"bun .kiro/tools/aidlc*@(*\"\n        - \"bun .kiro/tools/aidlc*@{*\"\n        - \"bun .kiro/tools/aidlc*\\n*\"\n    - capability: fs_read\n      effect: allow\n      match:\n        - \"**\"\n    - capability: filesystem\n      effect: allow\n      match:\n        - \"aidlc/spaces/**\"\n    - capability: fs_write\n      effect: deny\n      match:\n        - \".kiro/**\"\n        - \"aidlc/.aidlc-sessions/**\"\n        - \"aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**\"\n---\n<!-- aidlc-delegated-knowledge-preflight -->\n**Delegated knowledge preflight (mandatory):** Before substantive work, ensure every readable Markdown file under these directories is loaded, in order: `.kiro/knowledge/aidlc-shared/`, `.kiro/knowledge/test-pro-metrics-agent/`, `aidlc/spaces/<active-space>/knowledge/aidlc-shared/`, then `aidlc/spaces/<active-space>/knowledge/test-pro-metrics-agent/`. A native resource preload satisfies this requirement; otherwise read the files now. The dispatch brief supplies rules and artifact paths separately.\n\n\n# Test Pro Metrics Agent\n\nYou are a testing metrics specialist. You interpret coverage, defect, and\nquality-gate signals into concise release evidence for the test-pro validation\npath.\n\n## Core Responsibilities\n\n- Summarize coverage deltas and gaps across unit, integration, and regression suites.\n- Identify defect trends that affect release readiness.\n- Translate raw test results into pass/fail evidence tied to requirements.\n\n## Stages Supported\n\n**Supporting:**\n- test-pro-integration — Cross-Unit Integration Testing (Construction)\n\n## Memory Focus\n\n`.kiro/steering/` — organization and project guardrails\n\n## Key Principles\n\n1. **Metrics explain risk** — Report what the numbers imply for release confidence.\n2. **Trace evidence to requirements** — Coverage without requirement context is incomplete.\n3. **Prefer concise signals** — Highlight the few gaps that change a decision.\n"
      },
      {
        "kind": "file",
        "path": ".kiro/knowledge/test-pro-metrics-agent/methodology.md",
        "body": "# Test Pro Metrics Methodology\n\nWhen supporting a validation stage, compare the new results against the prior\nstage's stated coverage target, then report only the deltas that affect release\nreadiness: uncovered requirements, repeated failure categories, and regressions\nin branch or API negative-path coverage.\n"
      }
    ],
    "policyLines": [
      "tools: [\"read\", \"write\", \"shell\"]",
      "permissions:",
      "  rules:",
      "    - capability: shell",
      "      effect: allow",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-*\"",
      "        - \"bun .kiro/tools/aidlc.ts engine *\"",
      "        - \"bun --version\"",
      "    - capability: shell",
      "      effect: ask",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine config set *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine adapter *\"",
      "        - \"*$*\"",
      "        - \"*`*\"",
      "        - \"*>*\"",
      "        - \"*<*\"",
      "        - \"*&*\"",
      "        - \"*@(*\"",
      "        - \"*@{*\"",
      "        - \"*\\n*\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-*\"",
      "        - \"bun .kiro/tools/aidlc.ts engine *\"",
      "        - \"bun .kiro/tools/aidlc.ts doctor\"",
      "        - \"bun .kiro/tools/aidlc.ts doctor --verbose\"",
      "        - \"bun .kiro/tools/aidlc.ts version\"",
      "        - \"bun .kiro/tools/aidlc.ts --doctor\"",
      "        - \"bun .kiro/tools/aidlc.ts --doctor --verbose\"",
      "        - \"bun .kiro/tools/aidlc.ts --version\"",
      "        - \"bun .kiro/tools/aidlc.ts status\"",
      "        - \"bun .kiro/tools/aidlc.ts --status\"",
      "        - \"bun .kiro/tools/aidlc.ts config --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config models --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config models --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config models --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config runtime --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config runtime --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config runtime --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config providers --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config providers --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config providers --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config trust --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config trust --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config trust --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config project --show\"",
      "        - \"bun .kiro/tools/aidlc.ts config project --show --json\"",
      "        - \"bun .kiro/tools/aidlc.ts config project --help\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-attest.ts\"",
      "        - \"bun .kiro/tools/aidlc-attest.ts *\"",
      "        - \"bun .kiro/tools/aidlc-audit.ts\"",
      "        - \"bun .kiro/tools/aidlc-audit.ts *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts *\"",
      "        - \"bun .kiro/tools/aidlc-jump.ts\"",
      "        - \"bun .kiro/tools/aidlc-jump.ts *\"",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts\"",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts *\"",
      "        - \"bun .kiro/tools/aidlc-learnings.ts\"",
      "        - \"bun .kiro/tools/aidlc-learnings.ts *\"",
      "        - \"bun .kiro/tools/aidlc-log.ts\"",
      "        - \"bun .kiro/tools/aidlc-log.ts *\"",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts\"",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts *\"",
      "        - \"bun .kiro/tools/aidlc-plugin.ts\"",
      "        - \"bun .kiro/tools/aidlc-plugin.ts *\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts *\"",
      "        - \"bun .kiro/tools/aidlc-runtime.ts\"",
      "        - \"bun .kiro/tools/aidlc-runtime.ts *\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts *\"",
      "        - \"bun .kiro/tools/aidlc-state.ts\"",
      "        - \"bun .kiro/tools/aidlc-state.ts *\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts *\"",
      "        - \"bun .kiro/tools/aidlc-unit.ts\"",
      "        - \"bun .kiro/tools/aidlc-unit.ts *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts *\"",
      "        - \"bun .kiro/tools/aidlc-validate.ts\"",
      "        - \"bun .kiro/tools/aidlc-validate.ts *\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine status\"",
      "        - \"bun .kiro/tools/aidlc.ts engine status *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine now\"",
      "        - \"bun .kiro/tools/aidlc.ts engine now *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine audit\"",
      "        - \"bun .kiro/tools/aidlc.ts engine audit *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime\"",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine jump\"",
      "        - \"bun .kiro/tools/aidlc.ts engine jump *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine log\"",
      "        - \"bun .kiro/tools/aidlc.ts engine log *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine learnings\"",
      "        - \"bun .kiro/tools/aidlc.ts engine learnings *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine validate\"",
      "        - \"bun .kiro/tools/aidlc.ts engine validate *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine scope\"",
      "        - \"bun .kiro/tools/aidlc.ts engine scope *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine config\"",
      "        - \"bun .kiro/tools/aidlc.ts engine config *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge\"",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine gen\"",
      "        - \"bun .kiro/tools/aidlc.ts engine gen *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-attest.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-attest.ts resolve\"",
      "        - \"bun .kiro/tools/aidlc-attest.ts resolve *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-audit.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-audit.ts history\"",
      "        - \"bun .kiro/tools/aidlc-audit.ts history *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-graph.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-graph.ts artifacts\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts artifacts *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts producers\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts producers *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts consumers\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts consumers *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts topo\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts topo *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts cycles\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts cycles *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts scope\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts scope *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts validate-scope\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts validate-scope *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts validate-grid\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts validate-grid *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts ars\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts ars *\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts export\"",
      "        - \"bun .kiro/tools/aidlc-graph.ts export *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-jump.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-jump.ts resolve\"",
      "        - \"bun .kiro/tools/aidlc-jump.ts resolve *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts list\"",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts list *\"",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts show\"",
      "        - \"bun .kiro/tools/aidlc-knowledge.ts show *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-learnings.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-learnings.ts surface\"",
      "        - \"bun .kiro/tools/aidlc-learnings.ts surface *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-log.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-log.ts answers\"",
      "        - \"bun .kiro/tools/aidlc-log.ts answers *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts wait\"",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts wait *\"",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts team-board\"",
      "        - \"bun .kiro/tools/aidlc-orchestrate.ts team-board *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-plugin.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-plugin.ts list\"",
      "        - \"bun .kiro/tools/aidlc-plugin.ts list *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts review\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts review *\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts context\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts context *\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts summary\"",
      "        - \"bun .kiro/tools/aidlc-review-brief.ts summary *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-runtime.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-runtime.ts read\"",
      "        - \"bun .kiro/tools/aidlc-runtime.ts read *\"",
      "        - \"bun .kiro/tools/aidlc-runtime.ts summary\"",
      "        - \"bun .kiro/tools/aidlc-runtime.ts summary *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-sensor.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-sensor.ts list\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts list *\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts describe\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts describe *\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts fire\"",
      "        - \"bun .kiro/tools/aidlc-sensor.ts fire *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-state.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-state.ts get\"",
      "        - \"bun .kiro/tools/aidlc-state.ts get *\"",
      "        - \"bun .kiro/tools/aidlc-state.ts count\"",
      "        - \"bun .kiro/tools/aidlc-state.ts count *\"",
      "        - \"bun .kiro/tools/aidlc-state.ts resume\"",
      "        - \"bun .kiro/tools/aidlc-state.ts resume *\"",
      "        - \"bun .kiro/tools/aidlc-state.ts lookup\"",
      "        - \"bun .kiro/tools/aidlc-state.ts lookup *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts resolve\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts resolve *\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts render\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts render *\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts verify\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts verify *\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts reply\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts reply *\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts brief\"",
      "        - \"bun .kiro/tools/aidlc-testing-posture.ts brief *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-unit.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-unit.ts merge-status\"",
      "        - \"bun .kiro/tools/aidlc-unit.ts merge-status *\"",
      "        - \"bun .kiro/tools/aidlc-unit.ts status\"",
      "        - \"bun .kiro/tools/aidlc-unit.ts status *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-utility.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-utility.ts help\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts help *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts version\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts version *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts now\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts now *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts status\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts status *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts detect\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts detect *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts project-description\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts project-description *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-path\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-path *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-scope-diff\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-scope-diff *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-snapshot\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-snapshot *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-publish\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts codekb-publish *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts plugin-list\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts plugin-list *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts plugin-validate\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts plugin-validate *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts config-get\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts config-get *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts config-list\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts config-list *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts resolve-env-scope\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts resolve-env-scope *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts scope-table\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts scope-table *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts stage-table\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts stage-table *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --json\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --quiet\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --no-color\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --yes\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --offline\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts select-plugins --verbose\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts document-input\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts document-input *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --json\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --quiet\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --no-color\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --yes\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --offline\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --verbose\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent list\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent list *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --json\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --quiet\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --no-color\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --yes\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --offline\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent --all --verbose\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent help\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent help *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent -h\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts intent -h *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --json\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --quiet\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --no-color\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --yes\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --offline\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space --verbose\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space list\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space list *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space help\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space help *\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space -h\"",
      "        - \"bun .kiro/tools/aidlc-utility.ts space -h *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-validate.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-validate.ts outputs\"",
      "        - \"bun .kiro/tools/aidlc-validate.ts outputs *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc-worktree.ts *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc-worktree.ts list\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts list *\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts verify\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts verify *\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts info\"",
      "        - \"bun .kiro/tools/aidlc-worktree.ts info *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine intent *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine intent\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --json\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --quiet\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --no-color\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --offline\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --verbose\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --all\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent --all *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent help\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent help *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent -h\"",
      "        - \"bun .kiro/tools/aidlc.ts engine intent -h *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine space *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine space\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --json\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --quiet\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --no-color\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --offline\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space --verbose\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space help\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space help *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space -h\"",
      "        - \"bun .kiro/tools/aidlc.ts engine space -h *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine status *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine status\"",
      "        - \"bun .kiro/tools/aidlc.ts engine status *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine now *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine now\"",
      "        - \"bun .kiro/tools/aidlc.ts engine now *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine state *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine state get\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state get *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state count\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state count *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state resume\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state resume *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state lookup\"",
      "        - \"bun .kiro/tools/aidlc.ts engine state lookup *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine audit *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine audit history\"",
      "        - \"bun .kiro/tools/aidlc.ts engine audit history *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine graph *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine graph artifacts\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph artifacts *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph producers\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph producers *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph consumers\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph consumers *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph topo\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph topo *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph cycles\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph cycles *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph scope\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph scope *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph validate-scope\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph validate-scope *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph validate-grid\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph validate-grid *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph ars\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph ars *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph export\"",
      "        - \"bun .kiro/tools/aidlc.ts engine graph export *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime read\"",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime read *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime summary\"",
      "        - \"bun .kiro/tools/aidlc.ts engine runtime summary *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor describe\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor describe *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor fire\"",
      "        - \"bun .kiro/tools/aidlc.ts engine sensor fire *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree verify\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree verify *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree info\"",
      "        - \"bun .kiro/tools/aidlc.ts engine worktree info *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine jump *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine jump resolve\"",
      "        - \"bun .kiro/tools/aidlc.ts engine jump resolve *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine log *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine log answers\"",
      "        - \"bun .kiro/tools/aidlc.ts engine log answers *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine learnings *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine learnings surface\"",
      "        - \"bun .kiro/tools/aidlc.ts engine learnings surface *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture resolve\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture resolve *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture render\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture render *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture verify\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture verify *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture brief\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture brief *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture reply\"",
      "        - \"bun .kiro/tools/aidlc.ts engine testing-posture reply *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine validate *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine validate outputs\"",
      "        - \"bun .kiro/tools/aidlc.ts engine validate outputs *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine scope *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine scope resolve-env\"",
      "        - \"bun .kiro/tools/aidlc.ts engine scope resolve-env *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine config *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine config get\"",
      "        - \"bun .kiro/tools/aidlc.ts engine config get *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine config list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine config list *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --json\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --quiet\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --no-color\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --yes\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --offline\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin select --verbose\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin validate\"",
      "        - \"bun .kiro/tools/aidlc.ts engine plugin validate *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge list\"",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge list *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge show\"",
      "        - \"bun .kiro/tools/aidlc.ts engine knowledge show *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine gen *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine gen stage-table\"",
      "        - \"bun .kiro/tools/aidlc.ts engine gen stage-table *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine gen scope-table\"",
      "        - \"bun .kiro/tools/aidlc.ts engine gen scope-table *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace detect\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace detect *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-scope-diff\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-scope-diff *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-snapshot\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-snapshot *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-publish\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace codekb-publish *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace project-description\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace project-description *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace document-input\"",
      "        - \"bun .kiro/tools/aidlc.ts engine workspace document-input *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief review\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief review *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief context\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief context *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief summary\"",
      "        - \"bun .kiro/tools/aidlc.ts engine review-brief summary *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate *\"",
      "      exclude:",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate wait\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate wait *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate team-board\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate team-board *\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate help\"",
      "        - \"bun .kiro/tools/aidlc.ts engine orchestrate help *\"",
      "    - capability: shell",
      "      effect: deny",
      "      match:",
      "        - \"bun .kiro/tools/aidlc*$*\"",
      "        - \"bun .kiro/tools/aidlc*`*\"",
      "        - \"bun .kiro/tools/aidlc*>*\"",
      "        - \"bun .kiro/tools/aidlc*<*\"",
      "        - \"bun .kiro/tools/aidlc*&*\"",
      "        - \"bun .kiro/tools/aidlc*@(*\"",
      "        - \"bun .kiro/tools/aidlc*@{*\"",
      "        - \"bun .kiro/tools/aidlc*\\n*\"",
      "    - capability: fs_read",
      "      effect: allow",
      "      match:",
      "        - \"**\"",
      "    - capability: filesystem",
      "      effect: allow",
      "      match:",
      "        - \"aidlc/spaces/**\"",
      "    - capability: fs_write",
      "      effect: deny",
      "      match:",
      "        - \".kiro/**\"",
      "        - \"aidlc/.aidlc-sessions/**\"",
      "        - \"aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**\""
    ],
    "denialComparison": "equivalent"
  }
];

export const kiroWorkerCases = kiroRows.map((entry) => ({...entry, target: declaredKiroTargets.find(target=>target.baseline===entry.baseline) ?? expect.unreachable("missing declared Kiro target contract"), source: agentSourceCases.find(source => source.baseline === entry.baseline && source.kind === "plugin") ?? expect.unreachable("missing real worker source")}));
export const kasWorkerCases = kasRows.map((entry) => ({...entry, target: declaredKasTargets.find(target=>target.baseline===entry.baseline) ?? expect.unreachable("missing declared KAS target contract"), source: agentSourceCases.find(source => source.baseline === entry.baseline && source.kind === "plugin") ?? expect.unreachable("missing real worker source")}));
