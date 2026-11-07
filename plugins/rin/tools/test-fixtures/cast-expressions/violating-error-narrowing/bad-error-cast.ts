const errorCode = (caught: unknown): string => {
  return (caught as NodeJS.ErrnoException).code ?? "unknown";
};

export { errorCode };
