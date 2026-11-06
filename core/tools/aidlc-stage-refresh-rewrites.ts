type AcceptedFieldValues = {
  readonly condition: string;
  readonly outputs: string;
  readonly lead_agent: string;
  readonly support_agents: readonly string[];
  readonly reviewer: string;
  readonly produces: readonly string[];
};
type AcceptedField = keyof AcceptedFieldValues;
type AcceptedFieldValue = AcceptedFieldValues[AcceptedField];
type AcceptedRewrite<Field extends AcceptedField> = {
  readonly installed: AcceptedFieldValues[Field];
  readonly candidate: AcceptedFieldValues[Field];
};
type AcceptedRewrites = { readonly [Field in AcceptedField]?: AcceptedRewrite<Field> };
type NonEmptyAcceptedFields = {
  readonly [Field in AcceptedField]: Readonly<Record<Field, AcceptedRewrite<Field>>> & AcceptedRewrites;
}[AcceptedField];
export type AcceptedStageRefreshChange<Effect extends string> = {
  readonly plugin?: string;
  readonly slug: string;
  readonly fields: NonEmptyAcceptedFields;
  readonly effects: readonly [Effect, ...Effect[]];
};
type FieldRewrite = { readonly field: AcceptedField; readonly rewrite: AcceptedRewrite<AcceptedField> };

const acceptedFields = [
  "condition", "outputs", "lead_agent", "support_agents", "reviewer", "produces",
] as const satisfies readonly AcceptedField[];


const fieldRewrites = (args: { readonly change: AcceptedStageRefreshChange<string> }): readonly FieldRewrite[] =>
  acceptedFields.flatMap((field) => {
    const rewrite = args.change.fields[field];
    return rewrite === undefined ? [] : [{ field, rewrite }];
  });

const sameValue = ({ actual, expected }: { readonly actual: unknown; readonly expected: AcceptedFieldValue }): boolean =>
  typeof expected === "string"
    ? actual === expected
    : Array.isArray(actual) && actual.length === expected.length &&
      expected.every((entry, index) => actual[index] === entry);

type ChangeMatch = {
  readonly change: AcceptedStageRefreshChange<string>;
  readonly installed: Readonly<Record<string, unknown>>;
  readonly candidate: Readonly<Record<string, unknown>>;
};

const sharesPlugin = (args: ChangeMatch): boolean =>
  args.change.plugin === undefined ||
  (args.installed.plugin === args.change.plugin && args.candidate.plugin === args.change.plugin);

const acceptsChange = (args: ChangeMatch): boolean =>
  args.installed.slug === args.change.slug && args.candidate.slug === args.change.slug &&
  sharesPlugin(args) &&
  fieldRewrites({ change: args.change }).every(({ field, rewrite }) =>
    sameValue({ actual: args.installed[field], expected: rewrite.installed }) &&
    sameValue({ actual: args.candidate[field], expected: rewrite.candidate }));

const restoredInstalledFields = (args: { readonly changes: readonly AcceptedStageRefreshChange<string>[] }): Readonly<Record<string, AcceptedFieldValue>> =>
  Object.fromEntries(args.changes.flatMap((change) =>
    fieldRewrites({ change }).map(({ field, rewrite }) => [field, rewrite.installed])));


export const rewriteAcceptedStageChanges = <Effect extends string>(args: {
  readonly installed: Readonly<Record<string, unknown>>;
  readonly candidate: Readonly<Record<string, unknown>>;
  readonly changes: readonly AcceptedStageRefreshChange<Effect>[];
}): { readonly candidate: Readonly<Record<string, unknown>>; readonly effects: readonly Effect[] } => {
  const accepted = args.changes.filter((change) => acceptsChange({ change, installed: args.installed, candidate: args.candidate }));
  return { candidate: { ...args.candidate, ...restoredInstalledFields({ changes: accepted }) }, effects: accepted.flatMap((change) => change.effects) };
};
