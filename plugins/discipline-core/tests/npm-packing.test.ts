import { describe, expect, it } from "vitest";
import { inMemoryFiles } from "./in-memory-files.ts";
import { type CommandRun, npmPacking } from "./npm-packing.ts";

const PACK: CommandRun = { command: "npm", arguments: ["pack", "--pack-destination", "/work/tarball", "/work/build"], directory: "/package" };

const CI: CommandRun = { command: "npm", arguments: ["ci"], directory: "/deps" };

describe("npmPacking", () => {
  it("writes the named tarball into the pack destination with the text for each pack's count, and records every run", () => {
    const files = inMemoryFiles({ initial: {} });
    const npm = npmPacking({ files, tarballName: "core-0.0.0.tgz", tarballText: ({ packCount }) => `tarball ${packCount}` });

    const exits = [npm.commands.run(CI), npm.commands.run(PACK), npm.commands.run(PACK)];

    expect({ exits, runs: npm.runs(), texts: files.texts() }).toEqual({
      exits: [
        { outcome: "exited", exitCode: 0, output: "" },
        { outcome: "exited", exitCode: 0, output: "" },
        { outcome: "exited", exitCode: 0, output: "" },
      ],
      runs: [CI, PACK, PACK],
      texts: { "/work/tarball/core-0.0.0.tgz": "tarball 2" },
    });
  });

  it("writes nothing for a run that does not pack", () => {
    const files = inMemoryFiles({ initial: {} });
    const npm = npmPacking({ files, tarballName: "core-0.0.0.tgz", tarballText: () => "tarball" });

    npm.commands.run(CI);

    expect(files.texts()).toEqual({});
  });
});
