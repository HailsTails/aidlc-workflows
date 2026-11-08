import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapabilityId, ProbeResult } from "../domain/capability-exclusion.ts";
import type { Capabilities } from "../application/ports.ts";

const LONG_NAME = "aidlc-gate-probe-long-name.txt";

const inScratch = <T>(use: (directory: string) => T): T => {
  const directory = mkdtempSync(join(tmpdir(), "aidlc-gate-probe-"));
  try {
    return use(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const symlinks = (): ProbeResult =>
  inScratch((directory) => {
    try {
      writeFileSync(join(directory, "target"), "x");
      symlinkSync(join(directory, "target"), join(directory, "link"));
      return { available: true, evidence: "creating a symlink works" };
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "refused";
      return { available: false, evidence: `creating a symlink is refused (${code})` };
    }
  });

const shortNames = (): ProbeResult => {
  if (process.platform !== "win32") {
    return { available: true, evidence: "not a Windows volume" };
  }
  return inScratch((directory) => {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, LONG_NAME), "x");
    const listing = Bun.spawnSync(["cmd.exe", "/d", "/c", "dir", "/x"], { cwd: directory });
    const entry = listing.stdout.toString().split(/\r?\n/).find((line) => line.includes(LONG_NAME));
    const hasShortName = entry !== undefined && /~\d/.test(entry);
    return {
      available: hasShortName,
      evidence: hasShortName ? "8.3 short names are on" : "8.3 short names are off on this volume",
    };
  });
};

const listableSystemTemp = (): ProbeResult => {
  const directory = join(process.env["SystemRoot"] ?? "C:\\Windows", "Temp");
  try {
    readdirSync(directory);
    return { available: true, evidence: "the system temp folder can be listed" };
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "refused";
    return { available: false, evidence: `the system temp folder cannot be listed (${code})` };
  }
};

const PROBES: Readonly<Record<CapabilityId, () => ProbeResult>> = {
  symlinks,
  "short-names": shortNames,
  "listable-system-temp": listableSystemTemp,
};

export const capabilityProbes = (): Capabilities => {
  const cache = new Map<CapabilityId, ProbeResult>();
  return {
    probe: (id) => {
      const known = cache.get(id) ?? PROBES[id]();
      cache.set(id, known);
      return known;
    },
  };
};
