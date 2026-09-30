type RowShape = { readonly name: string; readonly extra: string };

const buildRow = (rowName: string): RowShape => {
  const built: { name: string; extra: string } = { name: "", extra: "" };
  built.name = rowName;
  built.extra = `${rowName}-derived`;
  return built;
};

export { buildRow };
