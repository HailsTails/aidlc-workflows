import { z } from "zod";
import type { JsonValue } from "../domain/json-grant.ts";
import type { JsonReader } from "../application/ports.ts";

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

const parsedJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const jsonReader: JsonReader = {
  parse: (text) => {
    const parsed = JsonValueSchema.safeParse(parsedJson(text));
    return parsed.success ? parsed.data : undefined;
  },
};
