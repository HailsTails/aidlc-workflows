import type { HarnessTarget } from "../domain/native-rendering.ts";
import { finding } from "../domain/model.ts";
export const sensorTarget = ({
  harness,
  directory,
  sensorDirectory,
}: {
  readonly harness: string;
  readonly directory: string;
  readonly sensorDirectory: string;
}): HarnessTarget => ({
  harness,
  harnessDir: directory,
  render: (document) => {
    if (document.kind !== "text")
      return {
        status: "invalid",
        findings: [
          finding({
            code: "unsupported-document-kind",
            subject: document.key,
            detail: "sensor descriptors require text documents",
          }),
        ],
      };
    return {
      status: "ok",
      value: [{ kind: "file", path: `${sensorDirectory}/${document.id}.md`, body: document.body }],
    };
  },
});
