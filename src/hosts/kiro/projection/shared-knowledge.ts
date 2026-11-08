import { z } from "zod";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { KnowledgeDocument } from "../../../workflow-definition/domain/knowledge.ts";

const SHARED_GLOB = "file://.kiro/knowledge/aidlc-shared/*.md";
const SHARED_DOCUMENT = /^knowledge\/aidlc-shared\/[^/]+\.md$/;

type SharedKnowledge = {
  readonly documents: readonly KnowledgeDocument[];
  readonly formatDocuments: ReadonlySet<string>;
};

const resourcePaths = (knowledge: SharedKnowledge): readonly string[] =>
  knowledge.documents
    .filter((document) => document.owner.kind === "core" &&
      document.audience.kind === "shared" && SHARED_DOCUMENT.test(document.source))
    .map((document) => document.source)
    .filter((path) => !knowledge.formatDocuments.has(path.split("/").at(-1) ?? ""))
    .sort()
    .map((path) => `file://.kiro/${path}`);

const parsedObject = (text: string): Result<Record<string, unknown>, string> => {
  try {
    const parsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(text));
    return parsed.success
      ? accepted(parsed.data)
      : refused("Kiro agent JSON must be an object.");
  } catch {
    return refused("Kiro agent JSON must be valid JSON.");
  }
};

export const withSharedKnowledge = (
  text: string,
  knowledge: SharedKnowledge,
): Result<string, string> => {
  const parsed = parsedObject(text);
  if (!parsed.ok) return parsed;
  const resources = parsed.value["resources"];
  if (!Array.isArray(resources) || !resources.includes(SHARED_GLOB)) return accepted(text);
  const files = resourcePaths(knowledge);
  return accepted(`${JSON.stringify({
    ...parsed.value,
    resources: resources.flatMap<unknown>((entry: unknown) => entry === SHARED_GLOB ? files : [entry]),
  }, null, 2)}\n`);
};
