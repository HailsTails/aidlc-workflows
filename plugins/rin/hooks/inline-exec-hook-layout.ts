import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultFileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";

const INLINE_EXEC_HOOK = "block-inline-exec.ts";

const SIBLING_TOOLS_IMPORT = /from\s+"\.\.\/tools\/([^"/]+)"/g;
const RELATIVE_IMPORT = /from\s+"(\.{1,2}\/[^"]+)"/g;

const paths = defaultPathOperations();
const files = defaultFileTextPort();

const sourceHooksDirectory = paths.dirname({
  path: paths.fromFileUrl({ url: import.meta.url }),
});

const sourceToolsDirectory = paths.join({
  segments: [sourceHooksDirectory, "..", "tools"],
});

const relativeImportsOf = ({
  source,
}: {
  readonly source: string;
}): readonly string[] =>
  [...source.matchAll(RELATIVE_IMPORT)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );

const siblingToolsImportsOf = ({
  source,
}: {
  readonly source: string;
}): readonly string[] =>
  [...source.matchAll(SIBLING_TOOLS_IMPORT)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );

const hookSource = ({
  hookFileName,
}: {
  readonly hookFileName: string;
}): string =>
  files.read(paths.join({ segments: [sourceHooksDirectory, hookFileName] }));

const toolSource = ({ toolFileName }: { readonly toolFileName: string }): string =>
  files.read(paths.join({ segments: [sourceToolsDirectory, toolFileName] }));

const portsImportedBy = ({
  hookFileName,
}: {
  readonly hookFileName: string;
}): readonly string[] =>
  siblingToolsImportsOf({ source: hookSource({ hookFileName }) });

const installHookWithPorts = ({
  harnessDirectory,
  hookFileName,
  hookText,
}: {
  readonly harnessDirectory: string;
  readonly hookFileName: string;
  readonly hookText?: string;
}): string => {
  const hooksDirectory = paths.join({ segments: [harnessDirectory, "hooks"] });
  const toolsDirectory = paths.join({ segments: [harnessDirectory, "tools"] });
  files.mkdir(hooksDirectory, { recursive: true });
  files.mkdir(toolsDirectory, { recursive: true });
  portsImportedBy({ hookFileName }).forEach((toolFileName) => {
    files.write(
      paths.join({ segments: [toolsDirectory, toolFileName] }),
      toolSource({ toolFileName }),
    );
  });
  const hookPath = paths.join({ segments: [hooksDirectory, hookFileName] });
  files.write(hookPath, hookText ?? hookSource({ hookFileName }));
  return hookPath;
};

const installInlineExecHook = ({
  harnessDirectory,
}: {
  readonly harnessDirectory: string;
}): string =>
  installHookWithPorts({ harnessDirectory, hookFileName: INLINE_EXEC_HOOK });

export {
  hookSource,
  INLINE_EXEC_HOOK,
  installHookWithPorts,
  installInlineExecHook,
  portsImportedBy,
  relativeImportsOf,
  toolSource,
};
