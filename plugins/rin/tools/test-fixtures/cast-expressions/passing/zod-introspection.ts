import type { ZodObject } from "zod";

const introspectZod = (schema: unknown): ZodObject => schema as ZodObject;

export { introspectZod };
