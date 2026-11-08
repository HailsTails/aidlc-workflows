declare const brandName: unique symbol;

export type Brand<Value, Name extends string> = Value & { readonly [brandName]: Name };

type Brander = {
  <Branded extends Brand<string, string>>(value: string): Branded;
  <Branded extends Brand<number, string>>(value: number): Branded;
  <Branded extends Brand<object, string>>(value: Omit<Branded, typeof brandName>): Branded;
};

export const brand: Brander = <Branded>(value: unknown): Branded => value as Branded;
