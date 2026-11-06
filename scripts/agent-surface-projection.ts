// Native dispatch metadata and the persona an inline lead reads have different audiences.
export type AgentSurfaceRequirements =
  | { readonly kind: "dispatch-only" }
  | { readonly kind: "inline-role"; readonly agent: string; readonly personaPath: string };

export type AgentSurfaceWrite =
  | { readonly kind: "persona"; readonly path: string }
  | { readonly kind: "dispatch"; readonly path: string; readonly content: string };

export type AgentSurfaceProjection =
  | { readonly kind: "projected"; readonly writes: readonly AgentSurfaceWrite[] }
  // A persona copy precedes validation today; keep that publication order on refusal.
  | { readonly kind: "refused"; readonly writes: readonly AgentSurfaceWrite[]; readonly message: string };

type FrontmatterExtension =
  | { readonly kind: "extended"; readonly content: string }
  | { readonly kind: "refused"; readonly message: string };

type AdditionCheck =
  | { readonly kind: "accepted"; readonly keys: ReadonlySet<string> }
  | { readonly kind: "refused"; readonly message: string };

export function agentSurfaceRequirements({ path, additions }: {
  readonly path: string;
  readonly additions: readonly string[];
}): AgentSurfaceRequirements {
  if (!path.startsWith("agents/") || !additions.some((line) => line.split(":", 1).includes("permissions"))) {
    return { kind: "dispatch-only" };
  }
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const agent = filename.endsWith(".md") && filename !== ".md" ? filename.slice(0, -3) : filename;
  return { kind: "inline-role", agent, personaPath: `aidlc-common/personas/${filename}` };
}

function checkAddition({ line, path, frontmatter, keys }: {
  readonly line: string;
  readonly path: string;
  readonly frontmatter: string;
  readonly keys: ReadonlySet<string>;
}): AdditionCheck {
  if (/^\s/.test(line)) return { kind: "accepted", keys };
  const key = line.replace(/:[\s\S]*$/, "").trim();
  if (!/^[A-Za-z_][\w-]*$/.test(key)) return {
    kind: "refused", message: `frontmatterAdditions: line "${line}" for ${path} does not start with a YAML key.`,
  };
  if (keys.has(key)) return {
    kind: "refused", message: `frontmatterAdditions: ${path} declares "${key}:" more than once in additions.`,
  };
  if (new RegExp(`^${key}:`, "m").test(frontmatter)) return {
    kind: "refused", message: `frontmatterAdditions: ${path} already declares "${key}:" in core - resolve the collision instead of shipping a duplicate key.`,
  };
  return { kind: "accepted", keys: new Set([...keys, key]) };
}

function extendFrontmatter({ content, additions, path }: {
  readonly content: string;
  readonly additions: readonly string[];
  readonly path: string;
}): FrontmatterExtension {
  const matched = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (matched === null) return {
    kind: "refused", message: `frontmatterAdditions: ${path} has no leading frontmatter block to extend.`,
  };
  const checked = additions.reduce<AdditionCheck>((prior, line) => prior.kind === "refused" ? prior
    : checkAddition({ line, path, frontmatter: matched[0], keys: prior.keys }), { kind: "accepted", keys: new Set<string>() });
  if (checked.kind === "refused") return checked;
  const insertAt = matched[0].lastIndexOf("---");
  return { kind: "extended", content: `${content.slice(0, insertAt)}${additions.join("\n")}\n${content.slice(insertAt)}` };
}

export function projectAgentSurface({ path, content, additions, inlineAgents }: {
  readonly path: string;
  readonly content: string;
  readonly additions: readonly string[];
  readonly inlineAgents: ReadonlySet<string>;
}): AgentSurfaceProjection {
  const requirements = agentSurfaceRequirements({ path, additions });
  const writes: readonly AgentSurfaceWrite[] = requirements.kind === "inline-role" && inlineAgents.has(requirements.agent)
    ? [{ kind: "persona", path: requirements.personaPath }] : [];
  const extended = extendFrontmatter({ content, additions, path });
  if (extended.kind === "refused") return { ...extended, writes };
  return { kind: "projected", writes: [...writes, { kind: "dispatch", path, content: extended.content }] };
}
