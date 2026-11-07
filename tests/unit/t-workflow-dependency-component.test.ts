import { expect, test } from "bun:test";
import { assessDependencies, type DependencySource, type WorkflowCandidate, type WorkflowState } from "../../core/tools/workflow-plugin-dependencies/assessment.ts";

const state: WorkflowState = { lifecycle: "other", scope: "feature", stages: [{ name: "bootstrap", progress: "other", action: "execute" }, { name: "scan", progress: "completed", action: "execute" }, { name: "scan", progress: "other", action: "other" }, { name: "scan", progress: "other", action: "execute" }, { name: "scan", progress: "other", action: "execute" }] };
const declarations = { scopes: [{ name: "feature" }], stages: [{ name: "bootstrap", phase: "initialization" as const, plugin: "boot" }, { name: "scan", phase: "other" as const, plugin: "security" }] };

// A remote source supplies registry records and lazy state retrieval, not
// precomputed eligibility or obligations. It never imports persistence decoding.
test("memory service adapter delegates complete eligibility and requirement assessment", () => {
  const reads: string[] = [];
  const records: {name: string | null; lifecycle: WorkflowCandidate["lifecycle"]; state: WorkflowState | null}[] = [
    {name:"closed",lifecycle:"completed",state}, {name:null,lifecycle:"other",state},
    {name:"missing",lifecycle:"other",state:null}, {name:"terminal",lifecycle:"other",state:{...state,lifecycle:"archived"}},
    {name:"active",lifecycle:"other",state},
  ];
  const source: DependencySource = { ownership: () => declarations, visitWorkflows: visit => records.forEach(record => { visit({ identity: {space:"remote",name:record.name,displayName:String(record.name)},lifecycle:record.lifecycle,readState:()=>{reads.push(String(record.name));return record.state;} }); }) };
  const reasons=assessDependencies(source,new Set());
  expect(reads).toEqual(["missing","terminal","active"]);
  expect(reasons.map(x=>[x.kind,x.plugin])).toEqual([["scope","aidlc"],["stage","security"],["stage","security"]]);
  expect(reasons.every(x=>x.workflow.name==="active")).toBe(true);
  expect(assessDependencies(source,new Set(["aidlc","security"]))).toEqual([]);
});

test("source failure stops acquisition at that workflow with the original error", () => {
  const reads:string[]=[];const error=new Error("remote state unavailable");
  const source:DependencySource={ownership:()=>declarations,visitWorkflows:visit=>["first","broken","later"].forEach(name=>{ visit({identity:{space:"remote",name,displayName:name},lifecycle:"other",readState:()=>{reads.push(name);if(name==="broken")throw error;return state;}}); })};
  expect(()=>assessDependencies(source,new Set())).toThrow(error);
  expect(reads).toEqual(["first","broken"]);
});

test("sparse rows/declarations skip holes and duplicate last owners remain authoritative", () => {
  const rows:WorkflowState["stages"][number][]=Array(3);rows[1]={name:"scan",progress:"other",action:"execute"};
  const stages:typeof declarations.stages=Array(4);stages[1]={name:"scan",phase:"other",plugin:"first"};stages[3]={name:"scan",phase:"other",plugin:"last"};
  const source:DependencySource={ownership:()=>({scopes:[],stages}),visitWorkflows:visit=>visit({identity:{space:"a",name:"x",displayName:"x"},lifecycle:"other",readState:()=>({...state,scope:null,stages:rows})})};
  expect(assessDependencies(source,new Set()).map(x=>x.plugin)).toEqual(["last"]);
});
