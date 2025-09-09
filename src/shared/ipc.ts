export type CounterApi = {
  readCounter: () => Promise<number>;
  incrementCounter: () => Promise<number>;
};
