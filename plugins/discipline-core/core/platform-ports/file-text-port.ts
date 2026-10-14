import { accessSync, readFileSync, writeFileSync } from "node:fs";
import type { Result } from "../values/result.ts";

export type FilePresence = "present" | "absent";

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
  readonly exists: (request: { readonly path: string }) => FilePresence;
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

export type FileSystemSurface = {
  readonly readText: (request: { readonly path: string }) => string;
  readonly writeText: (request: {
    readonly path: string;
    readonly text: string;
  }) => void;
  readonly access: (request: { readonly path: string }) => void;
};

const failureDetail = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

export const createFileTextPort = (options: {
  readonly fileSystem: FileSystemSurface;
}): FileTextPort => ({
  read: (request) => {
    try {
      return { outcome: "ok", value: options.fileSystem.readText({ path: request.path }) };
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
  exists: (request) => {
    try {
      options.fileSystem.access({ path: request.path });
      return "present";
    } catch {
      return "absent";
    }
  },
  write: (request) => {
    try {
      options.fileSystem.writeText({ path: request.path, text: request.text });
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

export const defaultFileSystemSurface: FileSystemSurface = {
  readText: (request) => readFileSync(request.path, "utf8"),
  writeText: (request) => {
    writeFileSync(request.path, request.text);
  },
  access: (request) => {
    accessSync(request.path);
  },
};

export const createDefaultFileTextPort = (
  _options: Record<string, never>,
): FileTextPort => createFileTextPort({ fileSystem: defaultFileSystemSurface });
