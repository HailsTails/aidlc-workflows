import type { HarnessTarget } from "../src/domain/native-rendering.ts";
export const rinNativeTarget = ({ base }: { readonly base: HarnessTarget }): HarnessTarget => ({
  harness: base.harness,
  harnessDir: base.harnessDir,
  render: (document) => {
    if (
      document.source.kind === "plugin" &&
      document.source.id === "rin" &&
      document.kind === "asset"
    )
      return {
        status: "ok",
        value: [
          {
            kind: "file",
            path: `${base.harnessDir}/aidlc/examples/${document.id}.json`,
            body: document.body,
          },
        ],
      };
    return base.render(document);
  },
});
