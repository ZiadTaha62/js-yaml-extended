export class Debouncer<T> {
  #isExecuting: boolean = false;
  #timeInterval: number = 200;

  /** Next function to execute. */
  #nextFunc!: () => Promise<T> | T;

  /** Promises awaiting. */
  #promises: { res: (val: any) => any; rej: (err: any) => void }[] = [];

  constructor(timeInterval = 200) {
    this.#timeInterval = timeInterval;
  }

  setInterval(ms: number) {
    this.#timeInterval = ms;
  }

  /** Method to queue and debounce a function. */
  async debounce(func: () => Promise<T> | T): Promise<T> {
    if (typeof func !== "function") {
      return Promise.reject(new TypeError("debounce expects a function"));
    }

    // reset function
    this.#nextFunc = func;

    // create promise and add it's resolvers to promises array
    const promise = new Promise<T>((res, rej) => {
      this.#promises.push({ res, rej });
    });

    // start execution
    this.#execute();

    // await promise
    return await promise;
  }

  /** Main method for execution. */
  async #execute(): Promise<void> {
    // if executing return, if not start execution
    if (this.#isExecuting) return;
    this.#isExecuting = true;

    while (this.#promises.length > 0) {
      // get next function
      const func = this.#nextFunc;

      // get promises until now and reset array
      const promises = this.#promises.slice();
      this.#promises = [];

      if (typeof func !== "function") {
        const err = new TypeError("No function to execute");
        for (const p of promises) p.rej(err);
        continue;
      }

      // execute function and resolve or reject
      try {
        const val = await func();
        for (const p of promises) p.res(val);
      } catch (err) {
        for (const p of promises) p.rej(err);
      }

      // wait debounce interval before processing next queued call
      if (this.#promises.length > 0) {
        await new Promise((r) => setTimeout(r, this.#timeInterval));
      }
    }
    // set executing to false
    this.#isExecuting = false;
    // if new promises appeared during debounce interval re execute
    if (this.#promises.length > 0) this.#execute();
  }
}
