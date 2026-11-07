import type {
  AgentKnowledge,
  AgentParticipation,
  AuthoredAgent,
} from "./agent-definition.ts";
import { finding, pathStatus, sourceKey, type Outcome } from "./model.ts";

export const prepareAgentKnowledge = ({
  agent,
  knowledge,
}: {
  readonly agent: AuthoredAgent;
  readonly knowledge: readonly AgentKnowledge[];
}): Outcome<readonly AgentKnowledge[]> => {
  const sourceRoot =
    agent.origin.source.kind === "core" ? "core" : `plugins/${agent.origin.source.id}`;
  const prefix = `${sourceRoot}/knowledge/${agent.name}/`;
  const findings = knowledge.flatMap((entry) => [
    ...(sourceKey(entry.origin.source) !== sourceKey(agent.origin.source) ||
    entry.origin.pin !== agent.origin.pin
      ? [
          finding({
            code: "foreign-content",
            subject: entry.origin.path,
            detail: "knowledge must belong to the agent's source and pin",
          }),
        ]
      : []),
    ...(!entry.origin.path.startsWith(prefix) ||
    pathStatus({ path: entry.origin.path }) === "unsafe" ||
    !/^[a-z][a-z0-9-]*\.md$/.test(entry.origin.path.slice(prefix.length))
      ? [
          finding({
            code: "invalid-path",
            subject: entry.origin.path,
            detail: `expected a Markdown file directly under ${prefix}`,
          }),
        ]
      : []),
    ...(entry.body.trim().length === 0
      ? [
          finding({
            code: "empty-knowledge",
            subject: entry.origin.path,
            detail: "knowledge must contain text",
          }),
        ]
      : []),
    ...(knowledge.filter((candidate) => candidate.origin.path === entry.origin.path).length !== 1
      ? [
          finding({
            code: "duplicate",
            subject: entry.origin.path,
            detail: "knowledge paths must be unique",
          }),
        ]
      : []),
  ]);
  if (findings.length > 0) return { status: "invalid", findings };
  return {
    status: "ok",
    value: [...knowledge].sort((left, right) => left.origin.path.localeCompare(right.origin.path)),
  };
};
export const prepareAgentPersona = ({ agent, knowledge, participation }: {
  readonly agent: AuthoredAgent;
  readonly knowledge: readonly AgentKnowledge[];
  readonly participation: readonly AgentParticipation[];
}): string => {
  if (!participation.some((entry) => entry.role === "reviewer") || knowledge.length === 0) return agent.body;
  const sections = knowledge.map((entry) => `<!-- Absorbed at build time from knowledge/${agent.name}/${entry.origin.path.split("/").at(-1)} - edit that file, not this generated copy. -->\n\n${entry.body.trim()}`);
  return `${agent.body.trimEnd()}\n\n---\n\n${sections.join("\n\n---\n\n")}\n`;
};
