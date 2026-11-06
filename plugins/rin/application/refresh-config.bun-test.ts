import { noteClaudeTurnPending } from "../../../core/tools/aidlc-claude-turn-origin.ts";
import { claudeTurnsPending } from "../../../core/tools/aidlc-claude-turn-pending.ts";
import { readMessage, saveMessage } from "../../../core/tools/aidlc-message-store.ts";
import { withAuditLock } from "../../../core/tools/aidlc-lib.ts";
import { hermeticGitEnvironment } from "../tools/hermetic-git/index.ts";
import { defaultFileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultReviewProcessPort } from "../tools/rin-gates/review-process-port.ts";
import { afterAll, expect, test } from "bun:test";
import { sha256File } from "../../../core/tools/aidlc-distribution.ts";
const files = defaultFileTextPort();
const paths = defaultPathOperations();
const runtime = defaultReviewProcessPort();
const root = paths.resolve({ segments: [paths.dirname({ path: paths.fromFileUrl({ url: import.meta.url }) }), "../../.."] });
const scratch = files.makeTemporaryDirectory(paths.join({ segments: [files.temporaryRoot(), "rin-refresh-binding-"] }));
const home = paths.join({ segments: [scratch, "home"] });
files.mkdir(home, { recursive: true });
const environment = {
    ...hermeticGitEnvironment({ configHome: home, ambient: { PATH: runtime.environment.PATH } }),
    XDG_CONFIG_HOME: paths.join({ segments: [home, "config"] }),
    XDG_CACHE_HOME: paths.join({ segments: [home, "cache"] }),
    APPDATA: paths.join({ segments: [home, "appdata"] }),
    LOCALAPPDATA: paths.join({ segments: [home, "localappdata"] }),
    TEMP: scratch, TMP: scratch, TMPDIR: scratch,
};
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
const config = (args: {
    readonly entry: string;
    readonly project: string;
    readonly source: string;
    readonly flags?: readonly string[];
    readonly mode?: "--json" | "--quiet";
}) => {
    const result = runtime.runSync({ program: runtime.arguments[0], args: [paths.join({ segments: [root, args.entry] }), "config", "--project-dir", args.project, "--from", args.source, args.mode ?? "--json", ...(args.flags ?? [])],
        cwd: args.project, timeoutMilliseconds: 60000,
        environment: { ...environment, AIDLC_PROJECT_DIR: args.project, CLAUDE_PROJECT_DIR: args.project, AIDLC_HARNESS_DIR: ".claude", AIDLC_HARNESS_NAME: "claude" }, });
    return { status: result.status, output: result.stdout + result.stderr, stdout: result.stdout };
};
// Synthetic bookkeeping fixture, not a human approval or identity assertion.
const pendingHostTurn = (project: string, label: string): string => {
    const prompt = `scheduled refresh fixture ${label}`;
    const transcript = paths.join({ segments: [scratch, `${label}.jsonl`] });
    const message = saveMessage(project, { session: "refresh-origin-fixture", at: runtime.timestamp(), source: "prompt", text: prompt, words: prompt, picker: null, settings: [], route: { scope: null, newIntent: false, skip: [], add: [], projectType: null } });
    withAuditLock(project, () => noteClaudeTurnPending(project, "refresh-origin-fixture", { message: message.id, transcript, promptId: label }));
    files.write(transcript, JSON.stringify({ type: "user", promptId: label, message: { role: "user", content: prompt }, timestamp: message.at, turnOrigin: "scheduled" }) + "\n");
    expect(claudeTurnsPending(project)).toBe(true);
    return message.id;
};
const settled = (project: string, id: string): void => {
    expect(readMessage(project, id)).toBeNull();
    expect(claudeTurnsPending(project)).toBe(false);
};
test("current source composition preserves ordinary config and binds the explicit Rin policy to the real plan", () => {
    const project = paths.join({ segments: [scratch, "project"] });
    const source = paths.join({ segments: [scratch, "source"] });
    files.mkdir(paths.join({ segments: [project, ".git"] }), { recursive: true });
    files.copyTree({ source: paths.join({ segments: [root, "dist-release/claude"] }), destination: source });
    const core = "core/tools/aidlc-init.ts";
    const rin = "scripts/rin-config.ts";
    const installed = config({ entry: core, project, source });
    expect(installed.status, installed.output).toBe(0);
    put({ root: project, path: "aidlc/spaces/default/intents/intents.json", content: JSON.stringify([{
                uuid: "00000000-0000-4000-8000-000000000001", slug: "open", dirName: "open", scope: "feature", status: "in-flight",
            }]) });
    put({ root: project, path: "aidlc/spaces/default/intents/open/aidlc-state.md", content: "# AI-DLC State Tracking\n- **State Version**: 8\n- **Scope**: feature\n- **Status**: Running\n- **Current Stage**: requirements-analysis\n" });
    put({ root: project, path: "aidlc/spaces/default/intents/open/audit.md", content: "Existing approval and review evidence.\n" });
    const preservedPaths = ["aidlc/spaces/default/intents/open/aidlc-state.md", "aidlc/spaces/default/intents/open/audit.md", "aidlc/spaces/default/memory/org.md"];
    const privateRule = files.read(paths.join({ segments: [project, preservedPaths[2]] }), "utf8") + "\n# Private refresh fixture\n";
    put({ root: project, path: preservedPaths[2], content: privateRule });
    const preserved = () => Object.fromEntries(preservedPaths.map(path => [path, sha256File(paths.join({ segments: [project, path] }))]));
    const before = preserved();
    const tool = ".claude/tools/aidlc-usage.ts";
    put({ root: source, path: tool, content: `${files.read(paths.join({ segments: [source, tool] }), "utf8")}\n// Compatible source refresh.\n` });
    const flags = ["--dry-run"];
    const coreDry = config({ entry: core, project, source, flags });
    const dryPending = pendingHostTurn(project, "dry");
    const rinDry = config({ entry: rin, project, source, flags });
    expect(coreDry.status, coreDry.output).toBe(0);
    expect(rinDry.status, rinDry.output).toBe(0);
    settled(project, dryPending);
    const generic = JSON.parse(coreDry.stdout).data;
    const chosen = JSON.parse(rinDry.stdout).data;
    expect(generic.refreshCompatibility).toBeUndefined();
    expect(chosen.refreshCompatibility.policy).toBe("rin-reviewed-refresh-67-82-96-v1");
    expect(chosen.planToken).not.toBe(generic.planToken);
    const refusalPending = pendingHostTurn(project, "refusal");
    const wrongPolicy = config({ entry: core, project, source, flags: ["--plan-token", chosen.planToken] });
    expect(wrongPolicy.status, wrongPolicy.output).not.toBe(0);
    settled(project, refusalPending);
    expect(files.read(paths.join({ segments: [project, tool] }), "utf8")).not.toContain("Compatible source refresh.");
    const applyPending = pendingHostTurn(project, "apply");
    const applied = config({ entry: rin, project, source, flags: ["--plan-token", chosen.planToken] });
    expect(applied.status, applied.output).toBe(0);
    settled(project, applyPending);
    expect(JSON.parse(applied.stdout).data.refreshCompatibility.policy).toBe(chosen.refreshCompatibility.policy);
    expect(JSON.parse(applied.stdout).data.planToken).toBe(chosen.planToken);
    expect(files.read(paths.join({ segments: [project, tool] }), "utf8")).toContain("Compatible source refresh.");
    expect(preserved()).toEqual(before);
    expect(files.read(paths.join({ segments: [project, "aidlc/active-memory/org.md"] }), "utf8")).toContain("# Private refresh fixture");
    const stagePath = ".claude/aidlc-common/stages/inception/requirements-analysis.md";
    const stageText = files.read(paths.join({ segments: [source, stagePath] }), "utf8");
    put({ root: source, path: stagePath, content: stageText.replace(/^condition: (.+)$/m, "condition: $1; additional reviewed requirement") });
    const ordinaryChanged = config({ entry: core, project, source, flags });
    expect(ordinaryChanged.status, ordinaryChanged.output).toBe(0);
    expect(JSON.parse(ordinaryChanged.stdout).data.refreshCompatibility).toBeUndefined();
    const policyRefusalPending = pendingHostTurn(project, "policy-refusal");
    const policyRefusal = config({ entry: rin, project, source, flags });
    expect(policyRefusal.status, policyRefusal.output).not.toBe(0);
    expect(policyRefusal.output).toContain("changes outside the selected policy");
    settled(project, policyRefusalPending);
    expect(preserved()).toEqual(before);
}, 120000);
test("real quiet dry-run and apply retain the owed review and seat work", () => {
    const project=paths.join({segments:[scratch,"quiet-project"]});const source=paths.join({segments:[scratch,"quiet-source"]});
    files.mkdir(paths.join({segments:[project,".git"]}),{recursive:true});
    files.copyTree({source:paths.join({segments:[root,"dist-release/claude"]}),destination:source});
    // Synthetic core fixture: exercise the exact Rin seat tuple without claiming a shipped plugin installation.
    const stage=files.read(paths.join({segments:[root,"plugins/rin/stages/inception/rin-gate-0-reconcile.md"]}),"utf8");
    put({root:source,path:".claude/aidlc-common/stages/inception/rin-gate-0-reconcile.md",content:stage.replace(/^ {2}- dd-[0-9]+\r?\n/gm, "")});
    for(const agent of ["rin-delivery-agent","rin-product-agent","rin-stage-reviewer-agent"]){put({root:source,path:`.claude/agents/${agent}.md`,content:files.read(paths.join({segments:[root,`plugins/rin/agents/${agent}.md`]}),"utf8")});}
    const setup=config({entry:"core/tools/aidlc-init.ts",project,source});expect(setup.status,setup.output).toBe(0);
    const rebuild=config({entry:"core/tools/aidlc-init.ts",project,source});expect(rebuild.status,rebuild.output).toBe(0);
    const graphPath=".claude/tools/data/stage-graph.json";const graph=JSON.parse(files.read(paths.join({segments:[project,graphPath]}),"utf8"));
    const rinStage=graph.find((row:{slug:string})=>row.slug==="rin-gate-0-reconcile");expect(rinStage).toBeDefined();
    rinStage.lead_agent="aidlc-delivery-agent";rinStage.support_agents=["aidlc-product-agent"];rinStage.reviewer="aidlc-architecture-reviewer-agent";
    put({root:project,path:graphPath,content:JSON.stringify(graph)});
    put({root:project,path:"aidlc/spaces/default/intents/open/aidlc-state.md",content:"# State\n- **Status**: Running\n- **Current Stage**: rin-gate-0-reconcile\n"});
    for(const flags of [["--dry-run"],[]]){const result=config({entry:"scripts/rin-config.ts",project,source,flags,mode:"--quiet"});expect(result.status,result.output).toBe(0);expect(result.output).toContain("it owes a fresh review");expect(result.output).toContain("notes from each named seat");}
    const unchanged=config({entry:"scripts/rin-config.ts",project,source,flags:["--dry-run"]});expect(unchanged.status,unchanged.output).toBe(0);expect(JSON.parse(unchanged.stdout).data.refreshCompatibility.stageRevalidation).toEqual({});
},120000);
test("interactive setup children retain the policy when regenerating changed stage metadata",()=>{
    const source=paths.join({segments:[root,"dist-release/claude"]});
    for(const entry of ["scripts/rin-config.ts","core/tools/aidlc-init.ts"]){
        const project=paths.join({segments:[scratch,entry.startsWith("scripts")?"rin-walk":"core-walk"]});files.mkdir(paths.join({segments:[project,".git"]}),{recursive:true});
        const installed=config({entry:"core/tools/aidlc-init.ts",project,source});expect(installed.status,installed.output).toBe(0);
        put({root:project,path:"aidlc/spaces/default/intents/open/aidlc-state.md",content:"# State\n- **Status**: Running\n- **Current Stage**: requirements-analysis\n"});
        const graphPath=paths.join({segments:[project,".claude/tools/data/stage-graph.json"]});const before=files.read(graphPath,"utf8");
        const stagePath=".claude/aidlc-common/stages/inception/requirements-analysis.md";const text=files.read(paths.join({segments:[project,stagePath]}),"utf8");
        put({root:project,path:stagePath,content:text.replace(/^condition: (.+)$/m,"condition: $1; interactive changed contract")});
        const result=runtime.runSync({program:runtime.arguments[0],args:[paths.join({segments:[root,entry]}),"config","--project-dir",project],cwd:project,timeoutMilliseconds:60000,environment:{...environment,AIDLC_PROJECT_DIR:project,CLAUDE_PROJECT_DIR:project,AIDLC_TEST_CONFIG_TTY:"1",AIDLC_TEST_CONFIG_INPUT:"y\nproject\n1\nbalanced\n"}});
        const output=result.stdout+result.stderr;expect(output).toContain("Model policy for claude");
        if(entry.startsWith("scripts")){expect(result.status,output).not.toBe(0);expect(output).toContain("changes outside the selected policy");expect(files.read(graphPath,"utf8")).toBe(before);expect(files.exists(paths.join({segments:[project,"aidlc.settings.json"]}))).toBe(false);}
        else {expect(output).not.toContain("changes outside the selected policy");expect(files.read(graphPath,"utf8")).toContain("interactive changed contract");expect(files.read(paths.join({segments:[project,"aidlc.settings.json"]}),"utf8")).toContain('"preset": "balanced"');}
    }
},120000);
