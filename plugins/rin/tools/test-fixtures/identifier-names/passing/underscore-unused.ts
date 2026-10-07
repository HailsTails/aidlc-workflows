const indexEach = (entries: readonly string[]): readonly number[] => {
  return entries.map((_entry, indexPosition) => indexPosition);
};

const ignoreErrorContent = (_caughtError: unknown): void => {
  return;
};

export { ignoreErrorContent, indexEach };
