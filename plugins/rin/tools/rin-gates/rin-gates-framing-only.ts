import { markdownLinesOf } from "./rin-gates-markdown-lines.ts";
import { lineLocation, type SensorFinding } from "./rin-gates-sensor-report.ts";

const PROGRAMMING_LANGUAGES: ReadonlySet<string> = new Set([
  "c",
  "c#",
  "c++",
  "cjs",
  "clojure",
  "cpp",
  "cs",
  "csharp",
  "cts",
  "dart",
  "elixir",
  "erlang",
  "fsharp",
  "go",
  "golang",
  "graphql",
  "gql",
  "haskell",
  "java",
  "javascript",
  "js",
  "jsx",
  "kotlin",
  "kt",
  "lua",
  "mjs",
  "mts",
  "objc",
  "objective-c",
  "ocaml",
  "perl",
  "php",
  "proto",
  "protobuf",
  "py",
  "python",
  "r",
  "rb",
  "ruby",
  "rs",
  "rust",
  "scala",
  "sql",
  "swift",
  "ts",
  "tsx",
  "typescript",
  "zig",
]);

const FRAMING_ONLY_CHECK = "framing-only/programming-language-fence";

const programmingFenceFindings = ({
  artefact,
  markdownText,
}: {
  readonly artefact: string;
  readonly markdownText: string;
}): readonly SensorFinding[] =>
  markdownLinesOf({ markdownText }).flatMap((markdownLine) => {
    if (
      markdownLine.region.kind !== "fence-open" ||
      !PROGRAMMING_LANGUAGES.has(markdownLine.region.language)
    ) {
      return [];
    }
    return [
      {
        check: FRAMING_ONLY_CHECK,
        artefact,
        location: lineLocation({ lineNumber: markdownLine.lineNumber }),
        subject: `a \`${markdownLine.region.language}\` code fence`,
        remedy:
          "Gate 2 is prose and diagrams: describe the shape in prose or mermaid, and quote existing code as evidence in a `text` fence. Signatures and code belong to Gate 3.",
      },
    ];
  });

export { PROGRAMMING_LANGUAGES, programmingFenceFindings };
