const CHECKOUT_BINDING_GIT_VARIABLES = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_PREFIX",
  "GIT_NAMESPACE",
  "GIT_GRAFT_FILE",
  "GIT_INDEX_VERSION",
  "GIT_CEILING_DIRECTORIES",
] as const;

type AmbientEnvironment = Readonly<Record<string, string | undefined>>;

type HermeticGitEnvironment = Readonly<Record<string, string>>;

const isCheckoutBinding = (name: string): boolean =>
  CHECKOUT_BINDING_GIT_VARIABLES.some((binding) => binding === name);

const ambientProcessEnvironment = (): AmbientEnvironment => process.env;

const withoutInheritedGitBindings = ({
  ambient = ambientProcessEnvironment(),
}: {
  readonly ambient?: AmbientEnvironment;
} = {}): Record<string, string> => {
  const retained: Record<string, string> = {};
  Object.entries(ambient).forEach(([name, value]) => {
    if (value === undefined || isCheckoutBinding(name)) return;
    retained[name] = value;
  });
  return retained;
};

const hermeticGitEnvironment = ({
  configHome,
  ambient = ambientProcessEnvironment(),
}: {
  readonly configHome: string;
  readonly ambient?: AmbientEnvironment;
}): HermeticGitEnvironment => ({
  ...withoutInheritedGitBindings({ ambient }),
  HOME: configHome,
  USERPROFILE: configHome,
  GIT_CONFIG_GLOBAL: `${configHome}/.gitconfig`,
  GIT_CONFIG_SYSTEM: `${configHome}/.gitconfig-system`,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_AUTHOR_NAME: "Hermetic Fixture",
  GIT_AUTHOR_EMAIL: "hermetic@fixture.invalid",
  GIT_COMMITTER_NAME: "Hermetic Fixture",
  GIT_COMMITTER_EMAIL: "hermetic@fixture.invalid",
});

export {
  CHECKOUT_BINDING_GIT_VARIABLES,
  type HermeticGitEnvironment,
  hermeticGitEnvironment,
  withoutInheritedGitBindings,
};
