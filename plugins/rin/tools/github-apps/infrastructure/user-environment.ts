import { homedir } from "node:os";

type UserEnvironment = {
  readonly variable: (name: string) => string | undefined;
  readonly homeDirectory: () => string;
};

const createProcessUserEnvironment = (): UserEnvironment => ({
  variable: (name) => process.env[name],
  homeDirectory: () => homedir(),
});

export { createProcessUserEnvironment, type UserEnvironment };
