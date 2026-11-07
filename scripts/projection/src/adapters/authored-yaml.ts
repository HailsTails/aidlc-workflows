import { load, JSON_SCHEMA } from "js-yaml";
import { finding, type Outcome } from "../domain/model.ts";

export type AuthoredYaml = {
  readonly decode: (input: { readonly text: string }) => Outcome<unknown>;
};
export const createAuthoredYaml = (): AuthoredYaml => ({
  decode: ({ text }) => {
    try {
      return { status: "ok", value: load(text, { schema: JSON_SCHEMA, json: false }) };
    } catch {
      return {
        status: "invalid",
        findings: [
          finding({
            code: "invalid-input",
            subject: "frontmatter",
            detail: "expected valid YAML with unique mapping keys",
          }),
        ],
      };
    }
  },
});
export const canonicalYamlMappingText = ({ text }: { readonly text: string }): string => {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const indentation = Math.min(
    ...lines
      .filter((line) => line.trim().length > 0)
      .map((line) => line.length - line.trimStart().length),
  );
  return lines.map((line) => (line.trim().length === 0 ? "" : line.slice(indentation))).join("\n");
};
