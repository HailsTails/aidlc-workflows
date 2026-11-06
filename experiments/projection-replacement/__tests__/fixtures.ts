import type { DocumentSource, ProjectionRequest } from "../src/domain/model.ts";
export const reviewerRequest = (
  source: DocumentSource = { kind: "plugin", id: "test-pro" },
): ProjectionRequest => ({
  documents: [
    {
      source,
      description: "Review implementation evidence against the required rules.",
      id: "reviewer",
      kind: "agent",
      tier: "judgment",
      knowledge: [],
      body: "Review using {{HARNESS_DIR}}/rules/ and {{MEMORY_ROOT}}. Run {{AIDLC_INVOKE}}. Literal template: {{ customer.name }}.",
      hook: { event: "session-start", command: "echo Reviewer context: {{HARNESS_DIR}}" },
    },
  ],
  selectedPlugins: source.kind === "plugin" ? [source.id] : [],
  knowledge: [
    { source, id: "reviewing", body: "Check evidence against {{HARNESS_DIR}}/rules/review.md." },
  ],
  reviewers: [{ source, document: "reviewer", knowledge: ["reviewing"] }],
  contract: {
    version: 1,
    harness: "claude",
    harnessDir: ".claude",
    rulesSubdir: "guardrails",
    invocation: "aidlc",
    memoryRoot: "aidlc/spaces/default/memory",
    capabilities: ["agents", "knowledge", "hooks"],
    tierCap: "judgment",
    tiers: {
      templated: { model: "inherit", effort: null },
      balanced: { model: "sonnet", effort: "medium" },
      judgment: { model: "inherit", effort: null },
    },
  },
});
