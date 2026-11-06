declare module "js-yaml" {
  export const JSON_SCHEMA: unknown;
  export function load(
    source: string,
    options: { readonly schema: unknown; readonly json: false },
  ): unknown;
}
