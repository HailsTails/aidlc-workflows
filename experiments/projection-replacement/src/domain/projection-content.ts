import {
  documentKey,
  finding,
  type Finding,
  type NativeTier,
  type NeutralDocument,
  type Outcome,
  type ProjectionContract,
} from "./model.ts";
export type ProjectionContent = {
  readonly key: string;
  readonly source: NeutralDocument["source"];
  readonly id: string;
  readonly kind: NeutralDocument["kind"];
  readonly harness: string;
  readonly harnessDir: string;
  readonly description: string | null;
  readonly body: string;
  readonly nativeTier: NativeTier | null;
  readonly hook: NeutralDocument["hook"];
};

export type ProjectionContentInput = {
  readonly document: NeutralDocument;
  readonly contract: Readonly<
    Pick<ProjectionContract, "harness" | "harnessDir" | "rulesSubdir" | "invocation" | "memoryRoot">
  >;
  readonly absorbedKnowledge: readonly string[];
  readonly nativeTier: NativeTier | null;
};
const tokens = [
  "{{HARNESS_DIR}}",
  "{{AIDLC_INVOKE}}",
  "{{MEMORY_ROOT}}",
  "{{INVOKE}}",
  "{{TOOL_PREFIX}}",
  "{{TRUSTED_NAMESPACE}}",
  "{{OPTION_LETTERS}}",
];
export const renderTokens = ({
  text,
  contract,
}: {
  readonly text: string;
  readonly contract: ProjectionContentInput["contract"];
}): string =>
  text.replace(
    /\{\{HARNESS_DIR\}\}\/rules\/|\{\{(?:HARNESS_DIR|AIDLC_INVOKE|INVOKE|MEMORY_ROOT)\}\}/g,
    (token) => tokenReplacement({ token, contract }),
  );
const tokenReplacement = ({
  token,
  contract,
}: {
  readonly token: string;
  readonly contract: ProjectionContentInput["contract"];
}): string => {
  if (token === "{{HARNESS_DIR}}/rules/") return `${contract.harnessDir}/${contract.rulesSubdir}/`;
  if (token === "{{HARNESS_DIR}}") return contract.harnessDir;
  if (token === "{{MEMORY_ROOT}}") return contract.memoryRoot;
  return contract.invocation;
};
export const residue = ({
  text,
  subject,
}: {
  readonly text: string;
  readonly subject: string;
}): readonly Finding[] =>
  tokens.flatMap((token) =>
    Array.from(text.matchAll(new RegExp(token.replace(/[{}]/g, "\\$&"), "g"))).map((match) =>
      finding({
        code: "unresolved-token",
        subject: subject,
        detail: `${token} at line ${text.slice(0, match.index).split("\n").length}`,
      }),
    ),
  );

export const renderProjection = (input: ProjectionContentInput): Outcome<ProjectionContent> => {
  const { document, contract } = input;
  const subject = documentKey(document);
  const text = [document.body, ...input.absorbedKnowledge].join("\n\n---\n\n");
  const documentBody = document.kind === "asset" ? text : renderTokens({ text, contract });
  const description =
    document.description === null ? null : renderTokens({ text: document.description, contract });
  const hook =
    document.hook === null
      ? null
      : Object.freeze({
          event: document.hook.event,
          command: renderTokens({ text: document.hook.command, contract }),
        });
  const findings = [
    ...residue({ text: description ?? "", subject: `${subject}/description` }),
    ...residue({
      text: documentBody,
      subject: subject,
    }),
    ...residue({
      text: hook?.command ?? "",
      subject: `${subject}/hook`,
    }),
  ];
  if (findings.length > 0) return { status: "invalid", findings };
  const projectedDocument = Object.freeze<ProjectionContent>({
    key: subject,
    source: Object.freeze({ ...document.source }),
    id: document.id,
    kind: document.kind,
    harness: contract.harness,
    harnessDir: contract.harnessDir,
    description,
    body: documentBody,
    nativeTier: input.nativeTier === null ? null : Object.freeze({ ...input.nativeTier }),
    hook,
  });
  return { status: "ok", value: projectedDocument };
};
