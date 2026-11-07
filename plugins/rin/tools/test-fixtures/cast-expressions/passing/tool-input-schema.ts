type Tool = { readonly inputSchema: { readonly type: string } };

const adaptToToolInputSchema = (jsonSchema: unknown): Tool["inputSchema"] => {
  return jsonSchema as Tool["inputSchema"];
};

export { adaptToToolInputSchema };
