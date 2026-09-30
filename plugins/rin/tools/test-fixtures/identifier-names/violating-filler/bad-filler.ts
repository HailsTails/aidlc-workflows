const processUserRequest = (data: { readonly name: string }): string => {
  const result = data.name.toUpperCase();
  return result;
};

export { processUserRequest };
