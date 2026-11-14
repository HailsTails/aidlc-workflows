export type Accepted<Value> = { readonly ok: true; readonly value: Value };

export type Refused<Refusal> = { readonly ok: false; readonly refusal: Refusal };

export type Result<Value, Refusal> = Accepted<Value> | Refused<Refusal>;

export const accepted = <Value>(acceptedValue: Value): Accepted<Value> => ({
  ok: true,
  value: acceptedValue,
});

export const refused = <Refusal>(refusal: Refusal): Refused<Refusal> => ({ ok: false, refusal });
