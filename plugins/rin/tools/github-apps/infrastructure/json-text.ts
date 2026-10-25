import { fail, succeed, type Result } from "../domain/result.ts";

type JsonInvalid = { readonly kind: "json-invalid" };

const parseJsonText = (jsonText: string): Result<unknown, JsonInvalid> => {
  try {
    return succeed(JSON.parse(jsonText));
  } catch {
    return fail({ kind: "json-invalid" });
  }
};

export { parseJsonText, type JsonInvalid };
