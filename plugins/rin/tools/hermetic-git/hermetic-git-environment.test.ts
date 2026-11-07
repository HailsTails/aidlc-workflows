import { describe, expect, test } from "vitest";
import {
  CHECKOUT_BINDING_GIT_VARIABLES,
  hermeticGitEnvironment,
  withoutInheritedGitBindings,
} from "./hermetic-git-environment.ts";

const CONFIG_HOME = "/tmp/hermetic-home";

describe("withoutInheritedGitBindings", () => {
  test("omits the key entirely rather than leaving an undefined value", () => {
    const retained = withoutInheritedGitBindings({
      ambient: { GIT_DIR: "/leaked/.git", PATH: "/usr/bin" },
    });

    expect(Object.hasOwn(retained, "GIT_DIR")).toBe(false);
  });

  test("drops every checkout-binding variable", () => {
    const ambient = Object.fromEntries(
      CHECKOUT_BINDING_GIT_VARIABLES.map((name) => [name, "leaked"]),
    );

    const retained = withoutInheritedGitBindings({ ambient });

    expect(Object.keys(retained)).toEqual([]);
  });

  test("keeps unrelated ambient variables", () => {
    const retained = withoutInheritedGitBindings({
      ambient: { PATH: "/usr/bin", GIT_DIR: "/leaked/.git" },
    });

    expect(retained).toEqual({ PATH: "/usr/bin" });
  });

  test("omits keys whose ambient value is undefined", () => {
    const retained = withoutInheritedGitBindings({
      ambient: { EMPTY: undefined, PATH: "/usr/bin" },
    });

    expect(Object.hasOwn(retained, "EMPTY")).toBe(false);
  });
});

describe("hermeticGitEnvironment", () => {
  test("pins the config home away from the developer's real home", () => {
    const environment = hermeticGitEnvironment({
      configHome: CONFIG_HOME,
      ambient: { HOME: "/home/developer" },
    });

    expect(environment["HOME"]).toBe(CONFIG_HOME);
  });

  test("redirects the global git config into the pinned home", () => {
    const environment = hermeticGitEnvironment({
      configHome: CONFIG_HOME,
      ambient: {},
    });

    expect(environment["GIT_CONFIG_GLOBAL"]).toBe(`${CONFIG_HOME}/.gitconfig`);
  });

  test("disables the system git config", () => {
    const environment = hermeticGitEnvironment({
      configHome: CONFIG_HOME,
      ambient: {},
    });

    expect(environment["GIT_CONFIG_NOSYSTEM"]).toBe("1");
  });

  test("strips a leaked GIT_DIR from the ambient environment", () => {
    const environment = hermeticGitEnvironment({
      configHome: CONFIG_HOME,
      ambient: { GIT_DIR: "/shared/checkout/.git" },
    });

    expect(Object.hasOwn(environment, "GIT_DIR")).toBe(false);
  });

  test("supplies a committer identity so a commit needs no repository config", () => {
    const environment = hermeticGitEnvironment({
      configHome: CONFIG_HOME,
      ambient: {},
    });

    expect(environment["GIT_COMMITTER_EMAIL"]).toBe("hermetic@fixture.invalid");
  });
});
