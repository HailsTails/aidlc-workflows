// TODO(spec-099): rename this for clarity
const trackedToDoExample = (someValue: number): number => {
  // biome-ignore lint/style/noMagicNumbers: literal port number is the API surface (spec-099)
  const portNumber = 8080;
  return someValue + portNumber;
};

export { trackedToDoExample };
