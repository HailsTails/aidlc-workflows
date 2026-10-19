import { parse, type ParseError } from "jsonc-parser";
import type { Result } from "../../../core/values/result.ts";

export type JsoncParsePort = {
  readonly parse: (request: {
    readonly source: string;
  }) => Result<unknown, { readonly detail: string }>;
};

export type JsoncProviderCall = (request: { readonly source: string }) => {
  readonly value: unknown;
  readonly errors: readonly ParseError[];
};

export const createJsoncParsePort = (options: {
  readonly parseProvider: JsoncProviderCall;
}): JsoncParsePort => ({
  parse: (request) => {
    try {
      const providerParse = options.parseProvider({ source: request.source });
      const firstDiagnostic = providerParse.errors[0];
      if (firstDiagnostic !== undefined) {
        return {
          outcome: "failed",
          error: {
            detail: `JSONC parse error ${firstDiagnostic.error} at offset ${firstDiagnostic.offset} (length ${firstDiagnostic.length})`,
          },
        };
      }
      return { outcome: "ok", value: providerParse.value };
    } catch (thrown) {
      return {
        outcome: "failed",
        error: { detail: thrown instanceof Error ? thrown.message : String(thrown) },
      };
    }
  },
});

const defaultProviderCall: JsoncProviderCall = (request) => {
  const errors: ParseError[] = [];
  const parsedValue: unknown = parse(request.source, errors);
  return { value: parsedValue, errors };
};

export const createDefaultJsoncParsePort = (
  _options: Record<string, never>,
): JsoncParsePort =>
  createJsoncParsePort({
    parseProvider: defaultProviderCall,
  });
