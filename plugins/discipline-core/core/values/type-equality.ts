export type Equal<A, B> =
  (<Probe>() => Probe extends A ? 1 : 2) extends <Probe>() => Probe extends B
    ? 1
    : 2
    ? true
    : false;
