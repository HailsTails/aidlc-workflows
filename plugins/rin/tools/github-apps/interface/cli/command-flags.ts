import type { z } from "zod";
import { fail, succeed, type Result } from "../../domain/result.ts";

type CommandFlags = Readonly<Record<string, string | true>>;

type FlagFailure =
  | { readonly kind: "flag-malformed"; readonly token: string }
  | { readonly kind: "flag-repeated"; readonly flag: string }
  | { readonly kind: "flags-invalid"; readonly issues: string };

type FlagReading = { readonly tokens: readonly string[]; readonly collected: CommandFlags };

type FlagValidation<Flags> = { readonly flags: CommandFlags; readonly schema: z.ZodType<Flags> };

const FLAG_PREFIX = "--";

const isFlagToken = (token: string | undefined): token is string =>
  token?.startsWith(FLAG_PREFIX) === true && token.length > FLAG_PREFIX.length;

const readFlags = ({ tokens, collected }: FlagReading): Result<CommandFlags, FlagFailure> => {
  const [token, ...remaining] = tokens;
  if (token === undefined) return succeed(collected);
  if (!isFlagToken(token)) return fail({ kind: "flag-malformed", token });
  const flag = token.slice(FLAG_PREFIX.length);
  if (Object.hasOwn(collected, flag)) return fail({ kind: "flag-repeated", flag });
  const [flagValue, ...afterValue] = remaining;
  if (flagValue === undefined || isFlagToken(flagValue)) {
    return readFlags({ tokens: remaining, collected: { ...collected, [flag]: true } });
  }
  return readFlags({ tokens: afterValue, collected: { ...collected, [flag]: flagValue } });
};

const parseCommandFlags = (tokens: readonly string[]): Result<CommandFlags, FlagFailure> =>
  readFlags({
    tokens: tokens[0] === FLAG_PREFIX ? tokens.slice(1) : tokens,
    collected: {},
  });

const validateFlags = <Flags>({
  flags,
  schema,
}: FlagValidation<Flags>): Result<Flags, FlagFailure> => {
  const validated = schema.safeParse(flags);
  if (!validated.success) {
    return fail({ kind: "flags-invalid", issues: validated.error.message });
  }
  return succeed(validated.data);
};

export { parseCommandFlags, validateFlags, type CommandFlags, type FlagFailure };
