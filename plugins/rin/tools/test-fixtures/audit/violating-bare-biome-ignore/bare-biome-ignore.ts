const portNumberWithUntrackedIgnore = (multiplier: number): number => {
  // biome-ignore lint/style/noMagicNumbers: literal port number is the API surface
  const portNumber = 8080;
  return portNumber * multiplier;
};

export { portNumberWithUntrackedIgnore };
