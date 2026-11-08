declare const brandName: unique symbol;

export type Brand<Value, Name extends string> = Value & { readonly [brandName]: Name };
