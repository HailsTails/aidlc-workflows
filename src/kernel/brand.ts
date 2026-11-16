declare const brandName: unique symbol;

export type Brand<Value, Name extends string> = Value & { readonly [brandName]: Name };

type Brander = {
  <Branded extends Brand<string, string>>(validated: string): Branded;
  <Branded extends Brand<number, string>>(validated: number): Branded;
  <Branded extends Brand<object, string>>(validated: Omit<Branded, typeof brandName>): Branded;
};

export const brand: Brander = <Branded>(validated: unknown): Branded => validated as Branded;
