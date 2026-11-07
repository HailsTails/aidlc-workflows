import type { SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import type { HarnessBinding } from "./harness-binding.ts";
import type { NativeResource } from "./native-rendering.ts";
import { finding, pathStatus, type Outcome } from "./model.ts";

export type HarnessDocumentRole = "main-skill" | "composer" | "question-rendering" | "method-import" | "onboarding" | "shortcut-status" | "shortcut-jump" | "shortcut-scope" | "phase-ideation-guidance" | "phase-inception-guidance" | "phase-construction-guidance" | "phase-operation-guidance";
export type HarnessDocumentPlacement = { readonly role: HarnessDocumentRole; readonly source: string; readonly destination: string };
const placements: readonly HarnessDocumentPlacement[] = [
  { role: "main-skill", source: "skills/aidlc/SKILL.md", destination: "skills/aidlc/SKILL.md" },
  { role: "composer", source: "skills/aidlc/composer.md", destination: "skills/aidlc/composer.md" },
  { role: "question-rendering", source: "skills/aidlc/question-rendering.md", destination: "skills/aidlc/question-rendering.md" },
  { role: "method-import", source: "rules-aidlc.md", destination: "rules/aidlc.md" },
];
export const harnessDocumentPlacements = (): readonly HarnessDocumentPlacement[] => placements;
export type AuthoredHarnessDocument = { readonly role: HarnessDocumentRole; readonly origin: SourceOrigin; readonly text: string };
export type HarnessDocumentSources = { readonly documents: readonly AuthoredHarnessDocument[]; readonly authoring: readonly SourceOrigin[]; readonly inputs: readonly SourceContentDigest[] };
export type PreparedHarnessDocument = { readonly authored: AuthoredHarnessDocument; readonly destination?: string; readonly binding: HarnessBinding; readonly text: string; readonly authoring: readonly SourceOrigin[] };
export type PreparedHarnessDocuments = { readonly documents: readonly PreparedHarnessDocument[]; readonly inputs: readonly SourceContentDigest[] };
export type HarnessDocumentProjectionInput = { readonly document: PreparedHarnessDocument; readonly context: HarnessBinding };
export type HarnessDocumentProjection = { readonly origin: SourceOrigin; readonly harness: HarnessBinding["harness"]; readonly authoring: readonly SourceOrigin[]; readonly resources: readonly NativeResource[] };
export const renderHarnessDocument = ({ document, context }: HarnessDocumentProjectionInput): Outcome<HarnessDocumentProjection> => {
  if (document.binding.harness !== context.harness || document.binding.directory !== context.directory) return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: document.authored.origin.path, detail: "prepared harness documents require the same binding" })] };
  const placement = context.harness !== "claude" ? undefined : document.authored.role === "onboarding" ? { destination: "CLAUDE.md" } : placements.find((candidate) => candidate.role === document.authored.role);
  const path = document.destination ?? (placement === undefined ? undefined : `${context.directory}/${placement.destination}`);
  if (path === undefined || pathStatus({ path }) !== "safe") return { status: "invalid", findings: [finding({ code: "capability-gap", subject: document.authored.origin.path, detail: "harness document role has no declared placement" })] };
  return { status: "ok", value: { origin: document.authored.origin, harness: context.harness, authoring: document.authoring, resources: [{ kind: "file", path, body: document.text }] } };
};
