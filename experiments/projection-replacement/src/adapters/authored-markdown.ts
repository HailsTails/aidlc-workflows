import { finding, type Outcome } from "../domain/model.ts";
import { createAuthoredYaml, canonicalYamlMappingText, type AuthoredYaml } from "./authored-yaml.ts";

export type AuthoredMarkdown = { readonly header: string; readonly body: string; readonly decoded: unknown };
export type AuthoredMarkdownReader = { readonly read: (input: { readonly text: string }) => Outcome<AuthoredMarkdown> };
export type AuthoredMarkdownRules = { readonly canonical: typeof canonicalYamlMappingText };
export const createAuthoredMarkdownRules = (): AuthoredMarkdownRules => ({ canonical: canonicalYamlMappingText });
export const createAuthoredMarkdownReader = ({ yaml = createAuthoredYaml(), rules = createAuthoredMarkdownRules() }: { readonly yaml?: AuthoredYaml; readonly rules?: AuthoredMarkdownRules } = {}): AuthoredMarkdownReader => ({
  read: ({ text }) => {
    const matched = text.replaceAll("\r\n", "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const header = matched?.[1];
    const markdownBody = matched?.[2];
    if (header === undefined || markdownBody === undefined)
      return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "frontmatter", detail: "expected closed YAML frontmatter and a body" })] };
    const canonical = rules.canonical({ text: header });
    const decoded = yaml.decode({ text: canonical });
    if (decoded.status === "invalid") return decoded;
    return { status: "ok", value: { header: canonical, body: markdownBody, decoded: decoded.value } };
  },
});
