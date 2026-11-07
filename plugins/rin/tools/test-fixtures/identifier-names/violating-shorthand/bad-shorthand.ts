const handleRequest = (c: { readonly path: string }): string => {
  return c.path;
};

export { handleRequest };
