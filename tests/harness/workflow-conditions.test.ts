// The condition harness owns parsing and execution, never the caller's expected policy.
import { expect, test } from "bun:test";
import { evaluateWorkflowCondition, githubEventContext, readWorkflowConditions } from "./workflow-conditions.ts";

const example = Bun.YAML.parse(`
on:
  pull_request:
    types: [opened, ready_for_review]
  push: null
jobs:
  first:
    if: "github.event_name == 'push'"
    runs-on: ubuntu-latest
  second:
    if: "\${{ !cancelled() }}"
    name: An unrelated field
`);

test("workflow conditions preserve job identity, order, expression text and PR triggers", () => {
  expect(readWorkflowConditions(example)).toEqual({
    pullRequestTypes: ["opened", "ready_for_review"],
    jobNames: ["first", "second"],
    jobs: [{ name: "first", condition: "github.event_name == 'push'" }, { name: "second", condition: `\${{ !cancelled() }}` }],
    byName: new Map([["first", "github.event_name == 'push'"], ["second", `\${{ !cancelled() }}`]]),
  });
});

test.each([
  null,
  {},
  { on: {}, jobs: {} },
  Bun.YAML.parse("on: {pull_request: {types: [4]}}\njobs: {}"),
  Bun.YAML.parse("on: {pull_request: {types: []}}\njobs: {missing: {name: not-a-condition}}"),
  Bun.YAML.parse("on: {pull_request: {types: []}}\njobs: {wrong: {if: true}}"),
])("workflow boundary rejects malformed condition inputs: %j", document => {
  expect(() => readWorkflowConditions(document)).toThrow();
});

test("workflow conditions accept an explicitly empty job inventory", () => {
  expect(readWorkflowConditions(Bun.YAML.parse("on: {pull_request: {types: []}}\njobs: {}"))).toEqual({ pullRequestTypes: [], jobNames: [], jobs: [], byName: new Map() });
});

test.each([
  { state: "draft", expected: '{"event_name":"pull_request","head_ref":"feature/example","event":{"pull_request":{"draft":true}}}' },
  { state: "ready", expected: '{"event_name":"pull_request","head_ref":"feature/example","event":{"pull_request":{"draft":false}}}' },
] as const)("GitHub PR fixture emits the external wire shape for $state", ({ state, expected }) => {
  expect(JSON.stringify(githubEventContext({ eventName: "pull_request", headBranch: "feature/example", pullRequestState: state }))).toBe(expected);
});

test.each(["push", "merge_group", "workflow_dispatch", "workflow_call", "schedule", "unknown-event"])("non-PR %s has no branch or PR payload", eventName => {
  const context = githubEventContext({ eventName: eventName, headBranch: "ignored-branch", pullRequestState: "draft" });
  expect(context["event_name"]).toBe(eventName);
  expect(context["head_ref"]).toBe("");
  expect(context["event"]).toEqual({});
});

test.each([
  { condition: `  \${{\n true \n}}  `, expected: true },
  { condition: "true", expected: true },
  { condition: "false", expected: false },
  { condition: `\${{ true }}`, expected: true },
  { condition: `\${{\n false \n}}`, expected: false },
  { condition: "github.event_name == 'push'", expected: true },
  { condition: "github.event_name == 'pull_request'", expected: false },
  { condition: "github.event_name != 'pull_request' || github.event.pull_request.draft", expected: true },
  { condition: "github.event_name == 'pull_request' && github.event.pull_request.draft", expected: false },
  { condition: "contains(fromJSON('[\"main\",\"feature\"]'), 'main')", expected: true },
  { condition: "contains(fromJSON('[\"main\",\"feature\"]'), 'main-extra')", expected: false },
  { condition: "contains(fromJSON('[]'), 'main')", expected: false },
  { condition: "fromJSON('null')", expected: null },
  { condition: "github.unknown", expected: undefined },
])("condition execution uses the supplied expression: $condition", ({ condition, expected }) => {
  expect(evaluateWorkflowCondition({ condition: condition, github: githubEventContext({ eventName: "push", headBranch: "", pullRequestState: "ready" }), runState: "active" })).toBe(expected);
});

test.each([
  { state: "draft", expected: true },
  { state: "ready", expected: false },
] as const)("condition execution observes the actual $state PR payload", ({ state, expected }) => {
  expect(evaluateWorkflowCondition({ condition: "github.head_ref == 'branch' && github.event.pull_request.draft", github: githubEventContext({ eventName: "pull_request", headBranch: "branch", pullRequestState: state }), runState: "active" })).toBe(expected);
});

test.each([
  { state: "active", expected: true },
  { state: "cancelled", expected: false },
] as const)("condition cancellation uses the supplied $state run", ({ state, expected }) => {
  expect(evaluateWorkflowCondition({ condition: `\${{ !cancelled() && true }}`, github: githubEventContext({ eventName: "push", headBranch: "", pullRequestState: "ready" }), runState: state })).toBe(expected);
});

test.each([undefined, 5, "true &&", "unknownFunction()", "fromJSON('invalid')", "github.event.pull_request.draft"])("invalid or unsupported execution does not silently pass: %s", condition => {
  expect(() => evaluateWorkflowCondition({ condition: condition, github: githubEventContext({ eventName: "push", headBranch: "", pullRequestState: "ready" }), runState: "active" })).toThrow();
});

test.each([`\${{ true`, `true }}`, `\${{ true }`, `\${{ }}`, `\${{ true }} trailing`, `\${{ true }} }}`])("malformed condition wrappers are rejected: %s", condition => {
  expect(() => evaluateWorkflowCondition({ condition, github: githubEventContext({ eventName: "push", headBranch: "", pullRequestState: "ready" }), runState: "active" })).toThrow();
});
