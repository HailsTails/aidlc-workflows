import { grantsEveryDeclaration, type DeletionGrant } from "./lane-plan.ts";
import type { Finding } from "./outcome.ts";

export type ModuleShape = {
  readonly declarations: readonly string[];
  readonly exports: readonly string[];
  readonly statements: readonly string[];
};

export type DeletionEvidence = {
  readonly path: string;
  readonly grant: DeletionGrant;
  readonly base: ModuleShape;
  readonly head: ModuleShape | undefined;
};

const EMPTY_MODULE: ModuleShape = { declarations: [], exports: [], statements: [] };

const removedDeclarations = (base: ModuleShape, head: ModuleShape): readonly string[] => {
  const kept = new Set(head.declarations);
  return [...new Set(base.declarations)].filter((name) => !kept.has(name));
};

const isSubsequence = (head: readonly string[], base: readonly string[]): boolean => {
  let cursor = 0;
  for (const statement of head) {
    cursor = base.indexOf(statement, cursor);
    if (cursor === -1) {
      return false;
    }
    cursor += 1;
  }
  return true;
};

const unlisted = (evidence: DeletionEvidence, head: ModuleShape): readonly string[] =>
  grantsEveryDeclaration(evidence.grant.declarations)
    ? []
    : removedDeclarations(evidence.base, head).filter(
        (name) => !evidence.grant.declarations.includes(name),
      );

export const judgeDeletion = (evidence: DeletionEvidence): readonly Finding[] => {
  const head = evidence.head ?? EMPTY_MODULE;
  const notGranted = unlisted(evidence, head).map((name) => ({
    subject: `${evidence.path} · ${name}`,
    violation: "was deleted, but lanes.json does not list it for this lane",
    fix:
      "Delete only the declarations lanes.json assigns to your lane. Restore this one; " +
      "the lane that owns its concept moves it into its context and deletes it then.",
  }));
  const rewritten = isSubsequence(head.statements, evidence.base.statements)
    ? []
    : [
        {
          subject: evidence.path,
          violation: "changes or adds code, where the lane may only delete declarations",
          fix:
            "Only delete whole declarations here and re-point imports. Put the new code " +
            "in your context under src/ and import it from there.",
        },
      ];
  return [...notGranted, ...rewritten];
};
