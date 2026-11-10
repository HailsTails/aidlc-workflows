import { expect, test } from "bun:test";
import { absorbReviewerKnowledge, injectDelegatedKnowledgePreflight } from "./agent-knowledge.ts";

test("reviewer absorption selects sorted direct Markdown children and preserves the authored edit pointer", () => {
  expect(absorbReviewerKnowledge({ content: "Persona\n\n", agentName: "reviewer", reviewerAgents: new Set(["reviewer"]), sources: [
    { path: "knowledge/reviewer/z.md", content: { kind: "text", text: " Z \n" } },
    { path: "knowledge/reviewer/nested/a.md", content: { kind: "text", text: "Nested" } },
    { path: "knowledge/other/a.md", content: { kind: "text", text: "Other" } },
    { path: "knowledge/reviewer/a.md", content: { kind: "bytes", bytes: new Uint8Array([65, 10]) } },
    { path: "knowledge/reviewer/readme.txt", content: { kind: "text", text: "Sidecar" } },
  ] })).toBe("Persona\n\n---\n\n<!-- Absorbed at build time from knowledge/reviewer/a.md - edit that file, not this generated copy. -->\n\nA\n\n---\n\n<!-- Absorbed at build time from knowledge/reviewer/z.md - edit that file, not this generated copy. -->\n\nZ\n");
});

test("non-reviewers retain byte-identical personas even when matching knowledge is captured", () => {
  expect(absorbReviewerKnowledge({ content: "Persona\r\n\r\n", agentName: "worker", reviewerAgents: new Set(),
    sources: [{ path: "knowledge/worker/a.md", content: { kind: "text", text: "Do not absorb" } }] }))
    .toBe("Persona\r\n\r\n");
});

test("an absent reviewer knowledge folder leaves trailing persona bytes unchanged", () => {
  expect(absorbReviewerKnowledge({ content: "Persona  \n", agentName: "reviewer", reviewerAgents: new Set(["reviewer"]), sources: [] }))
    .toBe("Persona  \n");
});

test("the preflight keeps frontmatter first and uses the injected shared-knowledge vocabulary", () => {
  expect(injectDelegatedKnowledgePreflight({ content: "---\r\nname: worker\r\n---\r\nBody\n", agentName: "worker",
    directory: ".host", reading: "whole-files", sharedKnowledge: "shared line" })).toBe(
    "---\r\nname: worker\r\n---\r\n<!-- aidlc-delegated-knowledge-preflight -->\n" +
    "**Delegated knowledge preflight (mandatory):** Before substantive work, ensure every readable Markdown file under these directories is loaded, in order: shared line, `.host/knowledge/worker/`, `aidlc/spaces/<active-space>/knowledge/aidlc-shared/`, then `aidlc/spaces/<active-space>/knowledge/worker/`. A native resource preload satisfies this requirement; otherwise read the files now. The dispatch brief supplies rules and artifact paths separately.\n\nBody\n");
});

test("in-parts reading is an explicit request rather than a host-name branch", () => {
  expect(injectDelegatedKnowledgePreflight({ content: "  Body\n", agentName: "worker", directory: ".unfamiliar",
    reading: "in-parts", sharedKnowledge: "shared line" })).toBe(
    "<!-- aidlc-delegated-knowledge-preflight -->\n" +
    "**Delegated knowledge preflight (mandatory):** Before substantive work, ensure every readable Markdown file under these directories is loaded, in order: shared line, `.unfamiliar/knowledge/worker/`, `aidlc/spaces/<active-space>/knowledge/aidlc-shared/`, then `aidlc/spaces/<active-space>/knowledge/worker/`. A native resource preload satisfies this requirement; otherwise read the files now. Kiro shows only part of a long file: read each one with your file tool in parts of at most 200 lines (offset and limit), from the first line to the last; a read that comes back cut short is not all of it. The dispatch brief supplies rules and artifact paths separately.\n\nBody\n");
});

test("an existing preflight is not duplicated or reformatted", () => {
  expect(injectDelegatedKnowledgePreflight({ content: "<!-- aidlc-delegated-knowledge-preflight -->\r\nOriginal", agentName: "worker",
    directory: ".host", reading: "in-parts", sharedKnowledge: "shared line" }))
    .toBe("<!-- aidlc-delegated-knowledge-preflight -->\r\nOriginal");
});
