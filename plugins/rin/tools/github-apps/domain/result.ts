type Success<Outcome> = { readonly kind: "success"; readonly outcome: Outcome };

type Failure<Reason> = { readonly kind: "failure"; readonly reason: Reason };

type Result<Outcome, Reason> = Success<Outcome> | Failure<Reason>;

const succeed = <Outcome>(outcome: Outcome): Success<Outcome> => ({ kind: "success", outcome });

const fail = <Reason>(reason: Reason): Failure<Reason> => ({ kind: "failure", reason });

export { fail, succeed, type Failure, type Result, type Success };
