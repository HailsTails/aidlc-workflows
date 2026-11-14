import piece0 from "./.cache/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";
import piece1 from "./.cache/discipline-core/mechanisms/eslint/CD-1/cd1/cd1.eslint-plugin.ts";
import piece2 from "./.cache/discipline-core/mechanisms/eslint/CD-10/cd10/cd10.eslint-plugin.ts";
import piece3 from "./.cache/discipline-core/mechanisms/eslint/CD-27/cd27/cd27.eslint-plugin.ts";
import piece4 from "./.cache/discipline-core/mechanisms/eslint/CD-40/cd40/cd40.eslint-plugin.ts";
import piece5 from "./.cache/discipline-core/mechanisms/eslint/CD-41/cd41/cd41.eslint-plugin.ts";
import piece6 from "./.cache/discipline-core/mechanisms/eslint/CD-42/cd42/cd42.eslint-plugin.ts";
import piece7 from "./.cache/discipline-core/mechanisms/eslint/CD-44/cd44/cd44.eslint-plugin.ts";
import piece8 from "./.cache/discipline-core/mechanisms/eslint/CD-6/cd6/cd6.eslint-plugin.ts";
import piece9 from "./.cache/discipline-core/mechanisms/eslint/CD-7/cd7/cd7.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline": piece0 },
    rules: { "discipline/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },
  },
  {
    name: "discipline-core/piece/discipline-cd1",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline-cd1": piece1 },
    rules: { "discipline-cd1/implicit-any-let": "error", "discipline-cd1/no-explicit-any": "error" },
  },
  {
    name: "discipline-core/piece/discipline-cd10",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline-cd10": piece2 },
    rules: { "discipline-cd10/throw-only-error": "error" },
  },
  {
    name: "discipline-core/piece/discipline-cd27",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline-cd27": piece3 },
    rules: { "discipline-cd27/focused-tests": "error", "discipline-cd27/skipped-tests": "error" },
  },
  {
    name: "discipline-core/piece/discipline-cd40",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline-cd40": piece4 },
    rules: { "discipline-cd40/max-params": ["error",{"max":2,"countVoidThis":true}] },
  },
  {
    name: "discipline-core/piece/discipline-cd41",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline-cd41": piece5 },
    rules: { "discipline-cd41/cognitive-complexity": "error", "discipline-cd41/function-length": "error" },
  },
  {
    name: "discipline-core/piece/discipline-cd42",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline-cd42": piece6 },
    rules: { "discipline-cd42/useless-else": "error" },
  },
  {
    name: "discipline-core/piece/discipline-cd44",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline-cd44": piece7 },
    rules: { "discipline-cd44/no-param-reassign": ["error",{"props":false}] },
  },
  {
    name: "discipline-core/piece/discipline-cd6",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline-cd6": piece8 },
    rules: { "discipline-cd6/naming-convention": ["error",{"selector":["objectLiteralProperty","objectLiteralMethod","typeProperty","typeMethod","classProperty","classMethod","accessor","enumMember"],"modifiers":["requiresQuotes"],"format":null},{"selector":["variable","function","parameter"],"modifiers":["unused"],"format":null,"filter":{"regex":"^_","match":true}},{"selector":["variable","parameter"],"modifiers":["destructured"],"format":null},{"selector":"import","format":null},{"selector":["classProperty","classMethod","accessor","parameterProperty"],"modifiers":["override"],"format":null},{"selector":"variable","modifiers":["const"],"format":null,"custom":{"regex":"^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*|[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$","match":true}},{"selector":"variable","format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$","match":true}},{"selector":"function","format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$","match":true}},{"selector":"function","modifiers":["global"],"format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*)|[A-Z][A-Z0-9]*)?[_$]*$","match":true}},{"selector":"parameter","format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$","match":true}},{"selector":"typeLike","format":null,"custom":{"regex":"^[_$]*(?:[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$","match":true}},{"selector":"enumMember","format":null,"custom":{"regex":"^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)$","match":true}},{"selector":["classProperty","classMethod","accessor","parameterProperty"],"format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$","match":true}},{"selector":["classProperty","accessor"],"modifiers":["static"],"format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)?[_$]*$","match":true}},{"selector":"objectLiteralProperty","format":null,"custom":{"regex":"^(?:[a-z0-9][A-Za-z0-9]*)$","match":true}},{"selector":"objectLiteralMethod","format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$","match":true}},{"selector":"typeProperty","format":null,"custom":{"regex":"^(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$","match":true}},{"selector":"typeMethod","format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$","match":true}},{"selector":"import","modifiers":["default"],"format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*)|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)?[_$]*$","match":true}},{"selector":"import","modifiers":["namespace"],"format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$","match":true}}] },
  },
  {
    name: "discipline-core/piece/discipline-cd7",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline-cd7": piece9 },
    rules: { "discipline-cd7/filename-case": "error" },
  },
  {
    name: "discipline-core/authorised-location/CD-6#naming-convention/lint/no-comments.ts",
    files: ["lint/no-comments.ts"],
    rules: { "discipline-cd6/naming-convention": "off" },
  },
  {
    name: "discipline-core/authorised-location/CD-6#naming-convention/lint/node-import-protocol.ts",
    files: ["lint/node-import-protocol.ts"],
    rules: { "discipline-cd6/naming-convention": "off" },
  },
  {
    name: "discipline-core/authorised-location/CD-6#naming-convention/src/execution/adapters/intent-registry-file.ts",
    files: ["src/execution/adapters/intent-registry-file.ts"],
    rules: { "discipline-cd6/naming-convention": "off" },
  },
  {
    name: "discipline-core/authorised-location/CD-6#naming-convention/src/workflow-definition/adapters/agent-file.ts",
    files: ["src/workflow-definition/adapters/agent-file.ts"],
    rules: { "discipline-cd6/naming-convention": "off" },
  },
  {
    name: "discipline-core/authorised-location/CD-6#naming-convention/src/workflow-definition/adapters/plugin-files.ts",
    files: ["src/workflow-definition/adapters/plugin-files.ts"],
    rules: { "discipline-cd6/naming-convention": "off" },
  },
  {
    name: "discipline-core/authorised-location/CD-6#naming-convention/src/workflow-definition/adapters/rule-file.ts",
    files: ["src/workflow-definition/adapters/rule-file.ts"],
    rules: { "discipline-cd6/naming-convention": "off" },
  },
  {
    name: "discipline-core/authorised-location/CD-6#naming-convention/src/workflow-definition/adapters/scope-file.ts",
    files: ["src/workflow-definition/adapters/scope-file.ts"],
    rules: { "discipline-cd6/naming-convention": "off" },
  },
  {
    name: "discipline-core/authorised-location/CD-6#naming-convention/src/workflow-definition/adapters/sensor-file.ts",
    files: ["src/workflow-definition/adapters/sensor-file.ts"],
    rules: { "discipline-cd6/naming-convention": "off" },
  },
  {
    name: "discipline-core/authorised-location/CD-6#naming-convention/src/workflow-definition/adapters/stage-file.ts",
    files: ["src/workflow-definition/adapters/stage-file.ts"],
    rules: { "discipline-cd6/naming-convention": "off" },
  },
];
