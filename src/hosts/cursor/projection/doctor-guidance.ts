import { brand } from "../../../kernel/brand.ts";
import type { FileContent } from "../../../kernel/file-content.ts";
import type { DistributionChannel } from "../../../projection/domain/projected-file.ts";
import type { NativePolicyPrompt, PromptLines } from "../../../projection/domain/native-policy.ts";

export const CURSOR_DOCTOR_COPY = "run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),";
export const CURSOR_DOCTOR_NATIVE = "run `aidlc doctor`,";
const SLOT = "{{SLOT:cursor_doctor_guidance}}";



export const cursorDoctorPrompt = (request: {
  readonly content: FileContent; readonly channel: DistributionChannel;
}): PromptLines | null => {
  const content = request.content;
  const text = content.kind === "text" ? content.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
  const encoded = new TextEncoder().encode(text);
  if (content.kind === "bytes" && (encoded.length !== content.bytes.length
    || !encoded.every((byte, index) => byte === content.bytes[index]))) return null;
  const parts = text.split(SLOT);
  if (parts.length !== 2) return null;
  const [before = "", after = ""] = parts;
  if ((before !== "" && !before.endsWith("\n"))
    || !(after === "" || after.startsWith("\n") || after.startsWith("\r\n"))) return null;
  const lines = Object.freeze(`${before}${request.channel === "copy" ? CURSOR_DOCTOR_COPY
    : CURSOR_DOCTOR_NATIVE}${after}`.split("\n"));
  return request.channel === "copy" ? lines : brand<NativePolicyPrompt>(Object.freeze({
    kind: "native-policy", lines, obligation: CURSOR_DOCTOR_COPY,
  }));
};
