import type { Linter } from "./lint/eslint-port.ts";
import disciplines from "./disciplines.eslint.mjs";
import { boundaryConfig } from "./lint/boundaries.ts";
import { cleanZoneConfig, INTERIM_READABILITY, interimReadabilityConfig } from "./lint/readability.ts";
import { standardsConfig } from "./lint/standards.ts";

const config: Linter.Config[] = [
  ...standardsConfig,
  ...interimReadabilityConfig(INTERIM_READABILITY),
  ...boundaryConfig,
  ...cleanZoneConfig(disciplines),
];

export default config;
