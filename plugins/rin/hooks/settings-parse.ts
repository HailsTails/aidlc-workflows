import { readFileSync } from "node:fs";
import { z } from "zod";

const preToolUseEntrySchema = z
  .object({
    matcher: z.string(),
    // An array, not a one-tuple: a single matcher legitimately carries several
    // hook bodies, and the projected settings does exactly that. A tuple made
    // every such document fail the shape check, which the caller reports as
    // "unreadable" — indistinguishable from corrupt JSON.
    hooks: z
      .array(z.object({ type: z.literal("command"), command: z.string() }))
      .nonempty(),
  })
  .passthrough();

const settingsSchema = z
  .object({
    hooks: z
      .object({
        PreToolUse: z.array(preToolUseEntrySchema),
      })
      .passthrough(),
  })
  .passthrough();

type SettingsJson = z.infer<typeof settingsSchema>;

type PreToolUseRegistration = z.infer<typeof preToolUseEntrySchema>;

type SettingsReadFailure =
  | { reason: "unreadable"; detail: string }
  | { reason: "invalid-shape" };

type SettingsReadResult =
  | { outcome: "parsed"; settings: SettingsJson }
  | { outcome: "failed"; failure: SettingsReadFailure };

const decodeJson = (
  raw: string,
): { decoded: unknown } | { failure: SettingsReadFailure } => {
  try {
    return { decoded: JSON.parse(raw) };
  } catch (decodeError) {
    return {
      failure: { reason: "unreadable", detail: String(decodeError) },
    };
  }
};

const parseSettings = (raw: string): SettingsReadResult => {
  const decodeResult = decodeJson(raw);
  if ("failure" in decodeResult) {
    return { outcome: "failed", failure: decodeResult.failure };
  }
  const parsed = settingsSchema.safeParse(decodeResult.decoded);
  if (!parsed.success) {
    return { outcome: "failed", failure: { reason: "invalid-shape" } };
  }
  return { outcome: "parsed", settings: parsed.data };
};

type SettingsFileReader = (path: string) => string;

const defaultSettingsFileReader: SettingsFileReader = (path) =>
  readFileSync(path, "utf-8");

const readSettingsFile = (input: {
  path: string;
  readFile?: SettingsFileReader;
}): SettingsReadResult => {
  const readFile = input.readFile ?? defaultSettingsFileReader;
  try {
    return parseSettings(readFile(input.path));
  } catch (readError) {
    return {
      outcome: "failed",
      failure: { reason: "unreadable", detail: String(readError) },
    };
  }
};

export type {
  PreToolUseRegistration,
  SettingsFileReader,
  SettingsJson,
  SettingsReadFailure,
  SettingsReadResult,
};
export { defaultSettingsFileReader, parseSettings, readSettingsFile };
