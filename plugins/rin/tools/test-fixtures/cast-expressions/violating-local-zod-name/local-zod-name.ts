type ZodInternalCarrier = { readonly _zod: { readonly def: unknown } };

const asCarrier = (schema: unknown): ZodInternalCarrier =>
  schema as ZodInternalCarrier;

export { asCarrier };
