import { defaultFileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { afterAll, expect, test } from "bun:test";
import { planWorkflowRefresh } from "../../../core/tools/aidlc-workflow-refresh.ts";
import { stageRefreshComparison } from "../../../core/tools/aidlc-stage-refresh-contract.ts";
import { executePlan, writeOperation, type TransactionPlan } from "../../../core/tools/aidlc-transaction.ts";
import { rinWorkflowRefreshPolicy } from "./refresh-policy.ts";
const files = defaultFileTextPort();
const paths = defaultPathOperations();
const scratch = files.makeTemporaryDirectory(paths.join({ segments: [files.temporaryRoot(), "rin-refresh-contract-"] }));
afterAll(() => files.remove(scratch, { recursive: true, force: true }), 60000);
const put = (args: {
    readonly root: string;
    readonly path: string;
    readonly content: string;
}): void => {
    const file = paths.join({ segments: [args.root, args.path] });
    files.mkdir(paths.dirname({ path: file }), { recursive: true });
    files.write(file, args.content);
};
const stage = { slug: "rin-gate-0-reconcile", plugin: "rin", approval_mode: "autonomous", produces: ["rin-intake"],
    lead_agent: "aidlc-delivery-agent", support_agents: ["aidlc-product-agent"], reviewer: "aidlc-architecture-reviewer-agent" };
const candidate = { ...stage, lead_agent: "rin-delivery-agent", support_agents: ["rin-product-agent"], reviewer: "rin-stage-reviewer-agent" };
const graphPath = ".claude/tools/data/stage-graph.json";
const evidencePath = "aidlc/spaces/default/intents/open/audit.md";
const fixture = (args: {
    readonly name: string;
    readonly changed?: boolean;
}) => {
    const projectDir = paths.join({ segments: [scratch, args.name, "project"] });
    const installedGraph = JSON.stringify([stage]);
    const nextGraph = JSON.stringify([args.changed ? { ...candidate, approval_mode: "explicit" } : candidate]);
    [projectDir].forEach((root) => {
        put({ root, path: ".claude/tools/aidlc-lib.ts", content: 'export const CURRENT_STATE_VERSION = "8";\n' });
        put({ root, path: ".claude/tools/data/scope-grid.json", content: '{"feature":{"stages":{"rin-gate-0-reconcile":"EXECUTE"}}}' });
    });
    put({ root: projectDir, path: graphPath, content: installedGraph });
    put({ root: projectDir, path: "aidlc/spaces/default/intents/open/aidlc-state.md", content: `# State\n- **Status**: Running\n- **Current Stage**: ${stage.slug}\n` });
    put({ root: projectDir, path: evidencePath, content: "Synthetic historical review fixture, not an earned receipt.\n" });
    put({ root: projectDir, path: ".claude/tools/payload.ts", content: "before\n" });
    const plan: TransactionPlan = { schemaVersion: 1, root: projectDir, operations: [
            writeOperation(graphPath, nextGraph), writeOperation(".claude/tools/payload.ts", "after\n"),
        ] };
    return { projectDir, harnessDir: ".claude", plan,
        openWorkflows: [{ workflow: "default/open", currentStage: stage.slug }], installedGraph,
    };
};
test("the actual transaction accepts the closed Rin change only with Rin selected and leaves evidence untouched", () => {
    const args = fixture({ name: "accepted" });
    expect(() => planWorkflowRefresh({ ...args, policy: { id: "fixture-unextended", compareStages: stageRefreshComparison, notes: () => [] } })).toThrow("stage");
    const result = planWorkflowRefresh({ ...args, policy: rinWorkflowRefreshPolicy });
    expect(result.evidence.stageRevalidation).toEqual({ "rin-gate-0-reconcile": ["rin-gate-seats"] });
    expect(result.notes[0]).toContain("it owes a fresh review");
    expect(result.notes[0]).toContain("Open at this stage: default/open.");
    const record = files.read(paths.join({ segments: [args.projectDir, evidencePath] }));
    expect(executePlan(args.plan, result.checks)).toBeUndefined();
    expect(JSON.parse(files.read(paths.join({ segments: [args.projectDir, graphPath] }), "utf8"))).toEqual([candidate]);
    expect(files.read(paths.join({ segments: [args.projectDir, evidencePath] }))).toEqual(record);
});
test("the selected Rin binding refuses an adjacent change instead of converting it into owed work", () => {
    const args = fixture({ name: "unknown", changed: true });
    expect(() => planWorkflowRefresh({ ...args, policy: rinWorkflowRefreshPolicy })).toThrow("stage");
    expect(files.read(paths.join({ segments: [args.projectDir, graphPath] }), "utf8")).toBe(args.installedGraph);
});
test("selected Rin compatibility keeps stale-plan refusal at the real lock", () => {
    const args = fixture({ name: "stale" });
    const result = planWorkflowRefresh({ ...args, policy: rinWorkflowRefreshPolicy });
    put({ root: args.projectDir, path: graphPath, content: `${args.installedGraph}\n` });
    expect(() => executePlan(args.plan, result.checks)).toThrow("changed");
    expect(files.read(paths.join({ segments: [args.projectDir, graphPath] }), "utf8")).toBe(`${args.installedGraph}\n`);
});
test("an interrupted accepted Rin update rolls back without rewriting the historical record", () => {
    const args = fixture({ name: "rollback" });
    const result = planWorkflowRefresh({ ...args, policy: rinWorkflowRefreshPolicy });
    const record = files.read(paths.join({ segments: [args.projectDir, evidencePath] }));
    expect(() => executePlan(args.plan, { ...result.checks, failAfter: 1 })).toThrow("injected transaction failure");
    expect(files.read(paths.join({ segments: [args.projectDir, graphPath] }), "utf8")).toBe(args.installedGraph);
    expect(files.read(paths.join({ segments: [args.projectDir, evidencePath] }))).toEqual(record);
});
