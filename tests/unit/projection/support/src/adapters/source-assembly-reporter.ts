import type { Outcome } from "../../../../../../scripts/projection/src/domain/model.ts";
export type SourceAssemblyReporter = { readonly finish: (input: { readonly outcome: Outcome<string> }) => void };
export type SourceAssemblyReportOperations = {
  readonly write: (input: { readonly channel: "out" | "error"; readonly text: string }) => void;
  readonly complete: (input: { readonly exitCode: 0 | 1 }) => void;
};
export const createSourceAssemblyReportOperations = (): SourceAssemblyReportOperations => ({
  write: ({ channel, text }) => { (channel === "out" ? process.stdout : process.stderr).write(text); },
  complete: ({ exitCode }) => { process.exitCode = exitCode; },
});
export const createSourceAssemblyReporter = ({ operations = createSourceAssemblyReportOperations() }: { readonly operations?: SourceAssemblyReportOperations } = {}): SourceAssemblyReporter => ({
  finish: ({ outcome }) => {
    if (outcome.status === "invalid") {
      operations.write({ channel: "error", text: `${outcome.findings.map((entry) => `${entry.code}: ${entry.subject}: ${entry.detail}`).join("\n")}\n` });
      operations.complete({ exitCode: 1 });
      return;
    }
    operations.write({ channel: "out", text: outcome.value });
    operations.complete({ exitCode: 0 });
  },
});
