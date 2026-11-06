import type { HarnessTarget, NativeResource } from "../domain/integration.ts";
import type { ProjectionContent } from "../domain/projection-content.ts";
const sessionStartEvent = "SessionStart";
const markdown = (document: ProjectionContent): string => {
  if (document.kind !== "agent") return document.body;
  const fields = [
    `name: ${JSON.stringify(document.id)}`,
    `description: ${JSON.stringify(document.description)}`,
    ...(document.nativeTier?.model ? [`model: ${JSON.stringify(document.nativeTier.model)}`] : []),
    ...(document.nativeTier?.effort
      ? [`effort: ${JSON.stringify(document.nativeTier.effort)}`]
      : []),
  ];
  return `---\n${fields.join("\n")}\n---\n\n${document.body}\n`;
};
export const claudeTarget = ({
  harness,
  directory,
}: {
  readonly harness: string;
  readonly directory: string;
}): HarnessTarget => ({
  harness,
  harnessDir: directory,
  render: (document) => {
    const path = `${directory}/${document.kind === "agent" ? "agents" : "content"}/${document.id}.md`;
    const resources: NativeResource[] = [{ kind: "file", path, body: markdown(document) }];
    if (document.hook !== null)
      resources.push({
        kind: "registration",
        path: `${directory}/hooks/${document.id}.json`,
        body: JSON.stringify({
          hooks: {
            [sessionStartEvent]: [{ hooks: [{ type: "command", command: document.hook.command }] }],
          },
        }),
      });
    return { status: "ok", value: resources };
  },
});
