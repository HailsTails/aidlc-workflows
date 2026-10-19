import { describe, expect, it } from "vitest";
import { absolutePathSchema } from "../../core/values/absolute-path.ts";
import { hermeticGitEnvironment, withoutInheritedGitBindings } from "./hermetic-git-environment.ts";

const CONFIG_HOME = absolutePathSchema.parse("H:\\temporary fixtures\\owned\\home");

describe("withoutInheritedGitBindings", () => {
  it("removes every inherited checkout binding and undefined entry while preserving unrelated defined entries", () => {
    const ambient = Object.freeze({
      GIT_DIR: "inherited directory",
      GIT_WORK_TREE: "inherited worktree",
      GIT_INDEX_FILE: "inherited index",
      GIT_COMMON_DIR: "inherited common directory",
      GIT_OBJECT_DIRECTORY: "inherited object directory",
      GIT_ALTERNATE_OBJECT_DIRECTORIES: "inherited alternates",
      GIT_PREFIX: "inherited prefix",
      GIT_NAMESPACE: "inherited namespace",
      GIT_GRAFT_FILE: "inherited graft file",
      GIT_INDEX_VERSION: "inherited index version",
      GIT_CEILING_DIRECTORIES: "inherited ceiling",
      PATH: "fixture search path",
      GIT_TRACE: "retained trace choice",
      EMPTY: "",
      UNSET: undefined,
    });

    expect(withoutInheritedGitBindings({ ambient })).toStrictEqual({
      PATH: "fixture search path",
      GIT_TRACE: "retained trace choice",
      EMPTY: "",
    });
    expect(ambient.GIT_DIR).toBe("inherited directory");
    expect(Object.hasOwn(ambient, "UNSET")).toBe(true);
  });
});

describe("hermeticGitEnvironment", () => {
  it("uses the supplied ambient record and pins configuration and identities without mutating that record", () => {
    const ambient = Object.freeze({
      PATH: "fixture search path",
      GIT_DIR: "inherited directory",
      HOME: "developer home",
      USERPROFILE: "developer profile",
      GIT_CONFIG_GLOBAL: "developer global config",
      GIT_CONFIG_SYSTEM: "developer system config",
      GIT_CONFIG_NOSYSTEM: "0",
      GIT_TERMINAL_PROMPT: "1",
      GIT_AUTHOR_NAME: "developer author",
      GIT_AUTHOR_EMAIL: "developer author email",
      GIT_COMMITTER_NAME: "developer committer",
      GIT_COMMITTER_EMAIL: "developer committer email",
      UNSET: undefined,
    });

    expect(hermeticGitEnvironment({ configHome: CONFIG_HOME, ambient })).toStrictEqual({
      outcome: "ok",
      value: {
        PATH: "fixture search path",
        HOME: CONFIG_HOME,
        USERPROFILE: CONFIG_HOME,
        GIT_CONFIG_GLOBAL: "H:\\temporary fixtures\\owned\\home/.gitconfig",
        GIT_CONFIG_SYSTEM: "H:\\temporary fixtures\\owned\\home/.gitconfig-system",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0",
        GIT_AUTHOR_NAME: "Hermetic Fixture",
        GIT_AUTHOR_EMAIL: "hermetic@fixture.invalid",
        GIT_COMMITTER_NAME: "Hermetic Fixture",
        GIT_COMMITTER_EMAIL: "hermetic@fixture.invalid",
      },
    });
    expect(ambient.HOME).toBe("developer home");
    expect(ambient.GIT_AUTHOR_NAME).toBe("developer author");
  });
});
