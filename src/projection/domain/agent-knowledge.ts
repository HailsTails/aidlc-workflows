import type { FileContent } from "../../kernel/file-content.ts";

export const absorbReviewerKnowledge = (request: {
  readonly content: string;
  readonly agentName: string;
  readonly reviewerAgents: ReadonlySet<string>;
  readonly sources: readonly { readonly path: string; readonly content: FileContent }[];
}): string => {
  if (!request.reviewerAgents.has(request.agentName)) return request.content;
  const prefix = `knowledge/${request.agentName}/`;
  const sources = request.sources.filter((source) => source.path.startsWith(prefix)
    && source.path.endsWith(".md") && !source.path.slice(prefix.length).includes("/"))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (sources.length === 0) return request.content;
  const sections = sources.map((source) => {
    const text = source.content.kind === "text" ? source.content.text
      : new TextDecoder("utf-8", { ignoreBOM: true }).decode(source.content.bytes);
    return `<!-- Absorbed at build time from ${source.path} - edit that file, not this generated copy. -->\n\n${text.trim()}`;
  });
  return `${request.content.trimEnd()}\n\n---\n\n${sections.join("\n\n---\n\n")}\n`;
};

const DELEGATED_KNOWLEDGE_PREFLIGHT = "<!-- aidlc-delegated-knowledge-preflight -->";

export const injectDelegatedKnowledgePreflight = (request: {
  readonly content: string;
  readonly agentName: string;
  readonly directory: string;
  readonly reading: "whole-files" | "in-parts";
  readonly sharedKnowledge: string;
}): string => {
  const { content, agentName, directory } = request;
  if (content.includes(DELEGATED_KNOWLEDGE_PREFLIGHT)) return content;
  const block = [ `${DELEGATED_KNOWLEDGE_PREFLIGHT}\n`,
    `**Delegated knowledge preflight (mandatory):** Before substantive work, `,
    `ensure every readable Markdown file under these directories is loaded, in order: `,
    `${request.sharedKnowledge}, `,
    `\`${directory}/knowledge/${agentName}/\`, `,
    `\`aidlc/spaces/<active-space>/knowledge/aidlc-shared/\`, then `,
    `\`aidlc/spaces/<active-space>/knowledge/${agentName}/\`. `,
    `A native resource preload satisfies this requirement; otherwise read the files now. `,
    (request.reading === "in-parts"
      ? `Kiro shows only part of a long file: read each one with your file tool in parts of at most 200 lines (offset and limit), from the first line to the last; a read that comes back cut short is not all of it. `
      : ""),
    `The dispatch brief supplies rules and artifact paths separately.`,
  ].join("");
  const frontmatter = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!frontmatter) return `${block}\n\n${content.trimStart()}`;
  return `${content.slice(0, frontmatter[0].length)}${block}\n\n${content.slice(frontmatter[0].length)}`;
};
