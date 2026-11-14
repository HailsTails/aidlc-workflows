export const strayOutputs = ({ present, expected }: {
  readonly present: readonly string[];
  readonly expected: readonly string[];
}): readonly string[] => {
  const retained = new Set(expected);
  return present.filter((entry) => !retained.has(entry));
};
