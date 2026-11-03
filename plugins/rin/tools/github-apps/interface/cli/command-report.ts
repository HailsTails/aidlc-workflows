import type { CommandReport } from "./cli-command.ts";

type LabelledReport = { readonly line: string; readonly missingLabels: readonly string[] };

const reportLine = (line: string): CommandReport => ({
  standardOutput: `${line}\n`,
  standardError: "",
});

const missingLabelWarnings = (missingLabels: readonly string[]): string =>
  missingLabels.map((name) => `label "${name}" does not exist; nothing removed\n`).join("");

const reportLabelled = ({ line, missingLabels }: LabelledReport): CommandReport => ({
  ...reportLine(line),
  standardError: missingLabelWarnings(missingLabels),
});

export { reportLabelled, reportLine };
