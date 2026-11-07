export type AuthoredHarnessSurface = "standard" | "kiro-agent-json" | "kiro-cli-settings";

const SHARED_KNOWLEDGE = "file://.kiro/knowledge/aidlc-shared/";
const SHARED_GLOB = `${SHARED_KNOWLEDGE}*.md`;

export function authoredHarnessSurface({ flavor, source }: {
  readonly flavor: string;
  readonly source: string;
}): AuthoredHarnessSurface {
  if (flavor !== "kiro") return "standard";
  if (source.startsWith("agents/") && source.endsWith(".json")) return "kiro-agent-json";
  return source === "settings/cli.json" ? "kiro-cli-settings" : "standard";
}

export function kiroSharedKnowledgeRequirement({ resources }: {
  readonly resources: readonly unknown[];
}): "shared-methodology" | "unchanged" {
  return resources.includes(SHARED_GLOB) ? "shared-methodology" : "unchanged";
}

// Dispatch preloads method knowledge; format documents remain owned by preflight.
export function expandKiroSharedKnowledge({ resources, availableFiles, formatDocuments }: {
  readonly resources: readonly unknown[];
  readonly availableFiles: readonly string[];
  readonly formatDocuments: ReadonlySet<string>;
}): readonly unknown[] {
  const files = availableFiles.filter((file) => file.endsWith(".md") && !formatDocuments.has(file))
    .sort().map((file) => `${SHARED_KNOWLEDGE}${file}`);
  return resources.flatMap((entry) => entry === SHARED_GLOB ? files : [entry]);
}
