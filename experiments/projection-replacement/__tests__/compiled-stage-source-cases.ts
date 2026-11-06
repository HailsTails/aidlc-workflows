import type{SourceOrigin,SourceBasis}from"../src/domain/source-origin.ts";
import type{HarnessBinding}from"../src/domain/harness-binding.ts";
import type{CompiledAgentStageCatalogue}from"../src/domain/compiled-agent-stages.ts";
type CompiledStageSourceCase={readonly input:{readonly text:string;readonly artifact:SourceOrigin;readonly binding:HarnessBinding;readonly sources:readonly SourceBasis[]};readonly expected:CompiledAgentStageCatalogue};
export const reviewerCompiledCase:CompiledStageSourceCase={
  "input": {
    "text": "[\n  {\n    \"slug\": \"workspace-scaffold\",\n    \"number\": \"0.1\",\n    \"name\": \"Workspace Scaffold\",\n    \"phase\": \"initialization\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Ensure-exists the per-intent record and in-scope phase dirs, idempotent (creates on demand, skips existing)\",\n    \"lead_agent\": \"orchestrator\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [],\n    \"consumes\": [],\n    \"requires_stage\": [],\n    \"sensors\": [],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"infra\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"inputs\": \"none (first stage after session start)\",\n    \"outputs\": \"the per-intent record tree (one dir per in-scope phase + verification dir) and the space-level knowledge/ dir\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      }\n    ],\n    \"sensors_applicable\": []\n  },\n  {\n    \"slug\": \"workspace-detection\",\n    \"number\": \"0.2\",\n    \"name\": \"Workspace Detection\",\n    \"phase\": \"initialization\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Scans and classifies workspace — auto-proceeds (no approval gate)\",\n    \"lead_agent\": \"orchestrator\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [],\n    \"consumes\": [],\n    \"requires_stage\": [\n      \"workspace-scaffold\"\n    ],\n    \"sensors\": [],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"infra\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"inputs\": \"none (scans filesystem)\",\n    \"outputs\": \"workspace classification (greenfield/brownfield), technology stack detection\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      }\n    ],\n    \"sensors_applicable\": []\n  },\n  {\n    \"slug\": \"state-init\",\n    \"number\": \"0.3\",\n    \"name\": \"State Initialization\",\n    \"phase\": \"initialization\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Creates full populated state file and determines routing — auto-proceeds\",\n    \"lead_agent\": \"orchestrator\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [],\n    \"consumes\": [],\n    \"requires_stage\": [\n      \"workspace-detection\"\n    ],\n    \"sensors\": [],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"infra\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"inputs\": \"workspace classification from workspace-detection, scope from orchestrator\",\n    \"outputs\": \"<record>/aidlc-state.md (full populated version, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      }\n    ],\n    \"sensors_applicable\": []\n  },\n  {\n    \"slug\": \"intent-capture\",\n    \"number\": \"1.1\",\n    \"name\": \"Intent Capture & Framing\",\n    \"phase\": \"ideation\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"First stage of every workflow — establishes the initiative's foundation\",\n    \"lead_agent\": \"aidlc-product-agent\",\n    \"support_agents\": [\n      \"aidlc-architect-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"intent-statement\",\n      \"stakeholder-map\",\n      \"intent-capture-questions\"\n    ],\n    \"consumes\": [],\n    \"requires_stage\": [],\n    \"sensors\": [\n      \"claim-sources\",\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\"\n    ],\n    \"reviewer\": \"aidlc-product-lead-agent\",\n    \"review_artifact\": \"intent-statement\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Authoritative project description (project-description utility), scope selection\",\n    \"outputs\": \"intent-statement.md, stakeholder-map.md, intent-capture-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"claim-sources\",\n        \"path\": \".aidlc/sensors/aidlc-claim-sources.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-provenance\",\n        \"matches\": \"**/{aidlc-docs,intents}/**\"\n      },\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"market-research\",\n    \"number\": \"1.2\",\n    \"name\": \"Market Research\",\n    \"phase\": \"ideation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when initiative has external market positioning or build-vs-buy considerations. Skip for internal tools, bug fixes, or refactors.\",\n    \"lead_agent\": \"aidlc-product-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"competitive-analysis\",\n      \"market-trends\",\n      \"build-vs-buy\",\n      \"market-research-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"intent-capture\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Intent statement from intent-capture stage\",\n    \"outputs\": \"competitive-analysis.md, market-trends.md, build-vs-buy.md, market-research-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"feasibility\",\n    \"number\": \"1.3\",\n    \"name\": \"Feasibility & Constraints\",\n    \"phase\": \"ideation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when there are integration constraints, regulatory requirements, or significant technical uncertainty. Skip for trivial changes with no technical risk.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-aws-platform-agent\",\n      \"aidlc-compliance-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"feasibility-assessment\",\n      \"constraint-register\",\n      \"raid-log\",\n      \"feasibility-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"competitive-analysis\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"market-trends\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"build-vs-buy\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"intent-capture\",\n      \"market-research\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Intent statement from intent-capture stage, market research from market-research stage (if executed)\",\n    \"outputs\": \"feasibility-assessment.md, constraint-register.md, raid-log.md, feasibility-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"scope-definition\",\n    \"number\": \"1.4\",\n    \"name\": \"Scope Definition\",\n    \"phase\": \"ideation\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes — defines the scope boundary and prioritized backlog\",\n    \"lead_agent\": \"aidlc-product-agent\",\n    \"support_agents\": [\n      \"aidlc-delivery-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"scope-document\",\n      \"intent-backlog\",\n      \"scope-definition-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"feasibility-assessment\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"constraint-register\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"intent-capture\",\n      \"feasibility\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Intent statement, feasibility assessment, constraint register\",\n    \"outputs\": \"scope-document.md, intent-backlog.md, scope-definition-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"team-formation\",\n    \"number\": \"1.5\",\n    \"name\": \"Team Formation\",\n    \"phase\": \"ideation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when team composition, capacity, or mob planning is relevant. Skip for solo developer or small team projects.\",\n    \"lead_agent\": \"aidlc-delivery-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"team-assessment\",\n      \"skill-matrix\",\n      \"mob-composition\",\n      \"team-formation-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"scope-document\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"intent-backlog\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"feasibility-assessment\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"scope-definition\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Scope definition, intent backlog, feasibility assessment\",\n    \"outputs\": \"team-assessment.md, skill-matrix.md, mob-composition.md, team-formation-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"rough-mockups\",\n    \"number\": \"1.6\",\n    \"name\": \"Rough Mockups\",\n    \"phase\": \"ideation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when user-facing UI is part of the initiative; for API/backend, produce system interaction diagrams. Skip for non-UI, API-only, or infrastructure-only initiatives.\",\n    \"lead_agent\": \"aidlc-design-agent\",\n    \"support_agents\": [\n      \"aidlc-product-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"wireframes\",\n      \"user-flow\",\n      \"rough-mockups-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scope-document\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"intent-backlog\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"scope-definition\",\n      \"team-formation\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\"\n    ],\n    \"reviewer\": \"aidlc-product-lead-agent\",\n    \"review_artifact\": \"wireframes\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Intent statement, scope definition, intent backlog\",\n    \"outputs\": \"wireframes.md, user-flow.md, rough-mockups-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"approval-handoff\",\n    \"number\": \"1.7\",\n    \"name\": \"Approval & Handoff\",\n    \"phase\": \"ideation\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes — compiles all Ideation artifacts into initiative brief for approval\",\n    \"lead_agent\": \"aidlc-delivery-agent\",\n    \"support_agents\": [\n      \"aidlc-product-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"initiative-brief\",\n      \"decision-log\",\n      \"approval-handoff-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"stakeholder-map\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scope-document\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"intent-backlog\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"competitive-analysis\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"feasibility-assessment\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"constraint-register\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"team-assessment\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"wireframes\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"intent-capture\",\n      \"feasibility\",\n      \"scope-definition\",\n      \"team-formation\",\n      \"rough-mockups\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"All Ideation phase artifacts (intent, market research, feasibility, scope, team, mockups)\",\n    \"outputs\": \"initiative-brief.md, decision-log.md, approval-handoff-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"reverse-engineering\",\n    \"number\": \"2.1\",\n    \"name\": \"Reverse Engineering\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when project is brownfield. On rerun the Step 1 guard checks store freshness (codekb-scope-diff) - verified-CURRENT stores may be reused by human choice, anything else rescans. Skip for greenfield projects.\",\n    \"lead_agent\": \"aidlc-developer-agent\",\n    \"support_agents\": [\n      \"aidlc-architect-agent\"\n    ],\n    \"mode\": \"pipeline\",\n    \"produces\": [\n      \"business-overview\",\n      \"architecture\",\n      \"code-structure\",\n      \"api-documentation\",\n      \"component-inventory\",\n      \"technology-stack\",\n      \"dependencies\",\n      \"code-quality-assessment\",\n      \"reverse-engineering-timestamp\"\n    ],\n    \"consumes\": [],\n    \"requires_stage\": [\n      \"state-init\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"inputs\": \"<record>/aidlc-state.md\",\n    \"outputs\": \"aidlc/spaces/<active-space>/codekb/<repo>/ (9 artifacts: business-overview.md, architecture.md, code-structure.md, api-documentation.md, component-inventory.md, technology-stack.md, dependencies.md, code-quality-assessment.md, reverse-engineering-timestamp.md)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"practices-discovery\",\n    \"number\": \"2.2\",\n    \"name\": \"Practices Discovery\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Always rerun for freshness. Brownfield discovers from evidence + reverse-engineering artifacts. Greenfield prompts user via structured questions using org.md defaults.\",\n    \"lead_agent\": \"aidlc-pipeline-deploy-agent\",\n    \"support_agents\": [\n      \"aidlc-quality-agent\",\n      \"aidlc-developer-agent\",\n      \"aidlc-devsecops-agent\"\n    ],\n    \"mode\": \"subagent\",\n    \"produces\": [\n      \"team-practices\",\n      \"discovered-rules\",\n      \"evidence\",\n      \"practices-discovery-timestamp\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"code-structure\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"technology-stack\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"dependencies\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"code-quality-assessment\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"architecture\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"business-overview\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      }\n    ],\n    \"requires_stage\": [\n      \"state-init\",\n      \"reverse-engineering\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"infra\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"<record>/aidlc-state.md + (brownfield) reverse-engineering evidence\",\n    \"outputs\": \"team-practices.md, discovered-rules.md, evidence.md, practices-discovery-timestamp.md, plus one contribution file per support agent. On affirmation, content is promoted to aidlc/spaces/<active-space>/memory/team.md and project.md.\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"requirements-analysis\",\n    \"number\": \"2.3\",\n    \"name\": \"Requirements Analysis\",\n    \"phase\": \"inception\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes — depth scales with project complexity\",\n    \"lead_agent\": \"aidlc-product-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"requirements\",\n      \"requirements-analysis-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"scope-document\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"business-overview\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"architecture\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"code-structure\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"team-practices\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"approval-handoff\",\n      \"reverse-engineering\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"infra\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"reviewer\": \"aidlc-product-lead-agent\",\n    \"review_artifact\": \"requirements\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"RE artifacts (if brownfield), authoritative project description (project-description utility)\",\n    \"outputs\": \"requirements.md, requirements-analysis-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"user-stories\",\n    \"number\": \"2.4\",\n    \"name\": \"User Stories\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when user-facing features, multiple personas, complex business logic, or cross-team work is involved. Skip for pure refactoring, isolated bug fixes, infrastructure-only changes, or developer tooling.\",\n    \"lead_agent\": \"aidlc-product-agent\",\n    \"support_agents\": [\n      \"aidlc-design-agent\",\n      \"aidlc-developer-agent\",\n      \"aidlc-quality-agent\"\n    ],\n    \"mode\": \"mob\",\n    \"produces\": [\n      \"stories\",\n      \"personas\",\n      \"user-stories-assessment\",\n      \"traceability\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"business-overview\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"component-inventory\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"team-practices\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"requirements-analysis\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-product-lead-agent\",\n    \"review_artifact\": \"stories\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"<record>/inception/requirements-analysis/requirements.md, RE artifacts (if brownfield)\",\n    \"outputs\": \"stories.md, personas.md, user-stories-assessment.md, traceability.json (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".aidlc/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"refined-mockups\",\n    \"number\": \"2.5\",\n    \"name\": \"Refined Mockups\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when user-facing UI exists and rough mockups were produced in Ideation; for APIs, refine interaction diagrams\",\n    \"lead_agent\": \"aidlc-design-agent\",\n    \"support_agents\": [\n      \"aidlc-product-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"mockups\",\n      \"interaction-spec\",\n      \"design-system-mapping\",\n      \"accessibility-checklist\",\n      \"refined-mockups-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"wireframes\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"user-flow\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"stories\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"team-practices\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"user-stories\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-product-lead-agent\",\n    \"review_artifact\": \"mockups\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Rough mockups from rough-mockups stage, user stories from user-stories stage, requirements from requirements-analysis stage\",\n    \"outputs\": \"mockups.md, interaction-spec.md, design-system-mapping.md, accessibility-checklist.md, refined-mockups-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"domain-design\",\n    \"number\": \"2.6\",\n    \"name\": \"Domain Design\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when new components or logical building blocks are needed. Skip when changes are modifications to existing components only.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-aws-platform-agent\",\n      \"aidlc-design-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"components\",\n      \"decisions\",\n      \"traceability\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"stories\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"architecture\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"component-inventory\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"team-practices\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"requirements-analysis\",\n      \"refined-mockups\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"components\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"<record>/inception/requirements-analysis/requirements.md, <record>/inception/user-stories/stories.md (if produced), RE artifacts (if brownfield)\",\n    \"outputs\": \"components.md (fenced ```yaml component catalogue plus a human-readable mermaid diagram and summary table), decisions.md (Architecture Decision Records), and traceability.json — all under this stage's record dir, engine-resolved\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".aidlc/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"units-generation\",\n    \"number\": \"2.7\",\n    \"name\": \"Units Generation\",\n    \"phase\": \"inception\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes when in scope. Produces the dependency DAG that Stage 2.9 Delivery Planning consumes for Bolt sequencing. In the compiled scope grid, 2.7 (Units Generation) and 2.9 (Delivery Planning) travel together — both EXECUTE or both SKIP per scope.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-delivery-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"unit-of-work\",\n      \"unit-of-work-dependency\",\n      \"unit-of-work-story-map\",\n      \"traceability\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"components\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"decisions\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"stories\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"domain-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"unit-of-work\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"<record>/inception/domain-design/components.md, <record>/inception/requirements-analysis/requirements.md, <record>/inception/user-stories/stories.md (if produced)\",\n    \"outputs\": \"unit-of-work.md, unit-of-work-dependency.md, unit-of-work-story-map.md, traceability.json (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".aidlc/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"contract-design\",\n    \"number\": \"2.8\",\n    \"name\": \"Contract Design\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when the system has any formal contract to pin down — an inter-unit boundary (more than one unit that must integrate) OR a unit that exposes a public/external API consumed outside the system. Skip only for a single self-contained unit with no inter-unit boundaries and no externally consumed API.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-aws-platform-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"contract-summary\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"unit-of-work\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-of-work-dependency\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"components\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"contract-summary\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"<record>/inception/units-generation/unit-of-work.md, <record>/inception/units-generation/unit-of-work-dependency.md, <record>/inception/domain-design/components.md (if produced), <record>/inception/requirements-analysis/requirements.md\",\n    \"outputs\": \"contract-summary.md (under this stage's record dir, engine-resolved) — a human-readable overview of every contract (inter-unit boundaries and public/external APIs), each with a fenced spec block (OpenAPI / AsyncAPI / shared schema) inline\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"delivery-planning\",\n    \"number\": \"2.9\",\n    \"name\": \"Delivery Planning\",\n    \"phase\": \"inception\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes — capstone Inception stage, produces the detailed execution plan for Construction and Operation\",\n    \"lead_agent\": \"aidlc-delivery-agent\",\n    \"support_agents\": [\n      \"aidlc-architect-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"bolt-plan\",\n      \"team-allocation\",\n      \"risk-and-sequencing-rationale\",\n      \"external-dependency-map\",\n      \"delivery-planning-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"stories\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"mockups\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"components\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-of-work\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-of-work-dependency\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-of-work-story-map\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"team-practices\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"All Inception artifacts (requirements, stories, mockups, architecture, units)\",\n    \"outputs\": \"bolt-plan.md, team-allocation.md, risk-and-sequencing-rationale.md, external-dependency-map.md, delivery-planning-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"functional-design\",\n    \"number\": \"3.1\",\n    \"name\": \"Functional Design\",\n    \"phase\": \"construction\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"New data models, complex business logic, or business rules need design. Skip if simple logic changes with no new business logic.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-developer-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"for_each\": \"unit-of-work\",\n    \"produces\": [\n      \"entities\",\n      \"rules\",\n      \"functional-spec\",\n      \"traceability\"\n    ],\n    \"optional_produces\": [\n      \"frontend-components\"\n    ],\n    \"produces_kinds\": {\n      \"entities\": [\n        \"service\",\n        \"spec\",\n        \"library\"\n      ],\n      \"rules\": [\n        \"service\",\n        \"spec\",\n        \"library\"\n      ],\n      \"functional-spec\": [\n        \"service\",\n        \"spec\",\n        \"ui\",\n        \"library\"\n      ],\n      \"traceability\": [\n        \"service\",\n        \"spec\",\n        \"ui\",\n        \"library\"\n      ],\n      \"frontend-components\": [\n        \"ui\"\n      ]\n    },\n    \"consumes\": [\n      {\n        \"artifact\": \"unit-of-work\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-of-work-story-map\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"components\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\",\n      \"contract-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"linter\",\n      \"type-check\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"refactor\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"functional-spec\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"adversarial\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"unit-of-work.md, unit-of-work-story-map.md, requirements.md, domain-design components.md, contract-design contract-summary.md (if produced)\",\n    \"outputs\": \"entities.md, rules.md, functional-spec.md, traceability.json, CONDITIONAL: frontend-components.md (under this stage's per-unit record dir, engine-resolved); per-kind applicability via produces_kinds (untagged unit: all). entities.md and rules.md each carry a fenced ```yaml source-of-truth block; functional-spec.md is the source of truth for workflows and state machines and carries derived ER-diagram and rules-summary views.\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".aidlc/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".aidlc/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".aidlc/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"nfr-requirements\",\n    \"number\": \"3.2\",\n    \"name\": \"NFR Requirements\",\n    \"phase\": \"construction\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Performance, security, scalability, reliability, or observability requirements needed, or tech stack selection needed. Skip if no NFR requirements and tech stack already determined.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-devsecops-agent\",\n      \"aidlc-compliance-agent\",\n      \"aidlc-quality-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"for_each\": \"unit-of-work\",\n    \"produces\": [\n      \"performance-requirements\",\n      \"security-requirements\",\n      \"scalability-requirements\",\n      \"reliability-requirements\",\n      \"observability-requirements\",\n      \"tech-stack-decisions\",\n      \"traceability\"\n    ],\n    \"produces_kinds\": {\n      \"performance-requirements\": [\n        \"service\",\n        \"ui\"\n      ],\n      \"scalability-requirements\": [\n        \"service\"\n      ],\n      \"reliability-requirements\": [\n        \"service\"\n      ],\n      \"observability-requirements\": [\n        \"service\"\n      ]\n    },\n    \"consumes\": [\n      {\n        \"artifact\": \"functional-spec\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"rules\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"technology-stack\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\",\n      \"functional-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"linter\",\n      \"type-check\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"infra\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"security-requirements\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"adversarial\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"functional design artifacts, requirements.md, RE artifacts\",\n    \"outputs\": \"performance-requirements.md, security-requirements.md, scalability-requirements.md, reliability-requirements.md, observability-requirements.md, tech-stack-decisions.md, traceability.json (under this stage's per-unit record dir, engine-resolved); per-kind applicability via produces_kinds (untagged unit: all)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".aidlc/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".aidlc/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".aidlc/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"nfr-design\",\n    \"number\": \"3.3\",\n    \"name\": \"NFR Design\",\n    \"phase\": \"construction\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"NFR Requirements was executed and NFR patterns need design. Skip if NFR Requirements was skipped.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-aws-platform-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"for_each\": \"unit-of-work\",\n    \"produces\": [\n      \"performance-design\",\n      \"security-design\",\n      \"scalability-design\",\n      \"reliability-design\",\n      \"observability-design\",\n      \"logical-components\",\n      \"traceability\"\n    ],\n    \"produces_kinds\": {\n      \"performance-design\": [\n        \"service\",\n        \"ui\"\n      ],\n      \"scalability-design\": [\n        \"service\"\n      ],\n      \"reliability-design\": [\n        \"service\"\n      ],\n      \"observability-design\": [\n        \"service\"\n      ],\n      \"logical-components\": [\n        \"service\",\n        \"ui\",\n        \"library\"\n      ]\n    },\n    \"consumes\": [\n      {\n        \"artifact\": \"performance-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"security-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scalability-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"reliability-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"observability-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"tech-stack-decisions\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"functional-spec\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\",\n      \"nfr-requirements\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"linter\",\n      \"type-check\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"infra\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"security-design\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"adversarial\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"NFR requirements artifacts, functional design artifacts\",\n    \"outputs\": \"performance-design.md, security-design.md, scalability-design.md, reliability-design.md, observability-design.md, logical-components.md, traceability.json (under this stage's per-unit record dir, engine-resolved); per-kind applicability via produces_kinds (untagged unit: all)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".aidlc/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".aidlc/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".aidlc/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"infrastructure-design\",\n    \"number\": \"3.4\",\n    \"name\": \"Infrastructure Design\",\n    \"phase\": \"construction\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Infrastructure services need mapping, deployment architecture required, or cloud resources needed. Skip if no infrastructure changes and infrastructure already defined.\",\n    \"lead_agent\": \"aidlc-aws-platform-agent\",\n    \"support_agents\": [\n      \"aidlc-devsecops-agent\",\n      \"aidlc-compliance-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"for_each\": \"unit-of-work\",\n    \"produces\": [\n      \"infrastructure-specification\",\n      \"monitoring-design\",\n      \"cicd-pipeline\",\n      \"traceability\"\n    ],\n    \"produces_kinds\": {\n      \"infrastructure-specification\": [\n        \"service\",\n        \"ui\",\n        \"packaging\"\n      ],\n      \"monitoring-design\": [\n        \"service\",\n        \"ui\",\n        \"packaging\"\n      ],\n      \"cicd-pipeline\": [\n        \"service\",\n        \"ui\",\n        \"packaging\",\n        \"library\"\n      ],\n      \"traceability\": [\n        \"service\",\n        \"ui\",\n        \"packaging\",\n        \"library\"\n      ]\n    },\n    \"consumes\": [\n      {\n        \"artifact\": \"performance-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"security-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scalability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"reliability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"observability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"logical-components\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"components\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"functional-spec\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\",\n      \"nfr-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"linter\",\n      \"type-check\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"infra\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"cicd-pipeline\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"adversarial\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"NFR design artifacts, domain design components.md, functional design\",\n    \"outputs\": \"infrastructure-specification.md (deployment + services + shared, tabular), monitoring-design.md (tabular), cicd-pipeline.md, traceability.json (under this stage's per-unit record dir, engine-resolved); per-kind applicability via produces_kinds (a spec unit owes none)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".aidlc/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".aidlc/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".aidlc/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"code-generation\",\n    \"number\": \"3.5\",\n    \"name\": \"Code Generation\",\n    \"phase\": \"construction\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes for every unit in the execution plan.\",\n    \"lead_agent\": \"aidlc-developer-agent\",\n    \"support_agents\": [],\n    \"mode\": \"subagent\",\n    \"for_each\": \"unit-of-work\",\n    \"workspace_requires\": true,\n    \"produces\": [\n      \"code-generation-plan\",\n      \"unit-test-instructions\",\n      \"code-summary\",\n      \"traceability\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"functional-spec\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"rules\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"entities\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"performance-design\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"security-design\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"infrastructure-specification\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"unit-of-work\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\",\n      \"functional-design\",\n      \"nfr-requirements\",\n      \"nfr-design\",\n      \"infrastructure-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"code-generation-plan\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"adversarial\",\n    \"inputs\": \"ALL prior design artifacts for this unit\",\n    \"outputs\": \"application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved; the engine writes code-generation-questions.md)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".aidlc/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"build-and-test\",\n    \"number\": \"3.6\",\n    \"name\": \"Build and Test\",\n    \"phase\": \"construction\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes once after all per-unit stages are finished.\",\n    \"lead_agent\": \"aidlc-quality-agent\",\n    \"support_agents\": [\n      \"aidlc-devsecops-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"build-instructions\",\n      \"integration-test-instructions\",\n      \"performance-test-instructions\",\n      \"security-test-instructions\",\n      \"build-and-test-summary\",\n      \"build-test-results\",\n      \"cross-unit-traceability\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"code-generation-plan\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-test-instructions\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"code-summary\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"code-generation\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"type-check\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"inputs\": \"ALL code generation outputs across all units\",\n    \"outputs\": \"build-instructions.md, integration-test-instructions.md, performance-test-instructions.md, security-test-instructions.md, build-and-test-summary.md, test-results.md, cross-unit-traceability.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".aidlc/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"ci-pipeline\",\n    \"number\": \"3.7\",\n    \"name\": \"CI Pipeline\",\n    \"phase\": \"construction\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when CI pipeline needs creation or significant modification. Skip if CI already exists and is adequate.\",\n    \"lead_agent\": \"aidlc-pipeline-deploy-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"ci-config\",\n      \"quality-gates\",\n      \"ci-pipeline-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"code-summary\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"build-and-test-summary\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"build-test-results\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"build-and-test\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"linter\",\n      \"type-check\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"infra\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Code generation output from code-generation stage, build/test results from build-and-test stage\",\n    \"outputs\": \"ci-config.md, quality-gates.md, ci-pipeline-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".aidlc/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".aidlc/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"deployment-pipeline\",\n    \"number\": \"4.1\",\n    \"name\": \"Deployment Pipeline\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when CD pipeline needs creation or significant modification\",\n    \"lead_agent\": \"aidlc-pipeline-deploy-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"cd-config\",\n      \"deployment-strategy\",\n      \"rollback-runbook\",\n      \"deployment-pipeline-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"ci-config\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"quality-gates\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"infrastructure-specification\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"cicd-pipeline\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"ci-pipeline\",\n      \"infrastructure-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"infra\",\n      \"bugfix\",\n      \"refactor\",\n      \"security-patch\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"CI pipeline config from ci-pipeline stage, infrastructure design from infrastructure-design stage\",\n    \"outputs\": \"cd-config.md, deployment-strategy.md, rollback-runbook.md, deployment-pipeline-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"environment-provisioning\",\n    \"number\": \"4.2\",\n    \"name\": \"Environment Provisioning\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when AWS environments need provisioning or validation\",\n    \"lead_agent\": \"aidlc-aws-platform-agent\",\n    \"support_agents\": [\n      \"aidlc-devsecops-agent\",\n      \"aidlc-compliance-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"environment-inventory\",\n      \"validation-report\",\n      \"environment-provisioning-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"infrastructure-specification\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"cd-config\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"infrastructure-design\",\n      \"deployment-pipeline\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"infra\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Infrastructure design from infrastructure-design stage, CD pipeline config from deployment-pipeline stage\",\n    \"outputs\": \"environment-inventory.md, validation-report.md, environment-provisioning-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"deployment-execution\",\n    \"number\": \"4.3\",\n    \"name\": \"Deployment Execution\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute after deployment pipeline and environment are ready\",\n    \"lead_agent\": \"aidlc-pipeline-deploy-agent\",\n    \"support_agents\": [\n      \"aidlc-developer-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"deployment-log\",\n      \"smoke-test-results\",\n      \"health-check-report\",\n      \"deployment-execution-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"cd-config\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"deployment-strategy\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"environment-inventory\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"build-test-results\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"deployment-pipeline\",\n      \"environment-provisioning\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"infra\",\n      \"bugfix\",\n      \"refactor\",\n      \"security-patch\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"CD pipeline config from deployment-pipeline stage, provisioned environments from environment-provisioning stage, built artifacts from Construction\",\n    \"outputs\": \"deployment-log.md, smoke-test-results.md, health-check-report.md, deployment-execution-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"observability-setup\",\n    \"number\": \"4.4\",\n    \"name\": \"Observability Setup\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when monitoring, dashboards, alarms, or tracing need configuration\",\n    \"lead_agent\": \"aidlc-operations-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"dashboards\",\n      \"alarms\",\n      \"slo-config\",\n      \"log-queries\",\n      \"tracing-config\",\n      \"anomaly-config\",\n      \"observability-setup-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"performance-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"security-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"reliability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"monitoring-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"infrastructure-specification\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"nfr-design\",\n      \"infrastructure-design\",\n      \"deployment-execution\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"infra\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"NFR design from nfr-design stage, infrastructure design from infrastructure-design stage, deployed application\",\n    \"outputs\": \"dashboards.md, alarms.md, slo-config.md, log-queries.md, tracing-config.md, anomaly-config.md, observability-setup-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"incident-response\",\n    \"number\": \"4.5\",\n    \"name\": \"Incident Response\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when operational runbooks and incident response procedures are needed\",\n    \"lead_agent\": \"aidlc-operations-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"runbooks\",\n      \"incident-plan\",\n      \"escalation-matrix\",\n      \"incident-response-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"dashboards\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"alarms\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"reliability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"security-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"infrastructure-specification\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"observability-setup\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Observability setup from observability-setup stage, NFR design from nfr-design stage, infrastructure design from infrastructure-design stage\",\n    \"outputs\": \"runbooks.md, incident-plan.md, escalation-matrix.md, incident-response-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"performance-validation\",\n    \"number\": \"4.6\",\n    \"name\": \"Performance Validation\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when NFR performance targets need validation under load\",\n    \"lead_agent\": \"aidlc-quality-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"load-test-plan\",\n      \"load-test-results\",\n      \"nfr-validation-matrix\",\n      \"performance-validation-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"performance-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scalability-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"performance-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scalability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"dashboards\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"nfr-requirements\",\n      \"nfr-design\",\n      \"observability-setup\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"NFR requirements from nfr-requirements stage, NFR design from nfr-design stage, deployed application, observability data from observability-setup stage\",\n    \"outputs\": \"load-test-plan.md, test-results.md, nfr-validation-matrix.md, performance-validation-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"feedback-optimization\",\n    \"number\": \"4.7\",\n    \"name\": \"Feedback & Optimization\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when ongoing operational monitoring and optimization are needed\",\n    \"lead_agent\": \"aidlc-operations-agent\",\n    \"support_agents\": [\n      \"aidlc-aws-platform-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"slo-report\",\n      \"cost-analysis\",\n      \"drift-report\",\n      \"feedback-loop\",\n      \"feedback-optimization-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"dashboards\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"alarms\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"slo-config\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"deployment-log\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"load-test-results\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"incident-plan\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"observability-setup\",\n      \"deployment-execution\",\n      \"incident-response\",\n      \"performance-validation\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"All Operation phase artifacts, production monitoring data\",\n    \"outputs\": \"slo-report.md, cost-analysis.md, drift-report.md, feedback-loop.md, feedback-optimization-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".aidlc/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".aidlc/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  }\n]\n",
    "artifact": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": ".aidlc/tools/data/stage-graph.json"
    },
    "binding": {
      "harness": "opencode",
      "directory": ".aidlc"
    },
    "sources": [
      {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
      }
    ]
  },
  "expected": {
    "artifact": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": ".aidlc/tools/data/stage-graph.json"
    },
    "sources": [
      {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
      }
    ],
    "stages": [
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "workspace-scaffold",
        "mode": "inline",
        "lead": "orchestrator",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "workspace-detection",
        "mode": "inline",
        "lead": "orchestrator",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "state-init",
        "mode": "inline",
        "lead": "orchestrator",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "intent-capture",
        "mode": "inline",
        "lead": "aidlc-product-agent",
        "supports": [
          "aidlc-architect-agent"
        ],
        "reviewer": "aidlc-product-lead-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "market-research",
        "mode": "inline",
        "lead": "aidlc-product-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "feasibility",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-aws-platform-agent",
          "aidlc-compliance-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "scope-definition",
        "mode": "inline",
        "lead": "aidlc-product-agent",
        "supports": [
          "aidlc-delivery-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "team-formation",
        "mode": "inline",
        "lead": "aidlc-delivery-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "rough-mockups",
        "mode": "inline",
        "lead": "aidlc-design-agent",
        "supports": [
          "aidlc-product-agent"
        ],
        "reviewer": "aidlc-product-lead-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "approval-handoff",
        "mode": "inline",
        "lead": "aidlc-delivery-agent",
        "supports": [
          "aidlc-product-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "reverse-engineering",
        "mode": "pipeline",
        "lead": "aidlc-developer-agent",
        "supports": [
          "aidlc-architect-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "practices-discovery",
        "mode": "subagent",
        "lead": "aidlc-pipeline-deploy-agent",
        "supports": [
          "aidlc-quality-agent",
          "aidlc-developer-agent",
          "aidlc-devsecops-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "requirements-analysis",
        "mode": "inline",
        "lead": "aidlc-product-agent",
        "supports": [],
        "reviewer": "aidlc-product-lead-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "user-stories",
        "mode": "mob",
        "lead": "aidlc-product-agent",
        "supports": [
          "aidlc-design-agent",
          "aidlc-developer-agent",
          "aidlc-quality-agent"
        ],
        "reviewer": "aidlc-product-lead-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "refined-mockups",
        "mode": "inline",
        "lead": "aidlc-design-agent",
        "supports": [
          "aidlc-product-agent"
        ],
        "reviewer": "aidlc-product-lead-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "domain-design",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-aws-platform-agent",
          "aidlc-design-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "units-generation",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-delivery-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "contract-design",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-aws-platform-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "delivery-planning",
        "mode": "inline",
        "lead": "aidlc-delivery-agent",
        "supports": [
          "aidlc-architect-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "functional-design",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-developer-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "nfr-requirements",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-devsecops-agent",
          "aidlc-compliance-agent",
          "aidlc-quality-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "nfr-design",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-aws-platform-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "infrastructure-design",
        "mode": "inline",
        "lead": "aidlc-aws-platform-agent",
        "supports": [
          "aidlc-devsecops-agent",
          "aidlc-compliance-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "code-generation",
        "mode": "subagent",
        "lead": "aidlc-developer-agent",
        "supports": [],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "build-and-test",
        "mode": "inline",
        "lead": "aidlc-quality-agent",
        "supports": [
          "aidlc-devsecops-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "ci-pipeline",
        "mode": "inline",
        "lead": "aidlc-pipeline-deploy-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "deployment-pipeline",
        "mode": "inline",
        "lead": "aidlc-pipeline-deploy-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "environment-provisioning",
        "mode": "inline",
        "lead": "aidlc-aws-platform-agent",
        "supports": [
          "aidlc-devsecops-agent",
          "aidlc-compliance-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "deployment-execution",
        "mode": "inline",
        "lead": "aidlc-pipeline-deploy-agent",
        "supports": [
          "aidlc-developer-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "observability-setup",
        "mode": "inline",
        "lead": "aidlc-operations-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "incident-response",
        "mode": "inline",
        "lead": "aidlc-operations-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "performance-validation",
        "mode": "inline",
        "lead": "aidlc-quality-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".aidlc/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "feedback-optimization",
        "mode": "inline",
        "lead": "aidlc-operations-agent",
        "supports": [
          "aidlc-aws-platform-agent"
        ],
        "reviewer": null
      }
    ]
  }
};
export const rinCompiledCase:CompiledStageSourceCase={
  "input": {
    "text": "[\n  {\n    \"slug\": \"workspace-scaffold\",\n    \"number\": \"0.1\",\n    \"name\": \"Workspace Scaffold\",\n    \"phase\": \"initialization\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Ensure-exists the per-intent record and in-scope phase dirs, idempotent (creates on demand, skips existing)\",\n    \"lead_agent\": \"orchestrator\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [],\n    \"consumes\": [],\n    \"requires_stage\": [],\n    \"sensors\": [],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"infra\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"inputs\": \"none (first stage after session start)\",\n    \"outputs\": \"the per-intent record tree (one dir per in-scope phase + verification dir) and the space-level knowledge/ dir\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      }\n    ],\n    \"sensors_applicable\": []\n  },\n  {\n    \"slug\": \"workspace-detection\",\n    \"number\": \"0.2\",\n    \"name\": \"Workspace Detection\",\n    \"phase\": \"initialization\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Scans and classifies workspace — auto-proceeds (no approval gate)\",\n    \"lead_agent\": \"orchestrator\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [],\n    \"consumes\": [],\n    \"requires_stage\": [\n      \"workspace-scaffold\"\n    ],\n    \"sensors\": [],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"infra\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"inputs\": \"none (scans filesystem)\",\n    \"outputs\": \"workspace classification (greenfield/brownfield), technology stack detection\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      }\n    ],\n    \"sensors_applicable\": []\n  },\n  {\n    \"slug\": \"state-init\",\n    \"number\": \"0.3\",\n    \"name\": \"State Initialization\",\n    \"phase\": \"initialization\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Creates full populated state file and determines routing — auto-proceeds\",\n    \"lead_agent\": \"orchestrator\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [],\n    \"consumes\": [],\n    \"requires_stage\": [\n      \"workspace-detection\"\n    ],\n    \"sensors\": [],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"infra\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"inputs\": \"workspace classification from workspace-detection, scope from orchestrator\",\n    \"outputs\": \"<record>/aidlc-state.md (full populated version, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      }\n    ],\n    \"sensors_applicable\": []\n  },\n  {\n    \"slug\": \"intent-capture\",\n    \"number\": \"1.1\",\n    \"name\": \"Intent Capture & Framing\",\n    \"phase\": \"ideation\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"First stage of every workflow — establishes the initiative's foundation\",\n    \"lead_agent\": \"aidlc-product-agent\",\n    \"support_agents\": [\n      \"aidlc-architect-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"intent-statement\",\n      \"stakeholder-map\",\n      \"intent-capture-questions\"\n    ],\n    \"consumes\": [],\n    \"requires_stage\": [],\n    \"sensors\": [\n      \"claim-sources\",\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\"\n    ],\n    \"reviewer\": \"aidlc-product-lead-agent\",\n    \"review_artifact\": \"intent-statement\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Authoritative project description (project-description utility), scope selection\",\n    \"outputs\": \"intent-statement.md, stakeholder-map.md, intent-capture-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"claim-sources\",\n        \"path\": \".claude/sensors/aidlc-claim-sources.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-provenance\",\n        \"matches\": \"**/{aidlc-docs,intents}/**\"\n      },\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"market-research\",\n    \"number\": \"1.2\",\n    \"name\": \"Market Research\",\n    \"phase\": \"ideation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when initiative has external market positioning or build-vs-buy considerations. Skip for internal tools, bug fixes, or refactors.\",\n    \"lead_agent\": \"aidlc-product-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"competitive-analysis\",\n      \"market-trends\",\n      \"build-vs-buy\",\n      \"market-research-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"intent-capture\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Intent statement from intent-capture stage\",\n    \"outputs\": \"competitive-analysis.md, market-trends.md, build-vs-buy.md, market-research-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"feasibility\",\n    \"number\": \"1.3\",\n    \"name\": \"Feasibility & Constraints\",\n    \"phase\": \"ideation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when there are integration constraints, regulatory requirements, or significant technical uncertainty. Skip for trivial changes with no technical risk.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-aws-platform-agent\",\n      \"aidlc-compliance-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"feasibility-assessment\",\n      \"constraint-register\",\n      \"raid-log\",\n      \"feasibility-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"competitive-analysis\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"market-trends\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"build-vs-buy\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"intent-capture\",\n      \"market-research\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Intent statement from intent-capture stage, market research from market-research stage (if executed)\",\n    \"outputs\": \"feasibility-assessment.md, constraint-register.md, raid-log.md, feasibility-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"scope-definition\",\n    \"number\": \"1.4\",\n    \"name\": \"Scope Definition\",\n    \"phase\": \"ideation\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes — defines the scope boundary and prioritized backlog\",\n    \"lead_agent\": \"aidlc-product-agent\",\n    \"support_agents\": [\n      \"aidlc-delivery-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"scope-document\",\n      \"intent-backlog\",\n      \"scope-definition-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"feasibility-assessment\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"constraint-register\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"intent-capture\",\n      \"feasibility\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Intent statement, feasibility assessment, constraint register\",\n    \"outputs\": \"scope-document.md, intent-backlog.md, scope-definition-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"team-formation\",\n    \"number\": \"1.5\",\n    \"name\": \"Team Formation\",\n    \"phase\": \"ideation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when team composition, capacity, or mob planning is relevant. Skip for solo developer or small team projects.\",\n    \"lead_agent\": \"aidlc-delivery-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"team-assessment\",\n      \"skill-matrix\",\n      \"mob-composition\",\n      \"team-formation-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"scope-document\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"intent-backlog\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"feasibility-assessment\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"scope-definition\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Scope definition, intent backlog, feasibility assessment\",\n    \"outputs\": \"team-assessment.md, skill-matrix.md, mob-composition.md, team-formation-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"rough-mockups\",\n    \"number\": \"1.6\",\n    \"name\": \"Rough Mockups\",\n    \"phase\": \"ideation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when user-facing UI is part of the initiative; for API/backend, produce system interaction diagrams. Skip for non-UI, API-only, or infrastructure-only initiatives.\",\n    \"lead_agent\": \"aidlc-design-agent\",\n    \"support_agents\": [\n      \"aidlc-product-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"wireframes\",\n      \"user-flow\",\n      \"rough-mockups-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scope-document\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"intent-backlog\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"scope-definition\",\n      \"team-formation\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\"\n    ],\n    \"reviewer\": \"aidlc-product-lead-agent\",\n    \"review_artifact\": \"wireframes\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Intent statement, scope definition, intent backlog\",\n    \"outputs\": \"wireframes.md, user-flow.md, rough-mockups-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"approval-handoff\",\n    \"number\": \"1.7\",\n    \"name\": \"Approval & Handoff\",\n    \"phase\": \"ideation\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes — compiles all Ideation artifacts into initiative brief for approval\",\n    \"lead_agent\": \"aidlc-delivery-agent\",\n    \"support_agents\": [\n      \"aidlc-product-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"initiative-brief\",\n      \"decision-log\",\n      \"approval-handoff-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"stakeholder-map\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scope-document\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"intent-backlog\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"competitive-analysis\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"feasibility-assessment\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"constraint-register\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"team-assessment\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"wireframes\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"intent-capture\",\n      \"feasibility\",\n      \"scope-definition\",\n      \"team-formation\",\n      \"rough-mockups\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"All Ideation phase artifacts (intent, market research, feasibility, scope, team, mockups)\",\n    \"outputs\": \"initiative-brief.md, decision-log.md, approval-handoff-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/ideation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"reverse-engineering\",\n    \"number\": \"2.1\",\n    \"name\": \"Reverse Engineering\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when project is brownfield. On rerun the Step 1 guard checks store freshness (codekb-scope-diff) - verified-CURRENT stores may be reused by human choice, anything else rescans. Skip for greenfield projects.\",\n    \"lead_agent\": \"aidlc-developer-agent\",\n    \"support_agents\": [\n      \"aidlc-architect-agent\"\n    ],\n    \"mode\": \"pipeline\",\n    \"produces\": [\n      \"business-overview\",\n      \"architecture\",\n      \"code-structure\",\n      \"api-documentation\",\n      \"component-inventory\",\n      \"technology-stack\",\n      \"dependencies\",\n      \"code-quality-assessment\",\n      \"reverse-engineering-timestamp\"\n    ],\n    \"consumes\": [],\n    \"requires_stage\": [\n      \"state-init\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"inputs\": \"<record>/aidlc-state.md\",\n    \"outputs\": \"aidlc/spaces/<active-space>/codekb/<repo>/ (9 artifacts: business-overview.md, architecture.md, code-structure.md, api-documentation.md, component-inventory.md, technology-stack.md, dependencies.md, code-quality-assessment.md, reverse-engineering-timestamp.md)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"practices-discovery\",\n    \"number\": \"2.2\",\n    \"name\": \"Practices Discovery\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Always rerun for freshness. Brownfield discovers from evidence + reverse-engineering artifacts. Greenfield prompts user via structured questions using org.md defaults.\",\n    \"lead_agent\": \"aidlc-pipeline-deploy-agent\",\n    \"support_agents\": [\n      \"aidlc-quality-agent\",\n      \"aidlc-developer-agent\",\n      \"aidlc-devsecops-agent\"\n    ],\n    \"mode\": \"subagent\",\n    \"produces\": [\n      \"team-practices\",\n      \"discovered-rules\",\n      \"evidence\",\n      \"practices-discovery-timestamp\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"code-structure\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"technology-stack\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"dependencies\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"code-quality-assessment\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"architecture\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"business-overview\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      }\n    ],\n    \"requires_stage\": [\n      \"state-init\",\n      \"reverse-engineering\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"infra\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"<record>/aidlc-state.md + (brownfield) reverse-engineering evidence\",\n    \"outputs\": \"team-practices.md, discovered-rules.md, evidence.md, practices-discovery-timestamp.md, plus one contribution file per support agent. On affirmation, content is promoted to aidlc/spaces/<active-space>/memory/team.md and project.md.\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"requirements-analysis\",\n    \"number\": \"2.3\",\n    \"name\": \"Requirements Analysis\",\n    \"phase\": \"inception\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes — depth scales with project complexity\",\n    \"lead_agent\": \"aidlc-product-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"requirements\",\n      \"requirements-analysis-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"intent-statement\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"scope-document\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"business-overview\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"architecture\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"code-structure\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"team-practices\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"approval-handoff\",\n      \"reverse-engineering\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"infra\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"reviewer\": \"aidlc-product-lead-agent\",\n    \"review_artifact\": \"requirements\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"RE artifacts (if brownfield), authoritative project description (project-description utility)\",\n    \"outputs\": \"requirements.md, requirements-analysis-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"user-stories\",\n    \"number\": \"2.4\",\n    \"name\": \"User Stories\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when user-facing features, multiple personas, complex business logic, or cross-team work is involved. Skip for pure refactoring, isolated bug fixes, infrastructure-only changes, or developer tooling.\",\n    \"lead_agent\": \"aidlc-product-agent\",\n    \"support_agents\": [\n      \"aidlc-design-agent\",\n      \"aidlc-developer-agent\",\n      \"aidlc-quality-agent\"\n    ],\n    \"mode\": \"mob\",\n    \"produces\": [\n      \"stories\",\n      \"personas\",\n      \"user-stories-assessment\",\n      \"traceability\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"business-overview\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"component-inventory\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"team-practices\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"requirements-analysis\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-product-lead-agent\",\n    \"review_artifact\": \"stories\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"<record>/inception/requirements-analysis/requirements.md, RE artifacts (if brownfield)\",\n    \"outputs\": \"stories.md, personas.md, user-stories-assessment.md, traceability.json (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".claude/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"refined-mockups\",\n    \"number\": \"2.5\",\n    \"name\": \"Refined Mockups\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when user-facing UI exists and rough mockups were produced in Ideation; for APIs, refine interaction diagrams\",\n    \"lead_agent\": \"aidlc-design-agent\",\n    \"support_agents\": [\n      \"aidlc-product-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"mockups\",\n      \"interaction-spec\",\n      \"design-system-mapping\",\n      \"accessibility-checklist\",\n      \"refined-mockups-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"wireframes\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"user-flow\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"stories\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"team-practices\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"user-stories\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-product-lead-agent\",\n    \"review_artifact\": \"mockups\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Rough mockups from rough-mockups stage, user stories from user-stories stage, requirements from requirements-analysis stage\",\n    \"outputs\": \"mockups.md, interaction-spec.md, design-system-mapping.md, accessibility-checklist.md, refined-mockups-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"domain-design\",\n    \"number\": \"2.6\",\n    \"name\": \"Domain Design\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when new components or logical building blocks are needed. Skip when changes are modifications to existing components only.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-aws-platform-agent\",\n      \"aidlc-design-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"components\",\n      \"decisions\",\n      \"traceability\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"stories\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"architecture\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"component-inventory\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      },\n      {\n        \"artifact\": \"team-practices\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"requirements-analysis\",\n      \"refined-mockups\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"components\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"<record>/inception/requirements-analysis/requirements.md, <record>/inception/user-stories/stories.md (if produced), RE artifacts (if brownfield)\",\n    \"outputs\": \"components.md (fenced ```yaml component catalogue plus a human-readable mermaid diagram and summary table), decisions.md (Architecture Decision Records), and traceability.json — all under this stage's record dir, engine-resolved\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".claude/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"units-generation\",\n    \"number\": \"2.7\",\n    \"name\": \"Units Generation\",\n    \"phase\": \"inception\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes when in scope. Produces the dependency DAG that Stage 2.9 Delivery Planning consumes for Bolt sequencing. In the compiled scope grid, 2.7 (Units Generation) and 2.9 (Delivery Planning) travel together — both EXECUTE or both SKIP per scope.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-delivery-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"unit-of-work\",\n      \"unit-of-work-dependency\",\n      \"unit-of-work-story-map\",\n      \"traceability\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"components\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"decisions\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"stories\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"domain-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"unit-of-work\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"<record>/inception/domain-design/components.md, <record>/inception/requirements-analysis/requirements.md, <record>/inception/user-stories/stories.md (if produced)\",\n    \"outputs\": \"unit-of-work.md, unit-of-work-dependency.md, unit-of-work-story-map.md, traceability.json (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".claude/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"contract-design\",\n    \"number\": \"2.8\",\n    \"name\": \"Contract Design\",\n    \"phase\": \"inception\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when the system has any formal contract to pin down — an inter-unit boundary (more than one unit that must integrate) OR a unit that exposes a public/external API consumed outside the system. Skip only for a single self-contained unit with no inter-unit boundaries and no externally consumed API.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-aws-platform-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"contract-summary\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"unit-of-work\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-of-work-dependency\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"components\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"contract-summary\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"advisory\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"<record>/inception/units-generation/unit-of-work.md, <record>/inception/units-generation/unit-of-work-dependency.md, <record>/inception/domain-design/components.md (if produced), <record>/inception/requirements-analysis/requirements.md\",\n    \"outputs\": \"contract-summary.md (under this stage's record dir, engine-resolved) — a human-readable overview of every contract (inter-unit boundaries and public/external APIs), each with a fenced spec block (OpenAPI / AsyncAPI / shared schema) inline\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"delivery-planning\",\n    \"number\": \"2.9\",\n    \"name\": \"Delivery Planning\",\n    \"phase\": \"inception\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes — capstone Inception stage, produces the detailed execution plan for Construction and Operation\",\n    \"lead_agent\": \"aidlc-delivery-agent\",\n    \"support_agents\": [\n      \"aidlc-architect-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"bolt-plan\",\n      \"team-allocation\",\n      \"risk-and-sequencing-rationale\",\n      \"external-dependency-map\",\n      \"delivery-planning-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"stories\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"mockups\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"components\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-of-work\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-of-work-dependency\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-of-work-story-map\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"team-practices\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"All Inception artifacts (requirements, stories, mockups, architecture, units)\",\n    \"outputs\": \"bolt-plan.md, team-allocation.md, risk-and-sequencing-rationale.md, external-dependency-map.md, delivery-planning-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"rin-gate-0-reconcile\",\n    \"number\": \"2.10\",\n    \"name\": \"Gate 0 — Reconcile\",\n    \"plugin\": \"rin\",\n    \"phase\": \"inception\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"First gate of the rin pipeline. Promotes an eligible consumer intake capture into a native engine intent record, reconciles it and any prior spec residue against deterministic ground truth, then confirms it is ready to frame. Grooms; does not frame (Gate 1), does not choose a solution (Gate 2) and does not design one (Gate 3).\",\n    \"lead_agent\": \"rin-delivery-agent\",\n    \"support_agents\": [\n      \"rin-product-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"rin-reconcile-report\",\n      \"rin-readiness-verdict\"\n    ],\n    \"consumes\": [],\n    \"requires_stage\": [],\n    \"sensors\": [\n      \"required-sections\",\n      \"dd-1\",\n      \"dd-2\",\n      \"dd-7\"\n    ],\n    \"scopes\": [\n      \"rin-gates\",\n      \"rin-harness\",\n      \"rin-audit\"\n    ],\n    \"reviewer\": \"rin-stage-reviewer-agent\",\n    \"review_artifact\": \"rin-reconcile-report\",\n    \"reviewer_max_iterations\": 2,\n    \"approval_mode\": \"autonomous\",\n    \"review_class\": \"adversarial\",\n    \"inputs\": \"The target work — an eligible consumer intake capture to promote, or an existing engine intent record to reconcile — plus any prior spec/artifact residue for it\",\n    \"outputs\": \"rin-reconcile-report.md (the coherence sweep + ground-truth verdicts + the promotion applied) and rin-readiness-verdict.md (Gate-0 PASS/HOLD), under this stage's record dir, engine-resolved\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"dd-1\",\n        \"path\": \".claude/sensors/aidlc-dd-1.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-2\",\n        \"path\": \".claude/sensors/aidlc-dd-2.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-7\",\n        \"path\": \".claude/sensors/aidlc-dd-7.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"rin-gate-1-framing\",\n    \"number\": \"2.20\",\n    \"name\": \"Gate 1 — Framing\",\n    \"plugin\": \"rin\",\n    \"phase\": \"inception\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, settles them with its seats, and writes back confirmed scope directly into the AIDLC requirements artefact. The seats and the lead draft the framing together. Prose only; no solution is chosen here (Gate 2).\",\n    \"lead_agent\": \"rin-product-agent\",\n    \"support_agents\": [\n      \"rin-architect-agent\",\n      \"rin-developer-agent\",\n      \"rin-customer-seat-agent\"\n    ],\n    \"mode\": \"mob\",\n    \"produces\": [\n      \"rin-requirements\",\n      \"rin-framing-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"rin-reconcile-report\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"rin-readiness-verdict\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"rin-gate-0-reconcile\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"dd-1\",\n      \"dd-2\",\n      \"dd-7\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"rin-gates\"\n    ],\n    \"reviewer\": \"rin-decorrelated-review-agent\",\n    \"review_artifact\": \"rin-requirements\",\n    \"reviewer_max_iterations\": 2,\n    \"approval_mode\": \"autonomous\",\n    \"review_class\": \"adversarial\",\n    \"inputs\": \"The Gate-0 reconcile report + readiness verdict, and the target Slice's intent\",\n    \"outputs\": \"rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions, each with the gate's answer and its source, or its stopping class and pack, and the disposition of every seat objection), under this stage's record dir, engine-resolved\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"dd-1\",\n        \"path\": \".claude/sensors/aidlc-dd-1.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-2\",\n        \"path\": \".claude/sensors/aidlc-dd-2.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-7\",\n        \"path\": \".claude/sensors/aidlc-dd-7.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"rin-gate-2-plan-review\",\n    \"number\": \"2.30\",\n    \"name\": \"Gate 2 — Solution Options\",\n    \"plugin\": \"rin\",\n    \"phase\": \"inception\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Third gate of the rin pipeline. Answers \\\"which solution, among genuinely different ones, and why\\\". Names each decision point, enumerates genuinely different solution shapes for it, writes each candidate's premises as facts.md keys, compares the candidates on the rows that separate them, and records the choice inline in the options ledger with a reason for every rejected candidate. Prose and diagrams only; contracts belong to Gate 3.\",\n    \"lead_agent\": \"rin-architect-agent\",\n    \"support_agents\": [\n      \"rin-developer-agent\",\n      \"rin-quality-agent\",\n      \"rin-challenger-agent\",\n      \"rin-customer-seat-agent\"\n    ],\n    \"mode\": \"mob\",\n    \"produces\": [\n      \"rin-solution-options\",\n      \"rin-options-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"rin-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"rin-framing-questions\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"rin-gate-1-framing\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"dd-1\",\n      \"dd-2\",\n      \"dd-7\",\n      \"upstream-coverage\",\n      \"framing-only\",\n      \"solution-options\"\n    ],\n    \"scopes\": [\n      \"rin-gates\"\n    ],\n    \"reviewer\": \"rin-decorrelated-review-agent\",\n    \"review_artifact\": \"rin-solution-options\",\n    \"reviewer_max_iterations\": 2,\n    \"approval_mode\": \"autonomous\",\n    \"review_class\": \"adversarial\",\n    \"inputs\": \"The Gate-1 requirements artefact, and the answered framing questions where the record holds them\",\n    \"outputs\": \"rin-solution-options.md (the options ledger — decision points, candidates with their premises, the comparison, and the decision on each point) and rin-options-questions.md (the entry-read citation, the lead's leaning on each point, and the disposition of every seat objection), under this stage's record dir, engine-resolved\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"dd-1\",\n        \"path\": \".claude/sensors/aidlc-dd-1.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-2\",\n        \"path\": \".claude/sensors/aidlc-dd-2.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-7\",\n        \"path\": \".claude/sensors/aidlc-dd-7.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"framing-only\",\n        \"path\": \".claude/sensors/aidlc-framing-only.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"blocking\",\n        \"category\": \"framing\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"solution-options\",\n        \"path\": \".claude/sensors/aidlc-solution-options.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"blocking\",\n        \"category\": \"design-options\",\n        \"matches\": \"**/intents/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"rin-gate-3-interface-lock\",\n    \"number\": \"2.40\",\n    \"name\": \"Gate 3 — Detailed Solution Design\",\n    \"plugin\": \"rin\",\n    \"phase\": \"inception\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Fourth gate of the rin pipeline and the inception→construction boundary. Answers \\\"what exactly are we building, measured against reality\\\". Measures the chosen solution's premises and every other external fact first, then designs the domain model, components and exact contracts of the solution Gate 2 chose, with every contract element specified and every external fact it relies on measured. Its `report --result approved` audit event (GATE_APPROVED) is the proof construction's entry check reads.\",\n    \"lead_agent\": \"rin-architect-agent\",\n    \"support_agents\": [\n      \"rin-developer-agent\",\n      \"rin-quality-agent\",\n      \"rin-customer-seat-agent\"\n    ],\n    \"mode\": \"mob\",\n    \"produces\": [\n      \"rin-components\",\n      \"rin-interface-lock\",\n      \"rin-design-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"rin-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"rin-solution-options\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"rin-gate-2-plan-review\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"dd-1\",\n      \"dd-2\",\n      \"dd-7\",\n      \"upstream-coverage\",\n      \"measured-contracts\"\n    ],\n    \"scopes\": [\n      \"rin-unit\",\n      \"rin-gates\"\n    ],\n    \"reviewer\": \"rin-decorrelated-review-agent\",\n    \"review_artifact\": \"rin-interface-lock\",\n    \"reviewer_max_iterations\": 2,\n    \"approval_mode\": \"autonomous\",\n    \"review_class\": \"adversarial\",\n    \"inputs\": \"The Gate-2 options ledger (see \\\"Inputs, and why the ledger is declared optional\\\"), the record's facts.md, and the Gate-1 requirements\",\n    \"outputs\": \"rin-components.md (the domain model, components, units and their dependencies), rin-interface-lock.md (the exact contracts, the External reality section, and the single Constitution Check) and rin-design-questions.md (the gate's decision record: the calls it made in a decided class to specify a lock element, and the disposition of every seat objection), under this stage's record dir, engine-resolved. The gate is AIDLC-native (ordered walk + approval), proven by the engine's own `report --result approved` audit event; no `.gate-lock` marker file.\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/inception.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"dd-1\",\n        \"path\": \".claude/sensors/aidlc-dd-1.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-2\",\n        \"path\": \".claude/sensors/aidlc-dd-2.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-7\",\n        \"path\": \".claude/sensors/aidlc-dd-7.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"measured-contracts\",\n        \"path\": \".claude/sensors/aidlc-measured-contracts.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"blocking\",\n        \"category\": \"design-options\",\n        \"matches\": \"**/rin-interface-lock.md\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"functional-design\",\n    \"number\": \"3.1\",\n    \"name\": \"Functional Design\",\n    \"phase\": \"construction\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"New data models, complex business logic, or business rules need design. Skip if simple logic changes with no new business logic.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-developer-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"for_each\": \"unit-of-work\",\n    \"produces\": [\n      \"entities\",\n      \"rules\",\n      \"functional-spec\",\n      \"traceability\"\n    ],\n    \"optional_produces\": [\n      \"frontend-components\"\n    ],\n    \"produces_kinds\": {\n      \"entities\": [\n        \"service\",\n        \"spec\",\n        \"library\"\n      ],\n      \"rules\": [\n        \"service\",\n        \"spec\",\n        \"library\"\n      ],\n      \"functional-spec\": [\n        \"service\",\n        \"spec\",\n        \"ui\",\n        \"library\"\n      ],\n      \"traceability\": [\n        \"service\",\n        \"spec\",\n        \"ui\",\n        \"library\"\n      ],\n      \"frontend-components\": [\n        \"ui\"\n      ]\n    },\n    \"consumes\": [\n      {\n        \"artifact\": \"unit-of-work\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-of-work-story-map\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"components\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\",\n      \"contract-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"linter\",\n      \"type-check\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"refactor\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"functional-spec\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"adversarial\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"unit-of-work.md, unit-of-work-story-map.md, requirements.md, domain-design components.md, contract-design contract-summary.md (if produced)\",\n    \"outputs\": \"entities.md, rules.md, functional-spec.md, traceability.json, CONDITIONAL: frontend-components.md (under this stage's per-unit record dir, engine-resolved); per-kind applicability via produces_kinds (untagged unit: all). entities.md and rules.md each carry a fenced ```yaml source-of-truth block; functional-spec.md is the source of truth for workflows and state machines and carries derived ER-diagram and rules-summary views.\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".claude/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".claude/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".claude/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"nfr-requirements\",\n    \"number\": \"3.2\",\n    \"name\": \"NFR Requirements\",\n    \"phase\": \"construction\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Performance, security, scalability, reliability, or observability requirements needed, or tech stack selection needed. Skip if no NFR requirements and tech stack already determined.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-devsecops-agent\",\n      \"aidlc-compliance-agent\",\n      \"aidlc-quality-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"for_each\": \"unit-of-work\",\n    \"produces\": [\n      \"performance-requirements\",\n      \"security-requirements\",\n      \"scalability-requirements\",\n      \"reliability-requirements\",\n      \"observability-requirements\",\n      \"tech-stack-decisions\",\n      \"traceability\"\n    ],\n    \"produces_kinds\": {\n      \"performance-requirements\": [\n        \"service\",\n        \"ui\"\n      ],\n      \"scalability-requirements\": [\n        \"service\"\n      ],\n      \"reliability-requirements\": [\n        \"service\"\n      ],\n      \"observability-requirements\": [\n        \"service\"\n      ]\n    },\n    \"consumes\": [\n      {\n        \"artifact\": \"functional-spec\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"rules\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"technology-stack\",\n        \"required\": false,\n        \"conditional_on\": \"brownfield\"\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\",\n      \"functional-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"linter\",\n      \"type-check\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"infra\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"security-requirements\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"adversarial\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"functional design artifacts, requirements.md, RE artifacts\",\n    \"outputs\": \"performance-requirements.md, security-requirements.md, scalability-requirements.md, reliability-requirements.md, observability-requirements.md, tech-stack-decisions.md, traceability.json (under this stage's per-unit record dir, engine-resolved); per-kind applicability via produces_kinds (untagged unit: all)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".claude/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".claude/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".claude/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"nfr-design\",\n    \"number\": \"3.3\",\n    \"name\": \"NFR Design\",\n    \"phase\": \"construction\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"NFR Requirements was executed and NFR patterns need design. Skip if NFR Requirements was skipped.\",\n    \"lead_agent\": \"aidlc-architect-agent\",\n    \"support_agents\": [\n      \"aidlc-aws-platform-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"for_each\": \"unit-of-work\",\n    \"produces\": [\n      \"performance-design\",\n      \"security-design\",\n      \"scalability-design\",\n      \"reliability-design\",\n      \"observability-design\",\n      \"logical-components\",\n      \"traceability\"\n    ],\n    \"produces_kinds\": {\n      \"performance-design\": [\n        \"service\",\n        \"ui\"\n      ],\n      \"scalability-design\": [\n        \"service\"\n      ],\n      \"reliability-design\": [\n        \"service\"\n      ],\n      \"observability-design\": [\n        \"service\"\n      ],\n      \"logical-components\": [\n        \"service\",\n        \"ui\",\n        \"library\"\n      ]\n    },\n    \"consumes\": [\n      {\n        \"artifact\": \"performance-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"security-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scalability-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"reliability-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"observability-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"tech-stack-decisions\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"functional-spec\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\",\n      \"nfr-requirements\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"linter\",\n      \"type-check\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"infra\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"security-design\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"adversarial\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"NFR requirements artifacts, functional design artifacts\",\n    \"outputs\": \"performance-design.md, security-design.md, scalability-design.md, reliability-design.md, observability-design.md, logical-components.md, traceability.json (under this stage's per-unit record dir, engine-resolved); per-kind applicability via produces_kinds (untagged unit: all)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".claude/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".claude/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".claude/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"infrastructure-design\",\n    \"number\": \"3.4\",\n    \"name\": \"Infrastructure Design\",\n    \"phase\": \"construction\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Infrastructure services need mapping, deployment architecture required, or cloud resources needed. Skip if no infrastructure changes and infrastructure already defined.\",\n    \"lead_agent\": \"aidlc-aws-platform-agent\",\n    \"support_agents\": [\n      \"aidlc-devsecops-agent\",\n      \"aidlc-compliance-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"for_each\": \"unit-of-work\",\n    \"produces\": [\n      \"infrastructure-specification\",\n      \"monitoring-design\",\n      \"cicd-pipeline\",\n      \"traceability\"\n    ],\n    \"produces_kinds\": {\n      \"infrastructure-specification\": [\n        \"service\",\n        \"ui\",\n        \"packaging\"\n      ],\n      \"monitoring-design\": [\n        \"service\",\n        \"ui\",\n        \"packaging\"\n      ],\n      \"cicd-pipeline\": [\n        \"service\",\n        \"ui\",\n        \"packaging\",\n        \"library\"\n      ],\n      \"traceability\": [\n        \"service\",\n        \"ui\",\n        \"packaging\",\n        \"library\"\n      ]\n    },\n    \"consumes\": [\n      {\n        \"artifact\": \"performance-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"security-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scalability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"reliability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"observability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"logical-components\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"components\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"functional-spec\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\",\n      \"nfr-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"linter\",\n      \"type-check\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"infra\",\n      \"classic\",\n      \"workshop\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"cicd-pipeline\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"adversarial\",\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"NFR design artifacts, domain design components.md, functional design\",\n    \"outputs\": \"infrastructure-specification.md (deployment + services + shared, tabular), monitoring-design.md (tabular), cicd-pipeline.md, traceability.json (under this stage's per-unit record dir, engine-resolved); per-kind applicability via produces_kinds (a spec unit owes none)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".claude/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".claude/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".claude/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"code-generation\",\n    \"number\": \"3.5\",\n    \"name\": \"Code Generation\",\n    \"phase\": \"construction\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes for every unit in the execution plan.\",\n    \"lead_agent\": \"aidlc-developer-agent\",\n    \"support_agents\": [],\n    \"mode\": \"subagent\",\n    \"for_each\": \"unit-of-work\",\n    \"workspace_requires\": true,\n    \"produces\": [\n      \"code-generation-plan\",\n      \"unit-test-instructions\",\n      \"code-summary\",\n      \"traceability\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"functional-spec\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"rules\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"entities\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"contract-summary\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"performance-design\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"security-design\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"infrastructure-specification\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"unit-of-work\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"requirements\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"units-generation\",\n      \"functional-design\",\n      \"nfr-requirements\",\n      \"nfr-design\",\n      \"infrastructure-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"traceability\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"reviewer\": \"aidlc-architecture-reviewer-agent\",\n    \"review_artifact\": \"code-generation-plan\",\n    \"reviewer_max_iterations\": 2,\n    \"review_class\": \"adversarial\",\n    \"inputs\": \"ALL prior design artifacts for this unit\",\n    \"outputs\": \"application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved; the engine writes code-generation-questions.md)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"traceability\",\n        \"path\": \".claude/sensors/aidlc-traceability.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-traceability\",\n        \"matches\": \"**/traceability.json\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"build-and-test\",\n    \"number\": \"3.6\",\n    \"name\": \"Build and Test\",\n    \"phase\": \"construction\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Always executes once after all per-unit stages are finished.\",\n    \"lead_agent\": \"aidlc-quality-agent\",\n    \"support_agents\": [\n      \"aidlc-devsecops-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"build-instructions\",\n      \"integration-test-instructions\",\n      \"performance-test-instructions\",\n      \"security-test-instructions\",\n      \"build-and-test-summary\",\n      \"build-test-results\",\n      \"cross-unit-traceability\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"code-generation-plan\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"unit-test-instructions\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"code-summary\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"code-generation\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"type-check\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"poc\",\n      \"bugfix\",\n      \"refactor\",\n      \"security-patch\",\n      \"classic\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"inputs\": \"ALL code generation outputs across all units\",\n    \"outputs\": \"build-instructions.md, integration-test-instructions.md, performance-test-instructions.md, security-test-instructions.md, build-and-test-summary.md, test-results.md, cross-unit-traceability.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".claude/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"ci-pipeline\",\n    \"number\": \"3.7\",\n    \"name\": \"CI Pipeline\",\n    \"phase\": \"construction\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when CI pipeline needs creation or significant modification. Skip if CI already exists and is adequate.\",\n    \"lead_agent\": \"aidlc-pipeline-deploy-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"ci-config\",\n      \"quality-gates\",\n      \"ci-pipeline-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"code-summary\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"build-and-test-summary\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"build-test-results\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"build-and-test\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\",\n      \"linter\",\n      \"type-check\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"mvp\",\n      \"infra\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Code generation output from code-generation stage, build/test results from build-and-test stage\",\n    \"outputs\": \"ci-config.md, quality-gates.md, ci-pipeline-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".claude/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".claude/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"rin-gate-4-implement\",\n    \"number\": \"3.10\",\n    \"name\": \"Gate 4 — Implement\",\n    \"plugin\": \"rin\",\n    \"phase\": \"construction\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Implements the locked Slice test-first (TDD) and runs the committed deterministic gate + constitution supervision, then reports the gate's own `report --result approved` transition — the pre-spec→construction handoff boundary. Entry is gated on the engine's `requires_stage`/`consumes` chain against Gate 3's committed artefacts. Gate 5 (review cycle) owns the merge that follows, not here.\",\n    \"lead_agent\": \"rin-developer-agent\",\n    \"support_agents\": [\n      \"rin-test-seat-agent\",\n      \"rin-build-seat-agent\"\n    ],\n    \"mode\": \"mob\",\n    \"workspace_requires\": true,\n    \"produces\": [\n      \"rin-code-generation-plan\",\n      \"rin-code-summary\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"rin-interface-lock\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"rin-requirements\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"rin-gate-3-interface-lock\"\n    ],\n    \"sensors\": [\n      \"format\",\n      \"linter\",\n      \"type-check\",\n      \"cd-1\",\n      \"cd-2\",\n      \"cd-6\",\n      \"cd-8\",\n      \"cd-14\",\n      \"cd-15\",\n      \"cd-17\",\n      \"cd-19\",\n      \"cd-23\",\n      \"cd-25\",\n      \"cd-26\",\n      \"cd-27\",\n      \"cd-43\",\n      \"cd-44\",\n      \"carve-out-decay\",\n      \"disciplines\",\n      \"dd-1\",\n      \"dd-2\",\n      \"dd-7\"\n    ],\n    \"scopes\": [\n      \"rin-gates\",\n      \"rin-harness\",\n      \"rin-audit\",\n      \"rin-ops\",\n      \"rin-dep-bump\",\n      \"rin-bugfix\",\n      \"rin-unit\"\n    ],\n    \"reviewer\": \"rin-decorrelated-review-agent\",\n    \"review_artifact\": \"rin-code-generation-plan\",\n    \"reviewer_max_iterations\": 2,\n    \"approval_mode\": \"autonomous\",\n    \"review_class\": \"adversarial\",\n    \"inputs\": \"The Gate-3 frozen interface bundle, the requirements (from the approved parent for `rin-unit`), and Gate-3's committed `report --result approved` completion (construction-entry gate)\",\n    \"outputs\": \"application code in the workspace + rin-code-generation-plan.md (the implementation plan — the native replacement for tasks.md) and rin-code-summary.md, under this stage's per-Slice record dir, engine-resolved\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"format\",\n        \"path\": \".claude/sensors/aidlc-format.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css}\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".claude/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".claude/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-1\",\n        \"path\": \".claude/sensors/aidlc-cd-1.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-2\",\n        \"path\": \".claude/sensors/aidlc-cd-2.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-6\",\n        \"path\": \".claude/sensors/aidlc-cd-6.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-8\",\n        \"path\": \".claude/sensors/aidlc-cd-8.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-14\",\n        \"path\": \".claude/sensors/aidlc-cd-14.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-15\",\n        \"path\": \".claude/sensors/aidlc-cd-15.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-17\",\n        \"path\": \".claude/sensors/aidlc-cd-17.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-19\",\n        \"path\": \".claude/sensors/aidlc-cd-19.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-23\",\n        \"path\": \".claude/sensors/aidlc-cd-23.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-25\",\n        \"path\": \".claude/sensors/aidlc-cd-25.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.test.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-26\",\n        \"path\": \".claude/sensors/aidlc-cd-26.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.test.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-27\",\n        \"path\": \".claude/sensors/aidlc-cd-27.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.test.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-43\",\n        \"path\": \".claude/sensors/aidlc-cd-43.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-44\",\n        \"path\": \".claude/sensors/aidlc-cd-44.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"carve-out-decay\",\n        \"path\": \".claude/sensors/aidlc-carve-out-decay.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"disciplines\",\n        \"path\": \".claude/sensors/aidlc-disciplines.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx,mts,cts}\"\n      },\n      {\n        \"id\": \"dd-1\",\n        \"path\": \".claude/sensors/aidlc-dd-1.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-2\",\n        \"path\": \".claude/sensors/aidlc-dd-2.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-7\",\n        \"path\": \".claude/sensors/aidlc-dd-7.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"rin-gate-5-review-cycle\",\n    \"number\": \"3.20\",\n    \"name\": \"Gate 5 — Review Cycle\",\n    \"plugin\": \"rin\",\n    \"phase\": \"construction\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"Final gate of the rin pipeline — the reviewer↔author review round-trip, run as a bounded DECORRELATED cycle inside one stage. A decorrelated review board (the six pr-review hunts + disposition-diff enforcer + intent-defense synthesis) sweeps the PR; NOT-READY routes findings to the author leg (exhaustive disposition table); re-sweep up to the iteration cap. Converges to merged only on APPROVE + zero unresolved atoms + a managed merge ({{MERGE_COMMAND}} under the rails conditions; {{OPERATOR}} holds a standing veto).\",\n    \"lead_agent\": \"rin-developer-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"rin-disposition-table\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"rin-code-generation-plan\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"rin-code-summary\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"rin-gate-4-implement\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"dd-1\",\n      \"dd-2\",\n      \"dd-7\",\n      \"format\",\n      \"linter\",\n      \"type-check\",\n      \"cd-1\",\n      \"cd-2\",\n      \"cd-6\",\n      \"cd-8\",\n      \"cd-14\",\n      \"cd-15\",\n      \"cd-17\",\n      \"cd-19\",\n      \"cd-23\",\n      \"cd-25\",\n      \"cd-26\",\n      \"cd-27\",\n      \"cd-43\",\n      \"cd-44\",\n      \"carve-out-decay\",\n      \"disciplines\"\n    ],\n    \"scopes\": [\n      \"rin-gates\",\n      \"rin-harness\",\n      \"rin-audit\",\n      \"rin-ops\",\n      \"rin-dep-bump\",\n      \"rin-bugfix\",\n      \"rin-unit\"\n    ],\n    \"reviewer\": \"rin-decorrelated-review-agent\",\n    \"review_artifact\": \"rin-disposition-table\",\n    \"reviewer_max_iterations\": 3,\n    \"approval_mode\": \"autonomous\",\n    \"review_class\": \"adversarial\",\n    \"inputs\": \"The Gate-4 implementation (the PR), its rin-code-generation-plan, and Gate 4's committed `report --result approved` audit event (review-entry gate)\",\n    \"outputs\": \"rin-disposition-table.md (the closed-contract disposition of every feedback atom) + this gate's own committed `report --result approved` audit event (recorded only when the round-trip converges), under this stage's record dir, engine-resolved\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/construction.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"dd-1\",\n        \"path\": \".claude/sensors/aidlc-dd-1.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-2\",\n        \"path\": \".claude/sensors/aidlc-dd-2.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-7\",\n        \"path\": \".claude/sensors/aidlc-dd-7.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"format\",\n        \"path\": \".claude/sensors/aidlc-format.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css}\"\n      },\n      {\n        \"id\": \"linter\",\n        \"path\": \".claude/sensors/aidlc-linter.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,js}\"\n      },\n      {\n        \"id\": \"type-check\",\n        \"path\": \".claude/sensors/aidlc-type-check.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"code-quality\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-1\",\n        \"path\": \".claude/sensors/aidlc-cd-1.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-2\",\n        \"path\": \".claude/sensors/aidlc-cd-2.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-6\",\n        \"path\": \".claude/sensors/aidlc-cd-6.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-8\",\n        \"path\": \".claude/sensors/aidlc-cd-8.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-14\",\n        \"path\": \".claude/sensors/aidlc-cd-14.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-15\",\n        \"path\": \".claude/sensors/aidlc-cd-15.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-17\",\n        \"path\": \".claude/sensors/aidlc-cd-17.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-19\",\n        \"path\": \".claude/sensors/aidlc-cd-19.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-23\",\n        \"path\": \".claude/sensors/aidlc-cd-23.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-25\",\n        \"path\": \".claude/sensors/aidlc-cd-25.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.test.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-26\",\n        \"path\": \".claude/sensors/aidlc-cd-26.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.test.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-27\",\n        \"path\": \".claude/sensors/aidlc-cd-27.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.test.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-43\",\n        \"path\": \".claude/sensors/aidlc-cd-43.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"cd-44\",\n        \"path\": \".claude/sensors/aidlc-cd-44.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"carve-out-decay\",\n        \"path\": \".claude/sensors/aidlc-carve-out-decay.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx}\"\n      },\n      {\n        \"id\": \"disciplines\",\n        \"path\": \".claude/sensors/aidlc-disciplines.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"constitution\",\n        \"matches\": \"**/*.{ts,tsx,mts,cts}\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"deployment-pipeline\",\n    \"number\": \"4.1\",\n    \"name\": \"Deployment Pipeline\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when CD pipeline needs creation or significant modification\",\n    \"lead_agent\": \"aidlc-pipeline-deploy-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"cd-config\",\n      \"deployment-strategy\",\n      \"rollback-runbook\",\n      \"deployment-pipeline-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"ci-config\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"quality-gates\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"infrastructure-specification\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"cicd-pipeline\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"ci-pipeline\",\n      \"infrastructure-design\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"infra\",\n      \"bugfix\",\n      \"refactor\",\n      \"security-patch\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"CI pipeline config from ci-pipeline stage, infrastructure design from infrastructure-design stage\",\n    \"outputs\": \"cd-config.md, deployment-strategy.md, rollback-runbook.md, deployment-pipeline-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"environment-provisioning\",\n    \"number\": \"4.2\",\n    \"name\": \"Environment Provisioning\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when AWS environments need provisioning or validation\",\n    \"lead_agent\": \"aidlc-aws-platform-agent\",\n    \"support_agents\": [\n      \"aidlc-devsecops-agent\",\n      \"aidlc-compliance-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"environment-inventory\",\n      \"validation-report\",\n      \"environment-provisioning-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"infrastructure-specification\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"cd-config\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"infrastructure-design\",\n      \"deployment-pipeline\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"infra\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Infrastructure design from infrastructure-design stage, CD pipeline config from deployment-pipeline stage\",\n    \"outputs\": \"environment-inventory.md, validation-report.md, environment-provisioning-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"deployment-execution\",\n    \"number\": \"4.3\",\n    \"name\": \"Deployment Execution\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute after deployment pipeline and environment are ready\",\n    \"lead_agent\": \"aidlc-pipeline-deploy-agent\",\n    \"support_agents\": [\n      \"aidlc-developer-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"deployment-log\",\n      \"smoke-test-results\",\n      \"health-check-report\",\n      \"deployment-execution-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"cd-config\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"deployment-strategy\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"environment-inventory\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"build-test-results\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"deployment-pipeline\",\n      \"environment-provisioning\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"infra\",\n      \"bugfix\",\n      \"refactor\",\n      \"security-patch\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"CD pipeline config from deployment-pipeline stage, provisioned environments from environment-provisioning stage, built artifacts from Construction\",\n    \"outputs\": \"deployment-log.md, smoke-test-results.md, health-check-report.md, deployment-execution-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"observability-setup\",\n    \"number\": \"4.4\",\n    \"name\": \"Observability Setup\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when monitoring, dashboards, alarms, or tracing need configuration\",\n    \"lead_agent\": \"aidlc-operations-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"dashboards\",\n      \"alarms\",\n      \"slo-config\",\n      \"log-queries\",\n      \"tracing-config\",\n      \"anomaly-config\",\n      \"observability-setup-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"performance-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"security-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"reliability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"monitoring-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"infrastructure-specification\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"nfr-design\",\n      \"infrastructure-design\",\n      \"deployment-execution\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"infra\",\n      \"workshop\",\n      \"express\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"NFR design from nfr-design stage, infrastructure design from infrastructure-design stage, deployed application\",\n    \"outputs\": \"dashboards.md, alarms.md, slo-config.md, log-queries.md, tracing-config.md, anomaly-config.md, observability-setup-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"incident-response\",\n    \"number\": \"4.5\",\n    \"name\": \"Incident Response\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when operational runbooks and incident response procedures are needed\",\n    \"lead_agent\": \"aidlc-operations-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"runbooks\",\n      \"incident-plan\",\n      \"escalation-matrix\",\n      \"incident-response-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"dashboards\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"alarms\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"reliability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"security-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"infrastructure-specification\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"observability-setup\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"Observability setup from observability-setup stage, NFR design from nfr-design stage, infrastructure design from infrastructure-design stage\",\n    \"outputs\": \"runbooks.md, incident-plan.md, escalation-matrix.md, incident-response-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"performance-validation\",\n    \"number\": \"4.6\",\n    \"name\": \"Performance Validation\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when NFR performance targets need validation under load\",\n    \"lead_agent\": \"aidlc-quality-agent\",\n    \"support_agents\": [],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"load-test-plan\",\n      \"load-test-results\",\n      \"nfr-validation-matrix\",\n      \"performance-validation-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"performance-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scalability-requirements\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"performance-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"scalability-design\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"dashboards\",\n        \"required\": true\n      }\n    ],\n    \"requires_stage\": [\n      \"nfr-requirements\",\n      \"nfr-design\",\n      \"observability-setup\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"NFR requirements from nfr-requirements stage, NFR design from nfr-design stage, deployed application, observability data from observability-setup stage\",\n    \"outputs\": \"load-test-plan.md, test-results.md, nfr-validation-matrix.md, performance-validation-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"feedback-optimization\",\n    \"number\": \"4.7\",\n    \"name\": \"Feedback & Optimization\",\n    \"phase\": \"operation\",\n    \"execution\": \"CONDITIONAL\",\n    \"condition\": \"Execute when ongoing operational monitoring and optimization are needed\",\n    \"lead_agent\": \"aidlc-operations-agent\",\n    \"support_agents\": [\n      \"aidlc-aws-platform-agent\"\n    ],\n    \"mode\": \"inline\",\n    \"produces\": [\n      \"slo-report\",\n      \"cost-analysis\",\n      \"drift-report\",\n      \"feedback-loop\",\n      \"feedback-optimization-questions\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"dashboards\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"alarms\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"slo-config\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"deployment-log\",\n        \"required\": true\n      },\n      {\n        \"artifact\": \"load-test-results\",\n        \"required\": false\n      },\n      {\n        \"artifact\": \"incident-plan\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"observability-setup\",\n      \"deployment-execution\",\n      \"incident-response\",\n      \"performance-validation\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"upstream-coverage\"\n    ],\n    \"scopes\": [\n      \"enterprise\",\n      \"feature\",\n      \"workshop\"\n    ],\n    \"summary_confirmation\": \"required\",\n    \"inputs\": \"All Operation phase artifacts, production monitoring data\",\n    \"outputs\": \"slo-report.md, cost-analysis.md, drift-report.md, feedback-loop.md, feedback-optimization-questions.md (under this stage's record dir, engine-resolved)\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"upstream-coverage\",\n        \"path\": \".claude/sensors/aidlc-upstream-coverage.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      }\n    ]\n  },\n  {\n    \"slug\": \"rin-gate-6-operate\",\n    \"number\": \"4.10\",\n    \"name\": \"Gate 6 — Operate\",\n    \"plugin\": \"rin\",\n    \"phase\": \"operation\",\n    \"execution\": \"ALWAYS\",\n    \"condition\": \"The operational gate — genuinely missing from the original rin gates, which stop at merge. Deploys the merged Slice, verifies it live (health-checked against the real path, not state-at-rest), wires its monitoring, and closes the bookkeeping (tend-log breadcrumb, scope-routed decisions, backlog reconcile). Converges only when the Slice is provably live AND its record is closed.\",\n    \"lead_agent\": \"rin-operations-agent\",\n    \"support_agents\": [\n      \"rin-pipeline-deploy-agent\",\n      \"rin-delivery-agent\"\n    ],\n    \"mode\": \"mob\",\n    \"produces\": [\n      \"rin-deployment-log\",\n      \"rin-health-check-report\",\n      \"rin-operational-runbook\",\n      \"rin-bookkeeping-close\"\n    ],\n    \"consumes\": [\n      {\n        \"artifact\": \"rin-disposition-table\",\n        \"required\": false\n      }\n    ],\n    \"requires_stage\": [\n      \"rin-gate-5-review-cycle\"\n    ],\n    \"sensors\": [\n      \"required-sections\",\n      \"dd-1\",\n      \"dd-2\",\n      \"dd-7\"\n    ],\n    \"scopes\": [\n      \"rin-gates\",\n      \"rin-ops\",\n      \"rin-unit\"\n    ],\n    \"reviewer\": \"rin-stage-reviewer-agent\",\n    \"review_artifact\": \"rin-bookkeeping-close\",\n    \"reviewer_max_iterations\": 3,\n    \"approval_mode\": \"autonomous\",\n    \"review_class\": \"adversarial\",\n    \"inputs\": \"The merged Slice (its engine record — Current Stage + committed audit event, resolved from the intent record dir) and its disposition table\",\n    \"outputs\": \"rin-deployment-log.md, rin-health-check-report.md (the LIVE-path verification), rin-operational-runbook.md (monitoring + rollback), rin-bookkeeping-close.md (tend-log + decisions + reconcile), and the gate's own completion record (this stage's `report --result approved` + committed audit event — the operational-done fact), under this stage's record dir, engine-resolved\",\n    \"rules_in_context\": [\n      {\n        \"path\": \"aidlc/spaces/default/memory/org.md\",\n        \"scope\": \"org\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/team.md\",\n        \"scope\": \"team\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/project.md\",\n        \"scope\": \"project\"\n      },\n      {\n        \"path\": \"aidlc/spaces/default/memory/phases/operation.md\",\n        \"scope\": \"phase\"\n      }\n    ],\n    \"sensors_applicable\": [\n      {\n        \"id\": \"required-sections\",\n        \"path\": \".claude/sensors/aidlc-required-sections.md\",\n        \"fire_on\": \"gate\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"document-shape\",\n        \"matches\": \"**/{aidlc-docs,intents,codekb}/**\"\n      },\n      {\n        \"id\": \"dd-1\",\n        \"path\": \".claude/sensors/aidlc-dd-1.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-2\",\n        \"path\": \".claude/sensors/aidlc-dd-2.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      },\n      {\n        \"id\": \"dd-7\",\n        \"path\": \".claude/sensors/aidlc-dd-7.md\",\n        \"fire_on\": \"write\",\n        \"default_severity\": \"advisory\",\n        \"category\": \"doc-discipline\",\n        \"matches\": \"**/intents/**\"\n      }\n    ]\n  }\n]\n",
    "artifact": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": ".claude/tools/data/stage-graph.json"
    },
    "binding": {
      "harness": "claude",
      "directory": ".claude"
    },
    "sources": [
      {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
      },
      {
        "source": {
          "kind": "plugin",
          "id": "rin"
        },
        "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
      }
    ]
  },
  "expected": {
    "artifact": {
      "source": {
        "kind": "core",
        "id": "framework"
      },
      "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
      "path": ".claude/tools/data/stage-graph.json"
    },
    "sources": [
      {
        "source": {
          "kind": "core",
          "id": "framework"
        },
        "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
      },
      {
        "source": {
          "kind": "plugin",
          "id": "rin"
        },
        "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
      }
    ],
    "stages": [
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "workspace-scaffold",
        "mode": "inline",
        "lead": "orchestrator",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "workspace-detection",
        "mode": "inline",
        "lead": "orchestrator",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "state-init",
        "mode": "inline",
        "lead": "orchestrator",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "intent-capture",
        "mode": "inline",
        "lead": "aidlc-product-agent",
        "supports": [
          "aidlc-architect-agent"
        ],
        "reviewer": "aidlc-product-lead-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "market-research",
        "mode": "inline",
        "lead": "aidlc-product-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "feasibility",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-aws-platform-agent",
          "aidlc-compliance-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "scope-definition",
        "mode": "inline",
        "lead": "aidlc-product-agent",
        "supports": [
          "aidlc-delivery-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "team-formation",
        "mode": "inline",
        "lead": "aidlc-delivery-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "rough-mockups",
        "mode": "inline",
        "lead": "aidlc-design-agent",
        "supports": [
          "aidlc-product-agent"
        ],
        "reviewer": "aidlc-product-lead-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "approval-handoff",
        "mode": "inline",
        "lead": "aidlc-delivery-agent",
        "supports": [
          "aidlc-product-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "reverse-engineering",
        "mode": "pipeline",
        "lead": "aidlc-developer-agent",
        "supports": [
          "aidlc-architect-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "practices-discovery",
        "mode": "subagent",
        "lead": "aidlc-pipeline-deploy-agent",
        "supports": [
          "aidlc-quality-agent",
          "aidlc-developer-agent",
          "aidlc-devsecops-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "requirements-analysis",
        "mode": "inline",
        "lead": "aidlc-product-agent",
        "supports": [],
        "reviewer": "aidlc-product-lead-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "user-stories",
        "mode": "mob",
        "lead": "aidlc-product-agent",
        "supports": [
          "aidlc-design-agent",
          "aidlc-developer-agent",
          "aidlc-quality-agent"
        ],
        "reviewer": "aidlc-product-lead-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "refined-mockups",
        "mode": "inline",
        "lead": "aidlc-design-agent",
        "supports": [
          "aidlc-product-agent"
        ],
        "reviewer": "aidlc-product-lead-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "domain-design",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-aws-platform-agent",
          "aidlc-design-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "units-generation",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-delivery-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "contract-design",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-aws-platform-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "delivery-planning",
        "mode": "inline",
        "lead": "aidlc-delivery-agent",
        "supports": [
          "aidlc-architect-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "plugin",
              "id": "rin"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "rin-gate-0-reconcile",
        "mode": "inline",
        "lead": "rin-delivery-agent",
        "supports": [
          "rin-product-agent"
        ],
        "reviewer": "rin-stage-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "plugin",
              "id": "rin"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "rin-gate-1-framing",
        "mode": "mob",
        "lead": "rin-product-agent",
        "supports": [
          "rin-architect-agent",
          "rin-developer-agent",
          "rin-customer-seat-agent"
        ],
        "reviewer": "rin-decorrelated-review-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "plugin",
              "id": "rin"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "rin-gate-2-plan-review",
        "mode": "mob",
        "lead": "rin-architect-agent",
        "supports": [
          "rin-developer-agent",
          "rin-quality-agent",
          "rin-challenger-agent",
          "rin-customer-seat-agent"
        ],
        "reviewer": "rin-decorrelated-review-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "plugin",
              "id": "rin"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "rin-gate-3-interface-lock",
        "mode": "mob",
        "lead": "rin-architect-agent",
        "supports": [
          "rin-developer-agent",
          "rin-quality-agent",
          "rin-customer-seat-agent"
        ],
        "reviewer": "rin-decorrelated-review-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "functional-design",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-developer-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "nfr-requirements",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-devsecops-agent",
          "aidlc-compliance-agent",
          "aidlc-quality-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "nfr-design",
        "mode": "inline",
        "lead": "aidlc-architect-agent",
        "supports": [
          "aidlc-aws-platform-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "infrastructure-design",
        "mode": "inline",
        "lead": "aidlc-aws-platform-agent",
        "supports": [
          "aidlc-devsecops-agent",
          "aidlc-compliance-agent"
        ],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "code-generation",
        "mode": "subagent",
        "lead": "aidlc-developer-agent",
        "supports": [],
        "reviewer": "aidlc-architecture-reviewer-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "build-and-test",
        "mode": "inline",
        "lead": "aidlc-quality-agent",
        "supports": [
          "aidlc-devsecops-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "ci-pipeline",
        "mode": "inline",
        "lead": "aidlc-pipeline-deploy-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "plugin",
              "id": "rin"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "rin-gate-4-implement",
        "mode": "mob",
        "lead": "rin-developer-agent",
        "supports": [
          "rin-test-seat-agent",
          "rin-build-seat-agent"
        ],
        "reviewer": "rin-decorrelated-review-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "plugin",
              "id": "rin"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "rin-gate-5-review-cycle",
        "mode": "inline",
        "lead": "rin-developer-agent",
        "supports": [],
        "reviewer": "rin-decorrelated-review-agent"
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "deployment-pipeline",
        "mode": "inline",
        "lead": "aidlc-pipeline-deploy-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "environment-provisioning",
        "mode": "inline",
        "lead": "aidlc-aws-platform-agent",
        "supports": [
          "aidlc-devsecops-agent",
          "aidlc-compliance-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "deployment-execution",
        "mode": "inline",
        "lead": "aidlc-pipeline-deploy-agent",
        "supports": [
          "aidlc-developer-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "observability-setup",
        "mode": "inline",
        "lead": "aidlc-operations-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "incident-response",
        "mode": "inline",
        "lead": "aidlc-operations-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "performance-validation",
        "mode": "inline",
        "lead": "aidlc-quality-agent",
        "supports": [],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "feedback-optimization",
        "mode": "inline",
        "lead": "aidlc-operations-agent",
        "supports": [
          "aidlc-aws-platform-agent"
        ],
        "reviewer": null
      },
      {
        "origin": {
          "kind": "compiled",
          "artifact": {
            "source": {
              "kind": "core",
              "id": "framework"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1",
            "path": ".claude/tools/data/stage-graph.json"
          },
          "definition": {
            "source": {
              "kind": "plugin",
              "id": "rin"
            },
            "pin": "d062c81e5678c9f92162542b425b8a5f095e46e1"
          }
        },
        "slug": "rin-gate-6-operate",
        "mode": "mob",
        "lead": "rin-operations-agent",
        "supports": [
          "rin-pipeline-deploy-agent",
          "rin-delivery-agent"
        ],
        "reviewer": "rin-stage-reviewer-agent"
      }
    ]
  }
};
export const compiledStageSourceCases=[{name:"reviewer",...reviewerCompiledCase},{name:"rin",...rinCompiledCase}];
