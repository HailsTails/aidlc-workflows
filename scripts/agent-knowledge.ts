import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { delegatedSharedKnowledge } from "../src/projection/adapters/legacy-format-docs.ts";
import { absorbReviewerKnowledge as absorbCapturedKnowledge,
  injectDelegatedKnowledgePreflight as injectPreflight,
} from "../src/projection/domain/agent-knowledge.ts";

export function absorbReviewerKnowledge(request: {
  content: string; agentName: string; sourceRoot: string; reviewerAgents: ReadonlySet<string>;
}): string {
  const { content, agentName, sourceRoot, reviewerAgents } = request;
  if (!reviewerAgents.has(agentName)) return content;
  const knowledgeDir = join(sourceRoot, "knowledge", agentName);
  const sources = existsSync(knowledgeDir)
    ? readdirSync(knowledgeDir).filter((file) => file.endsWith(".md")).sort()
    .map((file) => ({ path: `knowledge/${agentName}/${file}`,
      content: { kind: "text" as const,
        text: readFileSync(join(knowledgeDir, file), "utf-8") } })) : [];
  return absorbCapturedKnowledge({ content, agentName, reviewerAgents, sources });
}

export function injectDelegatedKnowledgePreflight(
  content: string, agentName: string, harnessDir: string,
): string {
  return injectPreflight({ content, agentName, directory: harnessDir,
    reading: harnessDir === ".kiro" ? "in-parts" : "whole-files",
    sharedKnowledge: delegatedSharedKnowledge(harnessDir) });
}

export function agentNameFromPath(srcPath: string): string | null {
  const posixPath = srcPath.split(sep).join("/");
  if (!posixPath.includes("/agents/") || !posixPath.endsWith("-agent.md")) {
    return null;
  }
  return posixPath.split("/").pop()?.replace(/\.md$/, "") ?? null;
}
