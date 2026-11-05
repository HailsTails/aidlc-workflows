import type{GeneratedRunner,RunnerRequest}from"../src/domain/generated-runner.ts";
import type{SourceOrigin}from"../src/domain/source-origin.ts";
import type{SkillContext}from"../src/domain/skill-definition.ts";
import type{NativeResource}from"../src/domain/native-rendering.ts";
import type{Outcome}from"../src/domain/model.ts";
export const rinRunnerSourceCases:{readonly baseline:string;readonly context:SkillContext;readonly compiler:SourceOrigin;readonly requests:readonly RunnerRequest[];readonly compiled:readonly GeneratedRunner[];readonly expected:readonly NativeResource[]}[]=[
  {
    "baseline": "fork",
    "context": {
      "modelInvocation": "native-default",
      "harness": "claude",
      "directory": ".claude",
      "invocation": "bun .claude/tools/aidlc.ts",
      "rulesSubdir": "rules",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "stage",
        "slug": "rin-gate-0-reconcile"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-1-framing"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-2-plan-review"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-3-interface-lock"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-4-implement"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-5-review-cycle"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-6-operate"
      }
    ],
    "compiled": [
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "claude",
          "directory": ".claude"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-0-reconcile"
        },
        "name": "rin-gate-0-reconcile",
        "description": "Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`: the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-0-reconcile\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`:\n  the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-0-reconcile\n\nRun the `rin-gate-0-reconcile` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-0-reconcile --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-0-reconcile --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-0-reconcile` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-0-reconcile --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "claude",
          "directory": ".claude"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-1-framing"
        },
        "name": "rin-gate-1-framing",
        "description": "Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`: the engine emits one run-stage directive for rin-gate-1-framing and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-1-framing\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`:\n  the engine emits one run-stage directive for rin-gate-1-framing and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-1-framing\n\nRun the `rin-gate-1-framing` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-1-framing --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-1-framing --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-1-framing` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-1-framing --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "claude",
          "directory": ".claude"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-2-plan-review"
        },
        "name": "rin-gate-2-plan-review",
        "description": "Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`: the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-2-plan-review\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`:\n  the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-2-plan-review\n\nRun the `rin-gate-2-plan-review` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-2-plan-review --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-2-plan-review --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-2-plan-review` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-2-plan-review --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "claude",
          "directory": ".claude"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-3-interface-lock"
        },
        "name": "rin-gate-3-interface-lock",
        "description": "Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`: the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-3-interface-lock\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`:\n  the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-3-interface-lock\n\nRun the `rin-gate-3-interface-lock` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-3-interface-lock --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-3-interface-lock --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-3-interface-lock` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-3-interface-lock --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "claude",
          "directory": ".claude"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-4-implement"
        },
        "name": "rin-gate-4-implement",
        "description": "Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`: the engine emits one run-stage directive for rin-gate-4-implement and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-4-implement\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`:\n  the engine emits one run-stage directive for rin-gate-4-implement and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-4-implement\n\nRun the `rin-gate-4-implement` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-4-implement --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-4-implement --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-4-implement` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-4-implement --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "claude",
          "directory": ".claude"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-5-review-cycle"
        },
        "name": "rin-gate-5-review-cycle",
        "description": "Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`: the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-5-review-cycle\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`:\n  the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-5-review-cycle\n\nRun the `rin-gate-5-review-cycle` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-5-review-cycle --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-5-review-cycle --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-5-review-cycle` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-5-review-cycle --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "claude",
          "directory": ".claude"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-6-operate"
        },
        "name": "rin-gate-6-operate",
        "description": "Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`: the engine emits one run-stage directive for rin-gate-6-operate and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-6-operate\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`:\n  the engine emits one run-stage directive for rin-gate-6-operate and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-6-operate\n\nRun the `rin-gate-6-operate` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-6-operate --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-6-operate --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-6-operate` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-6-operate --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      }
    ],
    "expected": [
      {
        "kind": "file",
        "path": ".claude/skills/rin-gate-0-reconcile/SKILL.md",
        "body": "---\nname: rin-gate-0-reconcile\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`:\n  the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-0-reconcile\n\nRun the `rin-gate-0-reconcile` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-0-reconcile --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-0-reconcile --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-0-reconcile` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-0-reconcile --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".claude/skills/rin-gate-1-framing/SKILL.md",
        "body": "---\nname: rin-gate-1-framing\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`:\n  the engine emits one run-stage directive for rin-gate-1-framing and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-1-framing\n\nRun the `rin-gate-1-framing` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-1-framing --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-1-framing --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-1-framing` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-1-framing --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".claude/skills/rin-gate-2-plan-review/SKILL.md",
        "body": "---\nname: rin-gate-2-plan-review\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`:\n  the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-2-plan-review\n\nRun the `rin-gate-2-plan-review` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-2-plan-review --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-2-plan-review --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-2-plan-review` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-2-plan-review --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".claude/skills/rin-gate-3-interface-lock/SKILL.md",
        "body": "---\nname: rin-gate-3-interface-lock\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`:\n  the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-3-interface-lock\n\nRun the `rin-gate-3-interface-lock` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-3-interface-lock --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-3-interface-lock --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-3-interface-lock` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-3-interface-lock --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".claude/skills/rin-gate-4-implement/SKILL.md",
        "body": "---\nname: rin-gate-4-implement\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`:\n  the engine emits one run-stage directive for rin-gate-4-implement and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-4-implement\n\nRun the `rin-gate-4-implement` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-4-implement --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-4-implement --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-4-implement` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-4-implement --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".claude/skills/rin-gate-5-review-cycle/SKILL.md",
        "body": "---\nname: rin-gate-5-review-cycle\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`:\n  the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-5-review-cycle\n\nRun the `rin-gate-5-review-cycle` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-5-review-cycle --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-5-review-cycle --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-5-review-cycle` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-5-review-cycle --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".claude/skills/rin-gate-6-operate/SKILL.md",
        "body": "---\nname: rin-gate-6-operate\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`:\n  the engine emits one run-stage directive for rin-gate-6-operate and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-6-operate\n\nRun the `rin-gate-6-operate` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-6-operate --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts next --stage rin-gate-6-operate --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-6-operate` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .claude/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.claude/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.claude/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .claude/tools/aidlc-orchestrate.ts report --single --stage rin-gate-6-operate --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      }
    ]
  },
  {
    "baseline": "fork",
    "context": {
      "modelInvocation": "native-default",
      "harness": "cursor",
      "directory": ".cursor",
      "invocation": "bun .cursor/tools/aidlc.ts",
      "rulesSubdir": "rules",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "stage",
        "slug": "rin-gate-0-reconcile"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-1-framing"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-2-plan-review"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-3-interface-lock"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-4-implement"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-5-review-cycle"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-6-operate"
      }
    ],
    "compiled": [
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "cursor",
          "directory": ".cursor"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-0-reconcile"
        },
        "name": "rin-gate-0-reconcile",
        "description": "Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`: the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-0-reconcile\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`:\n  the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-0-reconcile\n\nRun the `rin-gate-0-reconcile` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-0-reconcile --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-0-reconcile --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-0-reconcile` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-0-reconcile --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "cursor",
          "directory": ".cursor"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-1-framing"
        },
        "name": "rin-gate-1-framing",
        "description": "Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`: the engine emits one run-stage directive for rin-gate-1-framing and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-1-framing\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`:\n  the engine emits one run-stage directive for rin-gate-1-framing and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-1-framing\n\nRun the `rin-gate-1-framing` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-1-framing --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-1-framing --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-1-framing` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-1-framing --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "cursor",
          "directory": ".cursor"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-2-plan-review"
        },
        "name": "rin-gate-2-plan-review",
        "description": "Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`: the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-2-plan-review\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`:\n  the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-2-plan-review\n\nRun the `rin-gate-2-plan-review` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-2-plan-review --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-2-plan-review --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-2-plan-review` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-2-plan-review --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "cursor",
          "directory": ".cursor"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-3-interface-lock"
        },
        "name": "rin-gate-3-interface-lock",
        "description": "Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`: the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-3-interface-lock\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`:\n  the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-3-interface-lock\n\nRun the `rin-gate-3-interface-lock` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-3-interface-lock --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-3-interface-lock --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-3-interface-lock` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-3-interface-lock --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "cursor",
          "directory": ".cursor"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-4-implement"
        },
        "name": "rin-gate-4-implement",
        "description": "Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`: the engine emits one run-stage directive for rin-gate-4-implement and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-4-implement\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`:\n  the engine emits one run-stage directive for rin-gate-4-implement and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-4-implement\n\nRun the `rin-gate-4-implement` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-4-implement --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-4-implement --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-4-implement` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-4-implement --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "cursor",
          "directory": ".cursor"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-5-review-cycle"
        },
        "name": "rin-gate-5-review-cycle",
        "description": "Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`: the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-5-review-cycle\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`:\n  the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-5-review-cycle\n\nRun the `rin-gate-5-review-cycle` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-5-review-cycle --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-5-review-cycle --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-5-review-cycle` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-5-review-cycle --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "cursor",
          "directory": ".cursor"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-6-operate"
        },
        "name": "rin-gate-6-operate",
        "description": "Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`: the engine emits one run-stage directive for rin-gate-6-operate and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-6-operate\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`:\n  the engine emits one run-stage directive for rin-gate-6-operate and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-6-operate\n\nRun the `rin-gate-6-operate` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-6-operate --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-6-operate --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-6-operate` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-6-operate --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      }
    ],
    "expected": [
      {
        "kind": "file",
        "path": ".cursor/skills/rin-gate-0-reconcile/SKILL.md",
        "body": "---\nname: rin-gate-0-reconcile\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`:\n  the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-0-reconcile\n\nRun the `rin-gate-0-reconcile` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-0-reconcile --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-0-reconcile --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-0-reconcile` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-0-reconcile --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".cursor/skills/rin-gate-1-framing/SKILL.md",
        "body": "---\nname: rin-gate-1-framing\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`:\n  the engine emits one run-stage directive for rin-gate-1-framing and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-1-framing\n\nRun the `rin-gate-1-framing` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-1-framing --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-1-framing --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-1-framing` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-1-framing --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".cursor/skills/rin-gate-2-plan-review/SKILL.md",
        "body": "---\nname: rin-gate-2-plan-review\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`:\n  the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-2-plan-review\n\nRun the `rin-gate-2-plan-review` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-2-plan-review --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-2-plan-review --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-2-plan-review` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-2-plan-review --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".cursor/skills/rin-gate-3-interface-lock/SKILL.md",
        "body": "---\nname: rin-gate-3-interface-lock\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`:\n  the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-3-interface-lock\n\nRun the `rin-gate-3-interface-lock` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-3-interface-lock --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-3-interface-lock --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-3-interface-lock` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-3-interface-lock --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".cursor/skills/rin-gate-4-implement/SKILL.md",
        "body": "---\nname: rin-gate-4-implement\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`:\n  the engine emits one run-stage directive for rin-gate-4-implement and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-4-implement\n\nRun the `rin-gate-4-implement` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-4-implement --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-4-implement --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-4-implement` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-4-implement --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".cursor/skills/rin-gate-5-review-cycle/SKILL.md",
        "body": "---\nname: rin-gate-5-review-cycle\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`:\n  the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-5-review-cycle\n\nRun the `rin-gate-5-review-cycle` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-5-review-cycle --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-5-review-cycle --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-5-review-cycle` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-5-review-cycle --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".cursor/skills/rin-gate-6-operate/SKILL.md",
        "body": "---\nname: rin-gate-6-operate\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`:\n  the engine emits one run-stage directive for rin-gate-6-operate and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-6-operate\n\nRun the `rin-gate-6-operate` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-6-operate --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts next --stage rin-gate-6-operate --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-6-operate` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .cursor/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.cursor/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.cursor/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .cursor/tools/aidlc-orchestrate.ts report --single --stage rin-gate-6-operate --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      }
    ]
  },
  {
    "baseline": "fork",
    "context": {
      "modelInvocation": "native-default",
      "harness": "copilot",
      "directory": ".aidlc",
      "invocation": "bun .aidlc/tools/aidlc.ts",
      "rulesSubdir": "rules",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "stage",
        "slug": "rin-gate-0-reconcile"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-1-framing"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-2-plan-review"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-3-interface-lock"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-4-implement"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-5-review-cycle"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-6-operate"
      }
    ],
    "compiled": [
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "copilot",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-0-reconcile"
        },
        "name": "rin-gate-0-reconcile",
        "description": "Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`: the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-0-reconcile\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`:\n  the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-0-reconcile\n\nRun the `rin-gate-0-reconcile` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-0-reconcile --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-0-reconcile --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-0-reconcile` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-0-reconcile --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "copilot",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-1-framing"
        },
        "name": "rin-gate-1-framing",
        "description": "Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`: the engine emits one run-stage directive for rin-gate-1-framing and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-1-framing\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`:\n  the engine emits one run-stage directive for rin-gate-1-framing and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-1-framing\n\nRun the `rin-gate-1-framing` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-1-framing --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-1-framing --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-1-framing` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-1-framing --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "copilot",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-2-plan-review"
        },
        "name": "rin-gate-2-plan-review",
        "description": "Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`: the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-2-plan-review\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`:\n  the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-2-plan-review\n\nRun the `rin-gate-2-plan-review` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-2-plan-review --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-2-plan-review --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-2-plan-review` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-2-plan-review --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "copilot",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-3-interface-lock"
        },
        "name": "rin-gate-3-interface-lock",
        "description": "Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`: the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-3-interface-lock\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`:\n  the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-3-interface-lock\n\nRun the `rin-gate-3-interface-lock` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-3-interface-lock --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-3-interface-lock --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-3-interface-lock` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-3-interface-lock --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "copilot",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-4-implement"
        },
        "name": "rin-gate-4-implement",
        "description": "Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`: the engine emits one run-stage directive for rin-gate-4-implement and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-4-implement\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`:\n  the engine emits one run-stage directive for rin-gate-4-implement and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-4-implement\n\nRun the `rin-gate-4-implement` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-4-implement --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-4-implement --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-4-implement` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-4-implement --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "copilot",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-5-review-cycle"
        },
        "name": "rin-gate-5-review-cycle",
        "description": "Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`: the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-5-review-cycle\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`:\n  the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-5-review-cycle\n\nRun the `rin-gate-5-review-cycle` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-5-review-cycle --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-5-review-cycle --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-5-review-cycle` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-5-review-cycle --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "copilot",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-6-operate"
        },
        "name": "rin-gate-6-operate",
        "description": "Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`: the engine emits one run-stage directive for rin-gate-6-operate and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-6-operate\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`:\n  the engine emits one run-stage directive for rin-gate-6-operate and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-6-operate\n\nRun the `rin-gate-6-operate` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-6-operate --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-6-operate --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-6-operate` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-6-operate --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "disabled"
      }
    ],
    "expected": [
      {
        "kind": "file",
        "path": ".github/skills/rin-gate-0-reconcile/SKILL.md",
        "body": "---\nname: rin-gate-0-reconcile\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`:\n  the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-0-reconcile\n\nRun the `rin-gate-0-reconcile` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-0-reconcile --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-0-reconcile --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-0-reconcile` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-0-reconcile --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".github/skills/rin-gate-1-framing/SKILL.md",
        "body": "---\nname: rin-gate-1-framing\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`:\n  the engine emits one run-stage directive for rin-gate-1-framing and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-1-framing\n\nRun the `rin-gate-1-framing` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-1-framing --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-1-framing --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-1-framing` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-1-framing --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".github/skills/rin-gate-2-plan-review/SKILL.md",
        "body": "---\nname: rin-gate-2-plan-review\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`:\n  the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-2-plan-review\n\nRun the `rin-gate-2-plan-review` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-2-plan-review --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-2-plan-review --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-2-plan-review` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-2-plan-review --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".github/skills/rin-gate-3-interface-lock/SKILL.md",
        "body": "---\nname: rin-gate-3-interface-lock\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`:\n  the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-3-interface-lock\n\nRun the `rin-gate-3-interface-lock` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-3-interface-lock --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-3-interface-lock --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-3-interface-lock` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-3-interface-lock --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".github/skills/rin-gate-4-implement/SKILL.md",
        "body": "---\nname: rin-gate-4-implement\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`:\n  the engine emits one run-stage directive for rin-gate-4-implement and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-4-implement\n\nRun the `rin-gate-4-implement` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-4-implement --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-4-implement --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-4-implement` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-4-implement --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".github/skills/rin-gate-5-review-cycle/SKILL.md",
        "body": "---\nname: rin-gate-5-review-cycle\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`:\n  the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-5-review-cycle\n\nRun the `rin-gate-5-review-cycle` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-5-review-cycle --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-5-review-cycle --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-5-review-cycle` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-5-review-cycle --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".github/skills/rin-gate-6-operate/SKILL.md",
        "body": "---\nname: rin-gate-6-operate\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`:\n  the engine emits one run-stage directive for rin-gate-6-operate and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\ndisable-model-invocation: true\n---\n\n# AI-DLC Stage Runner — rin-gate-6-operate\n\nRun the `rin-gate-6-operate` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-6-operate --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-6-operate --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-6-operate` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-6-operate --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      }
    ]
  },
  {
    "baseline": "fork",
    "context": {
      "modelInvocation": "native-default",
      "harness": "opencode",
      "directory": ".aidlc",
      "invocation": "bun .aidlc/tools/aidlc.ts",
      "rulesSubdir": "rules",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "stage",
        "slug": "rin-gate-0-reconcile"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-1-framing"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-2-plan-review"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-3-interface-lock"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-4-implement"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-5-review-cycle"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-6-operate"
      }
    ],
    "compiled": [
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "opencode",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-0-reconcile"
        },
        "name": "rin-gate-0-reconcile",
        "description": "Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`: the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-0-reconcile\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`:\n  the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-0-reconcile\n\nRun the `rin-gate-0-reconcile` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-0-reconcile --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-0-reconcile --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-0-reconcile` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-0-reconcile --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "unspecified"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "opencode",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-1-framing"
        },
        "name": "rin-gate-1-framing",
        "description": "Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`: the engine emits one run-stage directive for rin-gate-1-framing and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-1-framing\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`:\n  the engine emits one run-stage directive for rin-gate-1-framing and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-1-framing\n\nRun the `rin-gate-1-framing` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-1-framing --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-1-framing --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-1-framing` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-1-framing --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "unspecified"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "opencode",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-2-plan-review"
        },
        "name": "rin-gate-2-plan-review",
        "description": "Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`: the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-2-plan-review\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`:\n  the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-2-plan-review\n\nRun the `rin-gate-2-plan-review` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-2-plan-review --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-2-plan-review --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-2-plan-review` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-2-plan-review --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "unspecified"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "opencode",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-3-interface-lock"
        },
        "name": "rin-gate-3-interface-lock",
        "description": "Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`: the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-3-interface-lock\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`:\n  the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-3-interface-lock\n\nRun the `rin-gate-3-interface-lock` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-3-interface-lock --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-3-interface-lock --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-3-interface-lock` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-3-interface-lock --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "unspecified"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "opencode",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-4-implement"
        },
        "name": "rin-gate-4-implement",
        "description": "Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`: the engine emits one run-stage directive for rin-gate-4-implement and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-4-implement\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`:\n  the engine emits one run-stage directive for rin-gate-4-implement and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-4-implement\n\nRun the `rin-gate-4-implement` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-4-implement --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-4-implement --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-4-implement` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-4-implement --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "unspecified"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "opencode",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-5-review-cycle"
        },
        "name": "rin-gate-5-review-cycle",
        "description": "Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`: the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-5-review-cycle\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`:\n  the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-5-review-cycle\n\nRun the `rin-gate-5-review-cycle` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-5-review-cycle --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-5-review-cycle --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-5-review-cycle` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-5-review-cycle --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "unspecified"
      },
      {
        "compiler": {
          "source": {
            "kind": "core",
            "id": "framework"
          },
          "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
          "path": "core/tools/aidlc-runner-gen.ts"
        },
        "owner": {
          "kind": "plugin",
          "id": "rin"
        },
        "binding": {
          "harness": "opencode",
          "directory": ".aidlc"
        },
        "request": {
          "kind": "stage",
          "slug": "rin-gate-6-operate"
        },
        "name": "rin-gate-6-operate",
        "description": "Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`: the engine emits one run-stage directive for rin-gate-6-operate and its gate, the conductor runs it, then the single-stage run commits a synthetic-id pair and stops. The main workflow's Current Stage is never touched.",
        "markdown": "---\nname: rin-gate-6-operate\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`:\n  the engine emits one run-stage directive for rin-gate-6-operate and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-6-operate\n\nRun the `rin-gate-6-operate` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-6-operate --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-6-operate --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-6-operate` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-6-operate --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n",
        "frontmatterInvocation": "unspecified"
      }
    ],
    "expected": [
      {
        "kind": "file",
        "path": ".aidlc/skills/rin-gate-0-reconcile/SKILL.md",
        "body": "---\nname: rin-gate-0-reconcile\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-0-reconcile` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-0-reconcile --single`:\n  the engine emits one run-stage directive for rin-gate-0-reconcile and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-0-reconcile\n\nRun the `rin-gate-0-reconcile` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-0-reconcile --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-0-reconcile --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-0-reconcile` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-0-reconcile --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".aidlc/skills/rin-gate-1-framing/SKILL.md",
        "body": "---\nname: rin-gate-1-framing\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-1-framing` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-1-framing --single`:\n  the engine emits one run-stage directive for rin-gate-1-framing and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-1-framing\n\nRun the `rin-gate-1-framing` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-1-framing --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-1-framing --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-1-framing` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-1-framing --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".aidlc/skills/rin-gate-2-plan-review/SKILL.md",
        "body": "---\nname: rin-gate-2-plan-review\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-2-plan-review` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-2-plan-review --single`:\n  the engine emits one run-stage directive for rin-gate-2-plan-review and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-2-plan-review\n\nRun the `rin-gate-2-plan-review` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-2-plan-review --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-2-plan-review --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-2-plan-review` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-2-plan-review --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".aidlc/skills/rin-gate-3-interface-lock/SKILL.md",
        "body": "---\nname: rin-gate-3-interface-lock\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-3-interface-lock` stage (inception phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-3-interface-lock --single`:\n  the engine emits one run-stage directive for rin-gate-3-interface-lock and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-3-interface-lock\n\nRun the `rin-gate-3-interface-lock` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-3-interface-lock --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-3-interface-lock --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-3-interface-lock` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-3-interface-lock --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".aidlc/skills/rin-gate-4-implement/SKILL.md",
        "body": "---\nname: rin-gate-4-implement\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-4-implement` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-4-implement --single`:\n  the engine emits one run-stage directive for rin-gate-4-implement and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-4-implement\n\nRun the `rin-gate-4-implement` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-4-implement --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-4-implement --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-4-implement` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-4-implement --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".aidlc/skills/rin-gate-5-review-cycle/SKILL.md",
        "body": "---\nname: rin-gate-5-review-cycle\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-5-review-cycle` stage (construction phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-5-review-cycle --single`:\n  the engine emits one run-stage directive for rin-gate-5-review-cycle and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-5-review-cycle\n\nRun the `rin-gate-5-review-cycle` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-5-review-cycle --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-5-review-cycle --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-5-review-cycle` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-5-review-cycle --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      },
      {
        "kind": "file",
        "path": ".aidlc/skills/rin-gate-6-operate/SKILL.md",
        "body": "---\nname: rin-gate-6-operate\ngenerated-by: aidlc-runner-gen\ndescription: >\n  Run the rin plugin `rin-gate-6-operate` stage (operation phase) in isolation, without\n  advancing the main workflow. Packages `/aidlc --stage rin-gate-6-operate --single`:\n  the engine emits one run-stage directive for rin-gate-6-operate and its gate, the\n  conductor runs it, then the single-stage run commits a synthetic-id pair and\n  stops. The main workflow's Current Stage is never touched.\nargument-hint: \"\"\nuser-invocable: true\n---\n\n# AI-DLC Stage Runner — rin-gate-6-operate\n\nRun the `rin-gate-6-operate` stage from the rin plugin on its own. This is opt-in packaging over\n`/aidlc --stage rin-gate-6-operate --single`; the same stage is always reachable via\nthat flag without this skill.\n\n## Steps\n\n1. Ask the engine for the single-stage directive:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts next --stage rin-gate-6-operate --single\n   ```\n\n   The engine emits one `run-stage` directive for `rin-gate-6-operate` (carrying the\n   lead agent, the resolved consumes/produces paths, the rules and sensors in\n   context, and the conductor persona on the workflow's first run-stage). When the\n   stage's rules do not fit beside it (most stages on GitHub Copilot, and any\n   stage whose memory files have grown large), `load-steering` parts come\n   first instead. For each part, apply `directive.rules_content` in array\n   order and keep it as this stage's rules, and adopt `conductor_persona` when\n   the part carries it. Then run\n   `bun .aidlc/tools/aidlc-orchestrate.ts continue <directive.receipt>` (the\n   receipt is the 8-character string printed at the top of the directive; copy\n   it, never rebuild it) and act on the directive that comes back. Do not call\n   `report` for a part or tell the user about it. Repeat until the\n   `run-stage` arrives, show its `stage_validity` and `change_notices`\n   once, and run the stage exactly as it describes; do not load the conductor\n   persona by hand, the engine delivers it.\n\n2. Before acting on the directive, read\n   `.aidlc/aidlc-common/protocols/stage-protocol.md`. Then read every\n   `.aidlc/aidlc-common/protocols/stage-protocol-<module>.md` named by\n   `directive.protocol_modules`. Load every listed module before reading the\n   stage body or running its topology; skip only a module already loaded earlier\n   in this session.\n\n3. When the stage's work is done, commit the single-stage record:\n\n   ```bash\n   bun .aidlc/tools/aidlc-orchestrate.ts report --single --stage rin-gate-6-operate --result completed\n   ```\n\n   This records a STAGE_STARTED / STAGE_COMPLETED pair under a synthetic workflow\n   id and stops. It NEVER writes the main workflow's `Current Stage` — a\n   single-stage run is isolated by design (the tool refuses to advance the main\n   workflow).\n"
      }
    ]
  }
];
export const rinRunnerRefusalCases:{readonly name:string;readonly context:SkillContext;readonly compiler:SourceOrigin;readonly requests:readonly RunnerRequest[];readonly response:unknown;readonly expected:Outcome<never>}[]=[
  {
    "name": "Rin scopes are not opted into runner generation",
    "context": {
      "modelInvocation": "native-default",
      "harness": "claude",
      "directory": ".claude",
      "invocation": "bun .claude/tools/aidlc.ts",
      "rulesSubdir": "rules",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "scope",
        "scope": "rin-audit"
      },
      {
        "kind": "scope",
        "scope": "rin-bugfix"
      },
      {
        "kind": "scope",
        "scope": "rin-dep-bump"
      },
      {
        "kind": "scope",
        "scope": "rin-gates"
      },
      {
        "kind": "scope",
        "scope": "rin-harness"
      },
      {
        "kind": "scope",
        "scope": "rin-ops"
      },
      {
        "kind": "scope",
        "scope": "rin-retired"
      },
      {
        "kind": "scope",
        "scope": "rin-unit"
      }
    ],
    "response": [
      {
        "key": "scope:rin-audit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-audit"
      },
      {
        "key": "scope:rin-bugfix",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-bugfix"
      },
      {
        "key": "scope:rin-dep-bump",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-dep-bump"
      },
      {
        "key": "scope:rin-gates",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-gates"
      },
      {
        "key": "scope:rin-harness",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-harness"
      },
      {
        "key": "scope:rin-ops",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-ops"
      },
      {
        "key": "scope:rin-retired",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-retired"
      },
      {
        "key": "scope:rin-unit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-unit"
      }
    ],
    "expected": {
      "status": "invalid",
      "findings": [
        {
          "code": "capability-gap",
          "subject": "scope:rin-audit",
          "detail": "scope is not marked for a shipped runner: rin-audit"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-bugfix",
          "detail": "scope is not marked for a shipped runner: rin-bugfix"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-dep-bump",
          "detail": "scope is not marked for a shipped runner: rin-dep-bump"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-gates",
          "detail": "scope is not marked for a shipped runner: rin-gates"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-harness",
          "detail": "scope is not marked for a shipped runner: rin-harness"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-ops",
          "detail": "scope is not marked for a shipped runner: rin-ops"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-retired",
          "detail": "scope is not marked for a shipped runner: rin-retired"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-unit",
          "detail": "scope is not marked for a shipped runner: rin-unit"
        }
      ]
    }
  },
  {
    "name": "Rin scopes are not opted into runner generation",
    "context": {
      "modelInvocation": "native-default",
      "harness": "cursor",
      "directory": ".cursor",
      "invocation": "bun .cursor/tools/aidlc.ts",
      "rulesSubdir": "rules",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "scope",
        "scope": "rin-audit"
      },
      {
        "kind": "scope",
        "scope": "rin-bugfix"
      },
      {
        "kind": "scope",
        "scope": "rin-dep-bump"
      },
      {
        "kind": "scope",
        "scope": "rin-gates"
      },
      {
        "kind": "scope",
        "scope": "rin-harness"
      },
      {
        "kind": "scope",
        "scope": "rin-ops"
      },
      {
        "kind": "scope",
        "scope": "rin-retired"
      },
      {
        "kind": "scope",
        "scope": "rin-unit"
      }
    ],
    "response": [
      {
        "key": "scope:rin-audit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-audit"
      },
      {
        "key": "scope:rin-bugfix",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-bugfix"
      },
      {
        "key": "scope:rin-dep-bump",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-dep-bump"
      },
      {
        "key": "scope:rin-gates",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-gates"
      },
      {
        "key": "scope:rin-harness",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-harness"
      },
      {
        "key": "scope:rin-ops",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-ops"
      },
      {
        "key": "scope:rin-retired",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-retired"
      },
      {
        "key": "scope:rin-unit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-unit"
      }
    ],
    "expected": {
      "status": "invalid",
      "findings": [
        {
          "code": "capability-gap",
          "subject": "scope:rin-audit",
          "detail": "scope is not marked for a shipped runner: rin-audit"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-bugfix",
          "detail": "scope is not marked for a shipped runner: rin-bugfix"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-dep-bump",
          "detail": "scope is not marked for a shipped runner: rin-dep-bump"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-gates",
          "detail": "scope is not marked for a shipped runner: rin-gates"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-harness",
          "detail": "scope is not marked for a shipped runner: rin-harness"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-ops",
          "detail": "scope is not marked for a shipped runner: rin-ops"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-retired",
          "detail": "scope is not marked for a shipped runner: rin-retired"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-unit",
          "detail": "scope is not marked for a shipped runner: rin-unit"
        }
      ]
    }
  },
  {
    "name": "Rin scopes are not opted into runner generation",
    "context": {
      "modelInvocation": "disabled",
      "harness": "codex",
      "directory": ".codex",
      "invocation": "bun .codex/tools/aidlc.ts",
      "rulesSubdir": "aidlc-rules",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "scope",
        "scope": "rin-audit"
      },
      {
        "kind": "scope",
        "scope": "rin-bugfix"
      },
      {
        "kind": "scope",
        "scope": "rin-dep-bump"
      },
      {
        "kind": "scope",
        "scope": "rin-gates"
      },
      {
        "kind": "scope",
        "scope": "rin-harness"
      },
      {
        "kind": "scope",
        "scope": "rin-ops"
      },
      {
        "kind": "scope",
        "scope": "rin-retired"
      },
      {
        "kind": "scope",
        "scope": "rin-unit"
      }
    ],
    "response": [
      {
        "key": "scope:rin-audit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-audit"
      },
      {
        "key": "scope:rin-bugfix",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-bugfix"
      },
      {
        "key": "scope:rin-dep-bump",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-dep-bump"
      },
      {
        "key": "scope:rin-gates",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-gates"
      },
      {
        "key": "scope:rin-harness",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-harness"
      },
      {
        "key": "scope:rin-ops",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-ops"
      },
      {
        "key": "scope:rin-retired",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-retired"
      },
      {
        "key": "scope:rin-unit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-unit"
      }
    ],
    "expected": {
      "status": "invalid",
      "findings": [
        {
          "code": "capability-gap",
          "subject": "scope:rin-audit",
          "detail": "scope is not marked for a shipped runner: rin-audit"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-bugfix",
          "detail": "scope is not marked for a shipped runner: rin-bugfix"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-dep-bump",
          "detail": "scope is not marked for a shipped runner: rin-dep-bump"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-gates",
          "detail": "scope is not marked for a shipped runner: rin-gates"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-harness",
          "detail": "scope is not marked for a shipped runner: rin-harness"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-ops",
          "detail": "scope is not marked for a shipped runner: rin-ops"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-retired",
          "detail": "scope is not marked for a shipped runner: rin-retired"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-unit",
          "detail": "scope is not marked for a shipped runner: rin-unit"
        }
      ]
    }
  },
  {
    "name": "Rin stage prerequisites unavailable",
    "context": {
      "modelInvocation": "disabled",
      "harness": "codex",
      "directory": ".codex",
      "invocation": "bun .codex/tools/aidlc.ts",
      "rulesSubdir": "aidlc-rules",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "stage",
        "slug": "rin-gate-0-reconcile"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-1-framing"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-2-plan-review"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-3-interface-lock"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-4-implement"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-5-review-cycle"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-6-operate"
      }
    ],
    "response": [
      {
        "key": "stage:rin-gate-0-reconcile",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-0-reconcile"
      },
      {
        "key": "stage:rin-gate-1-framing",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-1-framing"
      },
      {
        "key": "stage:rin-gate-2-plan-review",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-2-plan-review"
      },
      {
        "key": "stage:rin-gate-3-interface-lock",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-3-interface-lock"
      },
      {
        "key": "stage:rin-gate-4-implement",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-4-implement"
      },
      {
        "key": "stage:rin-gate-5-review-cycle",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-5-review-cycle"
      },
      {
        "key": "stage:rin-gate-6-operate",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-6-operate"
      }
    ],
    "expected": {
      "status": "invalid",
      "findings": [
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-0-reconcile",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-0-reconcile"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-1-framing",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-1-framing"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-2-plan-review",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-2-plan-review"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-3-interface-lock",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-3-interface-lock"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-4-implement",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-4-implement"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-5-review-cycle",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-5-review-cycle"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-6-operate",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-6-operate"
        }
      ]
    }
  },
  {
    "name": "Rin scopes are not opted into runner generation",
    "context": {
      "modelInvocation": "native-default",
      "harness": "copilot",
      "directory": ".aidlc",
      "invocation": "bun .aidlc/tools/aidlc.ts",
      "rulesSubdir": "rules",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "scope",
        "scope": "rin-audit"
      },
      {
        "kind": "scope",
        "scope": "rin-bugfix"
      },
      {
        "kind": "scope",
        "scope": "rin-dep-bump"
      },
      {
        "kind": "scope",
        "scope": "rin-gates"
      },
      {
        "kind": "scope",
        "scope": "rin-harness"
      },
      {
        "kind": "scope",
        "scope": "rin-ops"
      },
      {
        "kind": "scope",
        "scope": "rin-retired"
      },
      {
        "kind": "scope",
        "scope": "rin-unit"
      }
    ],
    "response": [
      {
        "key": "scope:rin-audit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-audit"
      },
      {
        "key": "scope:rin-bugfix",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-bugfix"
      },
      {
        "key": "scope:rin-dep-bump",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-dep-bump"
      },
      {
        "key": "scope:rin-gates",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-gates"
      },
      {
        "key": "scope:rin-harness",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-harness"
      },
      {
        "key": "scope:rin-ops",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-ops"
      },
      {
        "key": "scope:rin-retired",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-retired"
      },
      {
        "key": "scope:rin-unit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-unit"
      }
    ],
    "expected": {
      "status": "invalid",
      "findings": [
        {
          "code": "capability-gap",
          "subject": "scope:rin-audit",
          "detail": "scope is not marked for a shipped runner: rin-audit"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-bugfix",
          "detail": "scope is not marked for a shipped runner: rin-bugfix"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-dep-bump",
          "detail": "scope is not marked for a shipped runner: rin-dep-bump"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-gates",
          "detail": "scope is not marked for a shipped runner: rin-gates"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-harness",
          "detail": "scope is not marked for a shipped runner: rin-harness"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-ops",
          "detail": "scope is not marked for a shipped runner: rin-ops"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-retired",
          "detail": "scope is not marked for a shipped runner: rin-retired"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-unit",
          "detail": "scope is not marked for a shipped runner: rin-unit"
        }
      ]
    }
  },
  {
    "name": "Rin scopes are not opted into runner generation",
    "context": {
      "modelInvocation": "native-default",
      "harness": "opencode",
      "directory": ".aidlc",
      "invocation": "bun .aidlc/tools/aidlc.ts",
      "rulesSubdir": "rules",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "scope",
        "scope": "rin-audit"
      },
      {
        "kind": "scope",
        "scope": "rin-bugfix"
      },
      {
        "kind": "scope",
        "scope": "rin-dep-bump"
      },
      {
        "kind": "scope",
        "scope": "rin-gates"
      },
      {
        "kind": "scope",
        "scope": "rin-harness"
      },
      {
        "kind": "scope",
        "scope": "rin-ops"
      },
      {
        "kind": "scope",
        "scope": "rin-retired"
      },
      {
        "kind": "scope",
        "scope": "rin-unit"
      }
    ],
    "response": [
      {
        "key": "scope:rin-audit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-audit"
      },
      {
        "key": "scope:rin-bugfix",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-bugfix"
      },
      {
        "key": "scope:rin-dep-bump",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-dep-bump"
      },
      {
        "key": "scope:rin-gates",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-gates"
      },
      {
        "key": "scope:rin-harness",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-harness"
      },
      {
        "key": "scope:rin-ops",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-ops"
      },
      {
        "key": "scope:rin-retired",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-retired"
      },
      {
        "key": "scope:rin-unit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-unit"
      }
    ],
    "expected": {
      "status": "invalid",
      "findings": [
        {
          "code": "capability-gap",
          "subject": "scope:rin-audit",
          "detail": "scope is not marked for a shipped runner: rin-audit"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-bugfix",
          "detail": "scope is not marked for a shipped runner: rin-bugfix"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-dep-bump",
          "detail": "scope is not marked for a shipped runner: rin-dep-bump"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-gates",
          "detail": "scope is not marked for a shipped runner: rin-gates"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-harness",
          "detail": "scope is not marked for a shipped runner: rin-harness"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-ops",
          "detail": "scope is not marked for a shipped runner: rin-ops"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-retired",
          "detail": "scope is not marked for a shipped runner: rin-retired"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-unit",
          "detail": "scope is not marked for a shipped runner: rin-unit"
        }
      ]
    }
  },
  {
    "name": "Rin scopes are not opted into runner generation",
    "context": {
      "modelInvocation": "native-default",
      "harness": "kiro",
      "directory": ".kiro",
      "invocation": "bun .kiro/tools/aidlc.ts",
      "rulesSubdir": "steering",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "scope",
        "scope": "rin-audit"
      },
      {
        "kind": "scope",
        "scope": "rin-bugfix"
      },
      {
        "kind": "scope",
        "scope": "rin-dep-bump"
      },
      {
        "kind": "scope",
        "scope": "rin-gates"
      },
      {
        "kind": "scope",
        "scope": "rin-harness"
      },
      {
        "kind": "scope",
        "scope": "rin-ops"
      },
      {
        "kind": "scope",
        "scope": "rin-retired"
      },
      {
        "kind": "scope",
        "scope": "rin-unit"
      }
    ],
    "response": [
      {
        "key": "scope:rin-audit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-audit"
      },
      {
        "key": "scope:rin-bugfix",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-bugfix"
      },
      {
        "key": "scope:rin-dep-bump",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-dep-bump"
      },
      {
        "key": "scope:rin-gates",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-gates"
      },
      {
        "key": "scope:rin-harness",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-harness"
      },
      {
        "key": "scope:rin-ops",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-ops"
      },
      {
        "key": "scope:rin-retired",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-retired"
      },
      {
        "key": "scope:rin-unit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-unit"
      }
    ],
    "expected": {
      "status": "invalid",
      "findings": [
        {
          "code": "capability-gap",
          "subject": "scope:rin-audit",
          "detail": "scope is not marked for a shipped runner: rin-audit"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-bugfix",
          "detail": "scope is not marked for a shipped runner: rin-bugfix"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-dep-bump",
          "detail": "scope is not marked for a shipped runner: rin-dep-bump"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-gates",
          "detail": "scope is not marked for a shipped runner: rin-gates"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-harness",
          "detail": "scope is not marked for a shipped runner: rin-harness"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-ops",
          "detail": "scope is not marked for a shipped runner: rin-ops"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-retired",
          "detail": "scope is not marked for a shipped runner: rin-retired"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-unit",
          "detail": "scope is not marked for a shipped runner: rin-unit"
        }
      ]
    }
  },
  {
    "name": "Rin stage prerequisites unavailable",
    "context": {
      "modelInvocation": "native-default",
      "harness": "kiro",
      "directory": ".kiro",
      "invocation": "bun .kiro/tools/aidlc.ts",
      "rulesSubdir": "steering",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "stage",
        "slug": "rin-gate-0-reconcile"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-1-framing"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-2-plan-review"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-3-interface-lock"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-4-implement"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-5-review-cycle"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-6-operate"
      }
    ],
    "response": [
      {
        "key": "stage:rin-gate-0-reconcile",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-0-reconcile"
      },
      {
        "key": "stage:rin-gate-1-framing",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-1-framing"
      },
      {
        "key": "stage:rin-gate-2-plan-review",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-2-plan-review"
      },
      {
        "key": "stage:rin-gate-3-interface-lock",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-3-interface-lock"
      },
      {
        "key": "stage:rin-gate-4-implement",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-4-implement"
      },
      {
        "key": "stage:rin-gate-5-review-cycle",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-5-review-cycle"
      },
      {
        "key": "stage:rin-gate-6-operate",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-6-operate"
      }
    ],
    "expected": {
      "status": "invalid",
      "findings": [
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-0-reconcile",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-0-reconcile"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-1-framing",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-1-framing"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-2-plan-review",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-2-plan-review"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-3-interface-lock",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-3-interface-lock"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-4-implement",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-4-implement"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-5-review-cycle",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-5-review-cycle"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-6-operate",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-6-operate"
        }
      ]
    }
  },
  {
    "name": "Rin scopes are not opted into runner generation",
    "context": {
      "modelInvocation": "native-default",
      "harness": "kiro-ide",
      "directory": ".kiro",
      "invocation": "bun .kiro/tools/aidlc.ts",
      "rulesSubdir": "steering",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "scope",
        "scope": "rin-audit"
      },
      {
        "kind": "scope",
        "scope": "rin-bugfix"
      },
      {
        "kind": "scope",
        "scope": "rin-dep-bump"
      },
      {
        "kind": "scope",
        "scope": "rin-gates"
      },
      {
        "kind": "scope",
        "scope": "rin-harness"
      },
      {
        "kind": "scope",
        "scope": "rin-ops"
      },
      {
        "kind": "scope",
        "scope": "rin-retired"
      },
      {
        "kind": "scope",
        "scope": "rin-unit"
      }
    ],
    "response": [
      {
        "key": "scope:rin-audit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-audit"
      },
      {
        "key": "scope:rin-bugfix",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-bugfix"
      },
      {
        "key": "scope:rin-dep-bump",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-dep-bump"
      },
      {
        "key": "scope:rin-gates",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-gates"
      },
      {
        "key": "scope:rin-harness",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-harness"
      },
      {
        "key": "scope:rin-ops",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-ops"
      },
      {
        "key": "scope:rin-retired",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-retired"
      },
      {
        "key": "scope:rin-unit",
        "status": "unavailable",
        "detail": "scope is not marked for a shipped runner: rin-unit"
      }
    ],
    "expected": {
      "status": "invalid",
      "findings": [
        {
          "code": "capability-gap",
          "subject": "scope:rin-audit",
          "detail": "scope is not marked for a shipped runner: rin-audit"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-bugfix",
          "detail": "scope is not marked for a shipped runner: rin-bugfix"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-dep-bump",
          "detail": "scope is not marked for a shipped runner: rin-dep-bump"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-gates",
          "detail": "scope is not marked for a shipped runner: rin-gates"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-harness",
          "detail": "scope is not marked for a shipped runner: rin-harness"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-ops",
          "detail": "scope is not marked for a shipped runner: rin-ops"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-retired",
          "detail": "scope is not marked for a shipped runner: rin-retired"
        },
        {
          "code": "capability-gap",
          "subject": "scope:rin-unit",
          "detail": "scope is not marked for a shipped runner: rin-unit"
        }
      ]
    }
  },
  {
    "name": "Rin stage prerequisites unavailable",
    "context": {
      "modelInvocation": "native-default",
      "harness": "kiro-ide",
      "directory": ".kiro",
      "invocation": "bun .kiro/tools/aidlc.ts",
      "rulesSubdir": "steering",
      "memoryRoot": "aidlc/spaces/default/memory"
    },
    "compiler": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": "core/tools/aidlc-runner-gen.ts"
    },
    "requests": [
      {
        "kind": "stage",
        "slug": "rin-gate-0-reconcile"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-1-framing"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-2-plan-review"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-3-interface-lock"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-4-implement"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-5-review-cycle"
      },
      {
        "kind": "stage",
        "slug": "rin-gate-6-operate"
      }
    ],
    "response": [
      {
        "key": "stage:rin-gate-0-reconcile",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-0-reconcile"
      },
      {
        "key": "stage:rin-gate-1-framing",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-1-framing"
      },
      {
        "key": "stage:rin-gate-2-plan-review",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-2-plan-review"
      },
      {
        "key": "stage:rin-gate-3-interface-lock",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-3-interface-lock"
      },
      {
        "key": "stage:rin-gate-4-implement",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-4-implement"
      },
      {
        "key": "stage:rin-gate-5-review-cycle",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-5-review-cycle"
      },
      {
        "key": "stage:rin-gate-6-operate",
        "status": "unavailable",
        "detail": "stage is absent from the runnable compiled graph: rin-gate-6-operate"
      }
    ],
    "expected": {
      "status": "invalid",
      "findings": [
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-0-reconcile",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-0-reconcile"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-1-framing",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-1-framing"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-2-plan-review",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-2-plan-review"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-3-interface-lock",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-3-interface-lock"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-4-implement",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-4-implement"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-5-review-cycle",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-5-review-cycle"
        },
        {
          "code": "capability-gap",
          "subject": "stage:rin-gate-6-operate",
          "detail": "stage is absent from the runnable compiled graph: rin-gate-6-operate"
        }
      ]
    }
  }
];
