import { declareLegacyProducedFile } from "../../../projection/domain/legacy-native-source.ts";
import { kiroIdeSteering } from "../../../../core/tools/aidlc-includes.ts";
import type { HostFileDeriver } from "../../../projection/application/ports/harness.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";

import type { FileContent } from "../../../kernel/file-content.ts";

// A text value is already decoded. Its transport signature is distinct from
// the payload, including a leading payload BOM. Raw bytes keep frozen decoding.
const capturedMemoryBytes = (content: FileContent): FileContent => content.kind === "bytes" ? content
  : { kind: "bytes", bytes: new TextEncoder().encode(`\uFEFF${content.text}`) };

const STEERING_PATH = ".kiro/steering/aidlc-active-memory.md";

export const deriveKiroIdeSteering: HostFileDeriver = ({ files, frame, legacyNative }) => frame.render({
  files: files.filter((file) => file.path.startsWith("aidlc/spaces/default/memory/"))
    .map((file) => ({ ...file, content: capturedMemoryBytes(file.content) })),
  render: (projectRoot) => {
    const path = projectPath(STEERING_PATH);
    if (!path.ok) return refused({ kind: "render-failed", concept: "onboarding", name: STEERING_PATH,
      reason: "The steering destination must be project-relative." });
    return accepted([declareLegacyProducedFile({ context: legacyNative, file: { path: path.value, mode: "regular",
      content: { kind: "text", text: kiroIdeSteering(projectRoot, "default").text },
      origin: { kind: "rendered", concept: "onboarding", name: STEERING_PATH } } })]);
  },
});
