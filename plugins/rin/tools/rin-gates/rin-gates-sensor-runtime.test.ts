import { describe, expect, test, vi } from "vitest";
import {
  defaultSensorRuntime,
  type SensorProcess,
} from "./rin-gates-sensor-runtime.ts";

describe("defaultSensorRuntime", () => {
  test("binds arguments, working directory and output to one process capability", () => {
    const cwd = vi
      .fn<SensorProcess["cwd"]>()
      .mockReturnValue("/sensor-workspace");
    const write = vi.fn<SensorProcess["stdout"]["write"]>();
    const runtime = defaultSensorRuntime({
      nodeProcess: {
        argv: ["bun", "sensor.ts", "--stage", "rin-gate-2-plan-review"],
        cwd,
        stdout: { write },
      },
    });

    expect(runtime.commandLineArguments()).toEqual([
      "--stage",
      "rin-gate-2-plan-review",
    ]);
    expect(runtime.projectDirectory()).toBe("/sensor-workspace");
    runtime.writeOutput({ text: "report\n" });
    expect(cwd).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledExactlyOnceWith("report\n");
  });
});
