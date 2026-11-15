type FlagToken = {
  readonly token: string;
  readonly flag: string;
  readonly attachedValue: string | undefined;
};

const flagTokenOf = (token: string): FlagToken => {
  const separator = token.indexOf("=");
  return token.startsWith("--") && separator > 0
    ? { token, flag: token.slice(0, separator), attachedValue: token.slice(separator + 1) }
    : { token, flag: token, attachedValue: undefined };
};

export { flagTokenOf, type FlagToken };
