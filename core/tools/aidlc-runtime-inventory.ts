type RuntimeFile = Readonly<{ path: string; mode: number; sha256: string }>;

/** Compare the recorded inventory to observed files in collector order; do not repair or reorder evidence. */
export function compareInstalledRuntimeFiles({ expectedFiles, actualFiles }: {
  readonly expectedFiles: readonly unknown[];
  readonly actualFiles: readonly RuntimeFile[];
}): string | null {
  if (expectedFiles.length !== actualFiles.length) {
    return "runtime file inventory does not match the installed baseline";
  }
  let reason: string | null = null;
  // Stop after the first diagnostic, so later malformed entries cannot hide it.
  actualFiles.find((current, index) => {
    reason = runtimeFileMismatch({ expected: expectedFiles[index], current });
    return reason !== null;
  });
  return reason;
}

function runtimeFileMismatch({ expected, current }: {
  readonly expected: unknown;
  readonly current: RuntimeFile;
}): string | null {
  if (
    !expected || (typeof expected !== "object" && typeof expected !== "function") ||
    !("path" in expected) || typeof expected.path !== "string" ||
    !("mode" in expected) || !Number.isInteger(expected.mode) ||
    !("sha256" in expected) || typeof expected.sha256 !== "string" ||
    !/^sha256:[a-f0-9]{64}$/.test(expected.sha256)
  ) {
    return "runtime integrity baseline contains an invalid file entry";
  }
  if (expected.path !== current.path) {
    return "runtime file inventory does not match the installed baseline";
  }
  if (expected.mode !== current.mode || expected.sha256 !== current.sha256) {
    return `runtime file ${current.path} does not match the installed baseline`;
  }
  return null;
}
