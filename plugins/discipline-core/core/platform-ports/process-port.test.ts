import { describe, expect, it, vi } from "vitest";
import { createProcessPort, type ProcessSurface } from "./process-port.ts";

const processSurfaceOver = (surface: Partial<ProcessSurface>): ProcessSurface => ({
  argv: ["/usr/bin/node", "/install/check.ts", "first", "--second"],
  write: vi.fn(),
  setExitCode: vi.fn(),
  ...surface,
});

describe("createProcessPort", () => {
  it("reads the arguments after the script path, excluding the runtime binary and the script", () => {
    expect(createProcessPort({ processSurface: processSurfaceOver({}) }).arguments).toEqual([
      "first",
      "--second",
    ]);
  });

  it("reads no arguments when only the runtime binary and the script are given", () => {
    expect(
      createProcessPort({
        processSurface: processSurfaceOver({ argv: ["/usr/bin/node", "/install/check.ts"] }),
      }).arguments,
    ).toEqual([]);
  });

  it("writes the given text out", () => {
    const write = vi.fn<ProcessSurface["write"]>();

    createProcessPort({ processSurface: processSurfaceOver({ write }) }).writeOut({
      text: "verdict: pass\n",
    });

    expect(write).toHaveBeenCalledWith({ text: "verdict: pass\n" });
  });

  it("sets the exit code given to exitWith", () => {
    const setExitCode = vi.fn<ProcessSurface["setExitCode"]>();

    createProcessPort({ processSurface: processSurfaceOver({ setExitCode }) }).exitWith({ code: 2 });

    expect(setExitCode).toHaveBeenCalledWith({ code: 2 });
  });
});
