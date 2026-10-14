import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Result } from "../values/result.ts";

export type FileTextPort = {
  readonly read: (request: {
    readonly path: string;
  }) => Result<
    string,
    {
      readonly kind: "unreadable";
      readonly path: string;
      readonly detail: string;
    }
  >;
  readonly exists: (request: { readonly path: string }) => boolean;
  readonly write: (request: {
    readonly path: string;
    readonly text: string;
  }) => Result<
    void,
    {
      readonly kind: "unwritable";
      readonly path: string;
      readonly detail: string;
    }
  >;
};

const failureDetail = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

export const createFileTextPort = (
  _options: Record<string, never>,
): FileTextPort => ({
  read: (request) => {
    try {
      return { outcome: "ok", value: readFileSync(request.path, "utf8") };
    } catch (thrown) {
      return {
        outcome: "failed",
        error: {
          kind: "unreadable",
          path: request.path,
          detail: failureDetail({ thrown }),
        },
      };
    }
  },
  exists: (request) => existsSync(request.path),
  write: (request) => {
    try {
      writeFileSync(request.path, request.text);
      return { outcome: "ok", value: undefined };
    } catch (thrown) {
      return {
        outcome: "failed",
        error: {
          kind: "unwritable",
          path: request.path,
          detail: failureDetail({ thrown }),
        },
      };
    }
  },
});
