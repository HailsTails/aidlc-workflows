import { runnerSourceCases } from "./runner-source-cases.ts";
import { pluginRunnerSourceCases } from "./plugin-runner-source-cases.ts";
import { rinRunnerSourceCases } from "./rin-runner-source-cases.ts";
const core = runnerSourceCases.map((entry) => ({ ...entry, definition: "core", expectedDefinitions: entry.requests.map((request) => ({ request, owner: { kind: "core", id: "framework" } })) }));
const plugins = pluginRunnerSourceCases.map((entry) => ({ ...entry, definition: "test-pro", expectedDefinitions: entry.requests.map((request) => ({ request, owner: { kind: "plugin", id: "test-pro" } })) }));
const rin = rinRunnerSourceCases.map((entry) => ({ ...entry, definition: "rin", expectedDefinitions: entry.requests.map((request) => ({ request, owner: { kind: "plugin", id: "rin" } })) }));
export const runnerCompositionCases = [...core, ...plugins, ...rin].map((entry) => ({ ...entry, replies: entry.compiled.map((runner) => ({ status: "ok", owner: runner.owner, key: runner.request.kind === "stage" ? `stage:${runner.request.slug}` : runner.request.kind === "scope" ? `scope:${runner.request.scope}` : runner.request.kind, markdown: runner.markdown })) }));
