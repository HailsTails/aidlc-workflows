// Pure authored-text projection, extracted from the accepted projection experiment.
// No filesystem, manifest discovery, runtime execution, or installation policy.
export type TextProjectionContext = {
  readonly harness: string;
  readonly harnessDir: string;
  readonly rulesSubdir: string;
  readonly invocation: string;
  readonly memoryRoot: string;
};
export type ProjectionFinding = {
  readonly code: "invalid-input" | "harness-mismatch" | "directory-mismatch" | "unresolved-token";
  readonly subject: string;
  readonly detail: string;
};
// Escapes keep token vocabulary literal through the legacy .ts invocation seam.
const tokens = [
  "\u007b\u007bHARNESS_DIR\u007d\u007d", "\u007b\u007bAIDLC_INVOKE\u007d\u007d", "\u007b\u007bMEMORY_ROOT\u007d\u007d", "\u007b\u007bINVOKE\u007d\u007d",
  "\u007b\u007bTOOL_PREFIX\u007d\u007d", "\u007b\u007bTRUSTED_NAMESPACE\u007d\u007d", "\u007b\u007bOPTION_LETTERS\u007d\u007d",
];
export const renderTokens = ({ text, contract }: {
  readonly text: string;
  readonly contract: TextProjectionContext;
}): string => text.replace(
  /\{\{HARNESS_DIR\}\}\/rules\/(?!default\.rules)|\{\{(?:HARNESS_DIR|AIDLC_INVOKE|INVOKE|MEMORY_ROOT)\}\}/g,
  (token) => tokenReplacement({ token, contract }),
);
const tokenReplacement = ({ token, contract }: {
  readonly token: string;
  readonly contract: TextProjectionContext;
}): string => {
  if (token === "{{HARNESS_DIR}}/rules/") return `${contract.harnessDir}/${contract.rulesSubdir}/`;
  if (token === "\u007b\u007bHARNESS_DIR\u007d\u007d") return contract.harnessDir;
  if (token === "\u007b\u007bMEMORY_ROOT\u007d\u007d") return contract.memoryRoot;
  return contract.invocation;
};
export const residue = ({ text, subject }: {
  readonly text: string;
  readonly subject: string;
}): readonly ProjectionFinding[] => tokens.flatMap((token) =>
  Array.from(text.matchAll(new RegExp(token.replace(/[{}]/g, "\\$&"), "g"))).map((match) => ({
    code: "unresolved-token" as const,
    subject,
    detail: `${token} at line ${text.slice(0, match.index).split("\n").length}`,
  })),
);
