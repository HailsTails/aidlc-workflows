export type DocumentSource =
  | {
      readonly kind: "core";
      readonly id: string;
    }
  | {
      readonly kind: "plugin";
      readonly id: string;
    };
export type Tier = "templated" | "balanced" | "judgment";
export type Capability = "agents" | "knowledge" | "hooks";
export type NeutralDocument = {
  readonly source: DocumentSource;
  readonly id: string;
  readonly kind: "agent" | "text" | "asset";
  readonly body: string;
  readonly description: string | null;
  readonly tier: Tier | null;
  readonly knowledge: readonly string[];
  readonly hook: {
    readonly event: "session-start";
    readonly command: string;
  } | null;
};
export type NativeTier = {
  readonly model: string | null;
  readonly effort: string | null;
};
export type ProjectionContract = {
  readonly version: 1;
  readonly harness: string;
  readonly harnessDir: string;
  readonly rulesSubdir: string;
  readonly invocation: string;
  readonly memoryRoot: string;
  readonly capabilities: readonly Capability[];
  readonly tiers: Readonly<Record<Tier, NativeTier>>;
  readonly tierCap: Tier;
};
export type Knowledge = {
  readonly source: DocumentSource;
  readonly id: string;
  readonly body: string;
};
export type Reviewer = {
  readonly source: DocumentSource;
  readonly document: string;
  readonly knowledge: readonly string[];
};
export type ProjectionRequest = {
  readonly documents: readonly NeutralDocument[];
  readonly selectedPlugins: readonly string[];
  readonly knowledge: readonly Knowledge[];
  readonly reviewers: readonly Reviewer[];
  readonly contract: ProjectionContract;
};
export type FindingCode =
  | "capability-gap"
  | "destination-collision"
  | "directory-mismatch"
  | "duplicate"
  | "empty-hook-command"
  | "empty-integration"
  | "empty-knowledge"
  | "foreign-content"
  | "harness-mismatch"
  | "inapplicable-agent-context"
  | "invalid-destination"
  | "invalid-identifier"
  | "invalid-input"
  | "invalid-invocation"
  | "invalid-json"
  | "invalid-path"
  | "invalid-tier-mapping"
  | "missing-body"
  | "missing-description"
  | "missing-knowledge"
  | "missing-plugin"
  | "missing-registration"
  | "missing-reviewer"
  | "missing-reviewer-knowledge"
  | "missing-tier"
  | "modified-owned-content"
  | "preserved-owned-content"
  | "unsupported-document-kind"
  | "unresolved-token"
  | "unvalidated-bundle"
  | "unvalidated-document"
  | "unvalidated-input";
export type FindingOf<Code extends FindingCode> = {
  readonly code: Code;
  readonly subject: string;
  readonly detail: string;
};
export type Finding = {
  [Code in FindingCode]: FindingOf<Code>;
}[FindingCode];
export type Outcome<T> =
  | {
      readonly status: "ok";
      readonly value: T;
    }
  | {
      readonly status: "invalid";
      readonly findings: readonly Finding[];
    };
export const sourceKey = (source: DocumentSource): string => `${source.kind}:${source.id}`;
export const documentKey = (document: NeutralDocument): string =>
  `${sourceKey(document.source)}/${document.id}`;
export const selectionFor = ({
  source,
  plugins,
}: {
  readonly source: DocumentSource;
  readonly plugins: readonly string[];
}): "selected" | "deselected" =>
  source.kind === "core" || plugins.includes(source.id) ? "selected" : "deselected";
export const finding = <Code extends FindingCode>(input: {
  readonly code: Code;
  readonly subject: string;
  readonly detail: string;
}): FindingOf<Code> => ({ ...input });
export const pathStatus = ({ path }: { readonly path: string }): "safe" | "unsafe" =>
  path.length > 0 &&
  !/[\\:]/.test(path) &&
  Array.from(path).every((character) => character.charCodeAt(0) >= 32) &&
  path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    ? "safe"
    : "unsafe";
export const identifierStatus = ({
  identifier,
}: {
  readonly identifier: string;
}): "valid" | "invalid" =>
  identifier.length <= 256 && /^[a-z][a-z0-9-]*$/.test(identifier) ? "valid" : "invalid";
