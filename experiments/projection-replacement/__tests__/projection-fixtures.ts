import type {
  ProjectionContent,
  ProjectionContentInput,
} from "../src/domain/projection-content.ts";
import type { NeutralDocument } from "../src/domain/model.ts";
import { first, requestWith } from "./support.ts";
export const preparationFixture = (
  changes: {
    readonly document?: Partial<NeutralDocument>;
    readonly contract?: Partial<ProjectionContentInput["contract"]>;
    readonly absorbedKnowledge?: readonly string[];
  } = {},
): ProjectionContentInput => ({
  document: { ...first({ entries: requestWith().documents }), ...changes.document },
  contract: {
    harness: "claude",
    harnessDir: ".claude",
    rulesSubdir: "guardrails",
    invocation: "aidlc",
    memoryRoot: "aidlc/spaces/default/memory",
    ...changes.contract,
  },
  absorbedKnowledge: changes.absorbedKnowledge ?? [
    "Check evidence against {{HARNESS_DIR}}/rules/review.md.",
  ],
  nativeTier: { model: "inherit", effort: null },
});
export const projectionFixture = (changes: Partial<ProjectionContent> = {}): ProjectionContent => ({
  key: "plugin:test-pro/reviewer",
  source: { kind: "plugin", id: "test-pro" },
  id: "reviewer",
  kind: "agent",
  harness: "claude",
  harnessDir: ".claude",
  description: "Review implementation evidence against the required rules.",
  body: "Projected reviewer",
  nativeTier: { model: "inherit", effort: null },
  hook: { event: "session-start", command: "echo Reviewer context: .claude" },
  ...changes,
});
