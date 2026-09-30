import { readFileSync } from "node:fs";
import type { SensorFileReader, TextRead } from "./rin-gates-sensor-report.ts";

type ReadUtf8 = (request: { readonly path: string }) => string;

const ABSENT_FILE_ERROR_CODES: ReadonlySet<string> = new Set([
  "ENOENT",
  "ENOTDIR",
]);

const readFailureOf = ({ error }: { readonly error: unknown }): TextRead => {
  if (!(error instanceof Error)) {
    return { kind: "unreadable", reason: String(error) };
  }
  const code = "code" in error ? error.code : undefined;
  return typeof code === "string" && ABSENT_FILE_ERROR_CODES.has(code)
    ? { kind: "absent" }
    : { kind: "unreadable", reason: error.message };
};

const readUtf8FromDisk: ReadUtf8 = ({ path }) => readFileSync(path, "utf8");

const defaultSensorFileReader = (
  { readUtf8 }: { readonly readUtf8: ReadUtf8 } = {
    readUtf8: readUtf8FromDisk,
  },
): SensorFileReader => ({
  readText: ({ path }) => {
    try {
      return { kind: "present", text: readUtf8({ path }) };
    } catch (error) {
      return readFailureOf({ error });
    }
  },
});

export { defaultSensorFileReader, type ReadUtf8 };
