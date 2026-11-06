// covers: function:projectOnboardingDocuments

import { expect, test } from "bun:test";
import { projectOnboardingDocuments } from "./onboarding-projection.ts";

const neutral = "Shared project instructions.\n";
const nativeSkeleton = "{{SLOT:title_block}}\nRun {{SKILL_INVOKE}}.\n";

test("a shared project file stays neutral when native setup has its own destination", () => {
  expect(projectOnboardingDocuments({ neutral, nativeSkeleton, shared: { root: "project", path: "AGENTS.md" }, nativePath: "onboarding.md" })).toEqual([
    { kind: "neutral", destination: { root: "project", path: "AGENTS.md" }, content: neutral },
    { kind: "native", destination: { root: "harness", path: "onboarding.md" }, content: nativeSkeleton },
  ]);
});

test("a host-local shared document still keeps its declared destination", () => {
  expect(projectOnboardingDocuments({ neutral, nativeSkeleton, shared: { root: "harness", path: "shared.md" }, nativePath: "native/setup.md" })).toEqual([
    { kind: "neutral", destination: { root: "harness", path: "shared.md" }, content: neutral },
    { kind: "native", destination: { root: "harness", path: "native/setup.md" }, content: nativeSkeleton },
  ]);
});

test.each([null, ""])("a host with no separate native path combines setup before shared guidance: %s", (nativePath) => {
  expect(projectOnboardingDocuments({ neutral, nativeSkeleton, shared: { root: "harness", path: "CLAUDE.md" }, nativePath })).toEqual([
    { kind: "combined", destination: { root: "harness", path: "CLAUDE.md" }, content: "{{SLOT:title_block}}\nRun {{SKILL_INVOKE}}.\n\n## Shared AI-DLC onboarding\n\nShared project instructions.\n" },
  ]);
});

test("a combined host can own a project-root document", () => {
  expect(projectOnboardingDocuments({ neutral, nativeSkeleton, shared: { root: "project", path: "AGENTS.md" }, nativePath: null })).toEqual([
    { kind: "combined", destination: { root: "project", path: "AGENTS.md" }, content: "{{SLOT:title_block}}\nRun {{SKILL_INVOKE}}.\n\n## Shared AI-DLC onboarding\n\nShared project instructions.\n" },
  ]);
});

test("placement leaves native slot and runtime markers for their existing owners", () => {
  expect(projectOnboardingDocuments({ neutral, nativeSkeleton: "{{SLOT:title_block}} {{HARNESS_DIR}} {{INVOKE}}", shared: { root: "project", path: "AGENTS.md" }, nativePath: "rules/setup.md" })).toEqual([
    { kind: "neutral", destination: { root: "project", path: "AGENTS.md" }, content: neutral },
    { kind: "native", destination: { root: "harness", path: "rules/setup.md" }, content: "{{SLOT:title_block}} {{HARNESS_DIR}} {{INVOKE}}" },
  ]);
});

test("coincident destinations retain neutral-then-native publication order", () => {
  expect(projectOnboardingDocuments({ neutral, nativeSkeleton, shared: { root: "harness", path: "setup.md" }, nativePath: "setup.md" })).toEqual([
    { kind: "neutral", destination: { root: "harness", path: "setup.md" }, content: neutral },
    { kind: "native", destination: { root: "harness", path: "setup.md" }, content: nativeSkeleton },
  ]);
});

test("placement preserves supplied line endings and source text", () => {
  expect(projectOnboardingDocuments({ neutral: "Shared.\r\n", nativeSkeleton: "Native.\r\n", shared: { root: "project", path: "AGENTS.md" }, nativePath: null })).toEqual([
    { kind: "combined", destination: { root: "project", path: "AGENTS.md" }, content: "Native.\r\n\n## Shared AI-DLC onboarding\n\nShared.\r\n" },
  ]);
});

test("the document plan captures destination values instead of exposing the caller's mutable object", () => {
  const shared: { root: "project"; path: string } = { root: "project", path: "AGENTS.md" };
  const documents = projectOnboardingDocuments({ neutral, nativeSkeleton, shared, nativePath: "setup.md" });
  shared.path = "changed.md";
  expect(documents).toEqual([
    { kind: "neutral", destination: { root: "project", path: "AGENTS.md" }, content: neutral },
    { kind: "native", destination: { root: "harness", path: "setup.md" }, content: nativeSkeleton },
  ]);
});
