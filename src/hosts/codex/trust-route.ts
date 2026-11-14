import { z } from "zod";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { joinNativePath } from "../../kernel/native-path.ts";
import type { Terminal } from "../../kernel/terminal-port.ts";
import type { SettingsCapabilities } from "../../projection/application/ports/settings.ts";
import type { ChannelTokens } from "../../projection/domain/template-token.ts";
import { trustEntries } from "./projection/settings-renderer.ts";

const usage = "usage: package.ts codex trust --project <abs-dir> [--hooks-json <abs-path>]";
const pathQualification = (path: string): "absolute" | "relative" => (path.startsWith("\\\\") || path.startsWith("//")
  ? /^[\\/]{2}[^\\/]+[\\/][^\\/]+(?:[\\/]|$)/.test(path)
  : path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path)) ? "absolute" : "relative";

const option = z.object({ flag: z.string(), value: z.string().optional() }).transform(({ flag, value: pathArgument }, validation) => {
  if (flag !== "--project" && flag !== "--hooks-json") {
    validation.addIssue({ code: "custom", message: `unknown argument "${flag}"` });
    return z.NEVER;
  }
  if (!pathArgument || pathArgument.startsWith("--")) {
    validation.addIssue({ code: "custom", message: `${flag} requires an absolute path` });
    return z.NEVER;
  }
  if (pathQualification(pathArgument) === "relative") {
    validation.addIssue({ code: "custom", message: `${flag} must be a fully qualified absolute path` });
    return z.NEVER;
  }
  return { flag, value: pathArgument };
});

type Options = { readonly project: string | null; readonly hooksJson: string | null };
const collectOption = (state: Result<Options, string>, pair: { readonly flag: string; readonly value: string | undefined }): Result<Options, string> => {
  if (!state.ok) return state;
  const parsed = option.safeParse(pair);
  if (!parsed.success) return refused(parsed.error.issues[0]?.message ?? "invalid arguments");
  const key = parsed.data.flag === "--project" ? "project" : "hooksJson";
  return state.value[key] === null ? accepted({ ...state.value, [key]: parsed.data.value })
    : refused(`${parsed.data.flag} may be specified only once`);
};

const argumentsSchema = z.array(z.string()).transform((argv, validation) => {
  const parsed = argv.flatMap((flag, index) => index % 2 === 0 ? [{ flag, value: argv[index + 1] }] : [])
    .reduce<Result<Options, string>>(collectOption, accepted({ project: null, hooksJson: null }));
  if (!parsed.ok) {
    validation.addIssue({ code: "custom", message: parsed.refusal });
    return z.NEVER;
  }
  if (parsed.value.project === null) {
    validation.addIssue({ code: "custom", message: "--project is required" });
    return z.NEVER;
  }
  return { project: parsed.value.project, hooksJson: parsed.value.hooksJson };
});

export const codexTrustRoutes = ({ terminal, settings, copyTokens }: {
  readonly terminal: Terminal;
  readonly settings: SettingsCapabilities;
  readonly copyTokens: ChannelTokens;
}): readonly { readonly verb: readonly string[]; run(argv: readonly string[]): Promise<0 | 1 | 2> }[] => [{
  verb: ["codex", "trust"],
  run: async (argv) => {
    const parsed = argumentsSchema.safeParse(argv);
    if (!parsed.success) {
      terminal.writeError(`codex trust: ${parsed.error.issues[0]?.message ?? "invalid arguments"}\n`);
      terminal.writeError(`${usage}\n`);
      return 1;
    }
    const invoke = copyTokens.INVOKE;
    if (invoke === null) {
      terminal.writeError("trusted route invocation is required\n");
      return 1;
    }
    const trusted = trustEntries({ hooksJsonPath: parsed.data.hooksJson ?? joinNativePath({
      base: parsed.data.project, segments: [".codex", "hooks.json"] }),
    harnessName: "codex", invoke, trustedNamespace: copyTokens.TRUSTED_NAMESPACE ?? undefined }, settings);
    if (!trusted.ok) {
      terminal.writeError(`${trusted.refusal.reason}\n`);
      return 1;
    }
    terminal.write(`${trusted.value}\n`);
    return 0;
  },
}];
