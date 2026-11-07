import { expect, test } from "bun:test";
import { formatSelectionRefusal } from "./selection-refusal.ts";

test("refusal retains dependency duplicates and paused-map order with exact wording", () => {
  expect(formatSelectionRefusal({
    dependencies: [
      { plugin: "quality", text: 'workflow "w" (space team) runs under scope "review" owned by plugin "quality"' },
      { plugin: "security", text: 'workflow "w" (space team) has pending stage "scan" owned by plugin "security"' },
      { plugin: "quality", text: 'workflow "w" (space team) has pending stage "check" owned by plugin "quality"' },
    ],
    paused: new Map([["security", "base-b"], ["unrelated", "base-c"], ["quality", "base-a"]]),
    entryInvocation: () => "/aidlc",
  })).toBe('select-plugins refused: the new selection would strand 3 active workflow dependency(ies):\n' +
    '  - workflow "w" (space team) runs under scope "review" owned by plugin "quality"\n' +
    '  - workflow "w" (space team) has pending stage "scan" owned by plugin "security"\n' +
    '  - workflow "w" (space team) has pending stage "check" owned by plugin "quality"\n' +
    '  security would be paused: security builds on base-b, which this selection leaves off.\n' +
    '  quality would be paused: quality builds on base-a, which this selection leaves off.\n' +
    'Complete or archive the workflow(s) first (`/aidlc intent archive <name>`; a parked workflow ' +
    'still needs its plugin when it resumes), or keep the plugin enabled, then re-run select-plugins.');
});

test("no related paused plugin adds no blank line and preserves the caller invocation", () => {
  expect(formatSelectionRefusal({
    dependencies: [{ plugin: "quality", text: "required dependency" }],
    paused: new Map([["unrelated", "base"]]),
    entryInvocation: () => "$aidlc",
  })).toBe('select-plugins refused: the new selection would strand 1 active workflow dependency(ies):\n' +
    '  - required dependency\n' +
    'Complete or archive the workflow(s) first (`$aidlc intent archive <name>`; a parked workflow ' +
    'still needs its plugin when it resumes), or keep the plugin enabled, then re-run select-plugins.');
});

test("structured plugin identity survives independent presentation text", () => {
  expect(formatSelectionRefusal({
    dependencies: [{ plugin: "quality", text: "required dependency" }],
    paused: new Map([["quality", "base"]]),
    entryInvocation: () => "/aidlc",
  })).toContain('  quality would be paused: quality builds on base, which this selection leaves off.');
});

test("upstream label-collision explanation remains a presentation-only compatibility quirk", () => {
  expect(formatSelectionRefusal({
    dependencies: [{ plugin: "quality", text: 'workflow "w" (space team) runs under scope "plugin "phantom"" owned by plugin "quality"' }],
    paused: new Map([["phantom", "base"], ["quality", "base"]]),
    entryInvocation: () => "/aidlc",
  })).toBe('select-plugins refused: the new selection would strand 1 active workflow dependency(ies):\n' +
    '  - workflow "w" (space team) runs under scope "plugin "phantom"" owned by plugin "quality"\n' +
    '  phantom would be paused: phantom builds on base, which this selection leaves off.\n' +
    '  quality would be paused: quality builds on base, which this selection leaves off.\n' +
    'Complete or archive the workflow(s) first (`/aidlc intent archive <name>`; a parked workflow ' +
    'still needs its plugin when it resumes), or keep the plugin enabled, then re-run select-plugins.');
});
