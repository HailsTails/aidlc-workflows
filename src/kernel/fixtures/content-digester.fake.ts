import type { BunDigestLib } from "../content-digester.ts";

export type RecordingDigestLib = BunDigestLib & { readonly received: readonly (string | Uint8Array)[] };

export const recordingDigestLib = ({ hex }: { readonly hex: string }): RecordingDigestLib => {
  const received: (string | Uint8Array)[] = [];
  return {
    received,
    hexDigest: (message) => {
      received.push(message);
      return hex;
    },
  };
};
