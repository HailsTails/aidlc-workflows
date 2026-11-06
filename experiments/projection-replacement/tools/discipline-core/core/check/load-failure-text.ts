import type { RunnerFailure } from "../mechanism-port/runner-failure.ts";
import type { LoadFailure } from "./load-failure.ts";

const escapedLineBreaks = (request: { readonly text: string }): string =>
  request.text.replaceAll("\n", "\\n").replaceAll("\r", "\\r");

const runnerFailureFields = (request: { readonly failure: RunnerFailure }): readonly string[] => {
  switch (request.failure.kind) {
    case "piece-invalid":
      return [request.failure.kind, request.failure.pieceRoot, request.failure.detail];
    case "file-unreadable":
    case "file-unparseable":
      return [request.failure.kind, request.failure.file, request.failure.detail];
    case "tool-failed":
    case "plugin-conflict":
    case "team-config-unloadable":
    case "runner-invalid-output":
      return [request.failure.kind, request.failure.detail];
  }
};

const loadFailureFields = (request: { readonly failure: LoadFailure }): readonly string[] => {
  switch (request.failure.kind) {
    case "arguments-invalid":
    case "git-failed":
      return [request.failure.detail];
    case "install-root-unresolvable":
      return [request.failure.url, request.failure.detail];
    case "file-unreadable":
    case "file-malformed":
    case "rule-set-invalid":
      return [request.failure.path, request.failure.detail];
    case "unsupported-version":
      return [request.failure.path, String(JSON.stringify(request.failure.found))];
    case "reserved-rule-set-name":
    case "unknown-rule-set":
      return [request.failure.name];
    case "unknown-discipline":
    case "unknown-clause":
    case "judgement-clause-selected":
      return [request.failure.address];
    case "mechanism-not-allowed":
    case "piece-missing":
      return [request.failure.address, request.failure.mechanism];
    case "runner-missing":
      return [request.failure.mechanism];
    case "runner-invalid":
      return [request.failure.mechanism, request.failure.detail];
    case "runner-failed":
      return [request.failure.mechanism, ...runnerFailureFields({ failure: request.failure.failure })];
  }
};

export const loadFailureText = (request: { readonly failure: LoadFailure }): string =>
  `${["load failure:", request.failure.kind, ...loadFailureFields(request)]
    .map((text) => escapedLineBreaks({ text }))
    .join(" ")}\n`;
