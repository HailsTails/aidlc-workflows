type RowShape = { readonly name: string };
type AllResult = { readonly value: unknown };

const narrowSqliteRows = (allResult: AllResult): ReadonlyArray<RowShape> => {
  return allResult.value as ReadonlyArray<RowShape>;
};

export { narrowSqliteRows };
