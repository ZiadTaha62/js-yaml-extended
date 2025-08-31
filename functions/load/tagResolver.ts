/** Class that is returned by any Type construct function. it is used to store construct function along with it's params (data, type and params), so when node tree is being resolved they will be actaully executed. */
export class TagResolver {
  #func: (data: any, type?: string, params?: string) => unknown;
  data: any;
  type: string | undefined;
  params: string | undefined;

  constructor(
    func: (data: any, type?: string, params?: string) => unknown,
    data: any,
    type: string | undefined,
    params: string | undefined
  ) {
    this.#func = func;
    this.data = data;
    this.type = type;
    this.params = params;
  }

  resolve() {
    return this.#func(this.data, this.type, this.params);
  }
}
