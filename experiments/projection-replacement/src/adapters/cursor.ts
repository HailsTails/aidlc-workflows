import type { HarnessTarget, NativeResource } from "../domain/integration.ts";
import { finding } from "../domain/model.ts";
export const cursorTarget = ({
  harness,
  directory,
}: {
  readonly harness: string;
  readonly directory: string;
}): HarnessTarget => ({
  harness,
  harnessDir: directory,
  render: (document) => {
    const path = `${directory}/aidlc/${document.kind === "agent" ? "agents" : "content"}/${document.id}.md`;
    const resources: NativeResource[] = [{ kind: "file", path, body: document.body }];
    if (
      document.nativeTier !== null &&
      (document.nativeTier.model !== null || document.nativeTier.effort !== null)
    )
      return {
        status: "invalid",
        findings: [
          finding({
            code: "capability-gap",
            subject: document.key,
            detail: "Cursor persona adapter requires inherited model and effort",
          }),
        ],
      };
    if (document.hook !== null)
      resources.push({
        kind: "registration",
        path: `${directory}/hooks/${document.id}.json`,
        body: JSON.stringify({
          version: 1,
          hooks: { sessionStart: [{ command: document.hook.command }] },
        }),
      });
    return { status: "ok", value: resources };
  },
});
