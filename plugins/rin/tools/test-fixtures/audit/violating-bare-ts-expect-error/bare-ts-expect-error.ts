const callerWithUntrackedExpectError = (untypedInput: unknown): string => {
  // @ts-expect-error untyped boundary
  return untypedInput.toString();
};

export { callerWithUntrackedExpectError };
