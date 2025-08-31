import { YAMLException } from "../../../wrapperClasses/error.js";
import { Interpolation } from "./interpolation/interpolationHandler.js";
import { TagResolver } from "../tagResolver.js";
import type {
  DirectivesObj,
  LoadOptions,
  ResolveCache,
  InternalLoad,
  InternalLoadAsync,
} from "../../../types.js";
import { BluePrintItem } from "./bluePrintItem.js";
import { generateId } from "../helpers.js";

export class ResolveHandler {
  /** Cache that holds resolve helpers for each resolve. */
  #resolveCache: ResolveCache = new Map();

  /** Class to handle interpolations. */
  #intHandler: Interpolation;

  constructor(load: InternalLoad, loadAsync: InternalLoadAsync) {
    this.#intHandler = new Interpolation(
      this.#resolveCache,
      this.#resolveUnknown.bind(this),
      this.#resolveUnknownAsync.bind(this),
      load,
      loadAsync
    );
  }

  /** Method to generate blue print from raw load. */
  createBlueprint(orig: unknown): unknown {
    // if array generate similar array and all values go through emptyCopy method as well
    if (Array.isArray(orig)) {
      // check if it's syntaxt [$val]
      if (this.#intHandler.isIntSequence(orig)) return new BluePrintItem(orig);

      // otherwise handle as normal array
      const out = [];
      for (const v of orig) out.push(this.createBlueprint(v));
      return out;
    }

    // if object generate object of similar keys and all values go through emptyCopy method as well
    if (orig && typeof orig === "object") {
      // convert to interies
      const enteries = Object.entries(orig);

      // check if it's syntaxt {$val}
      if (this.#intHandler.isIntMapping(enteries))
        return new BluePrintItem(orig);

      // otherwise handle as normal object
      const out: Record<any, unknown> = {};
      for (const [k, v] of enteries) {
        out[k] = this.createBlueprint(v);
      }
      return out;
    }

    // otherwise return blueprint item
    return new BluePrintItem(orig);
  }

  /** Method used to resolve blueprint. */
  resolve(
    path: string | undefined,
    blueprint: unknown,
    directivesObj: DirectivesObj,
    paramsVal: Record<string, string>,
    loadId: string,
    opts: LoadOptions
  ): unknown {
    // generate id by concatinating loadId with resolved path or random id to uniquely identify this resolve
    const id = `${loadId}_${path ?? generateId()}`;

    // add execution cache data
    this.#resolveCache.set(id, {
      path,
      ...directivesObj,
      blueprint,
      paramsVal,
      localsVal: [],
      opts,
    });

    // start actual handling
    try {
      // resolve
      const resolved = this.#resolveUnknown(blueprint, id, false);
      // remove private and return value
      return this.#filterPrivate(resolved, id);
    } finally {
      this.#resolveCache.delete(id);
    }
  }

  async resolveAsync(
    path: string | undefined,
    blueprint: unknown,
    directivesObj: DirectivesObj,
    paramsVal: Record<string, string>,
    loadId: string,
    opts: LoadOptions
  ): Promise<unknown> {
    // generate id by concatinating loadId with resolved path or random id to uniquely identify this resolve
    const id = `${loadId}_${path ?? generateId()}`;

    // add execution cache data
    this.#resolveCache.set(id, {
      path,
      ...directivesObj,
      blueprint,
      paramsVal,
      localsVal: [],
      opts,
    });

    // start actual handling
    try {
      // resolve
      const resolved = await this.#resolveUnknownAsync(blueprint, id, false);
      // remove private and return value
      return this.#filterPrivate(resolved, id);
    } finally {
      this.#resolveCache.delete(id);
    }
  }

  /** Method to resolve unkown values by checking type and using appropriate resolver. */
  #resolveUnknown(
    val: unknown,
    id: string,
    anchored: boolean,
    path?: string[]
  ): unknown {
    // if blue print item resolve it
    if (val instanceof BluePrintItem)
      val = this.#resolveBlueprintItem(val, anchored, path);

    // handle value according to its type
    if (typeof val === "string") return this.#resolveString(val, id);
    if (typeof val !== "object" || val === null) return val;
    if (val instanceof TagResolver)
      return this.#resolveTag(val, id, anchored, path);
    if (Array.isArray(val)) return this.#resolveArray(val, id, anchored, path);
    return this.#resolveObject(val, id, anchored, path);
  }

  /** Method to resolve unkown values by checking type and using appropriate resolver. */
  async #resolveUnknownAsync(
    val: unknown,
    id: string,
    anchored: boolean,
    path?: string[]
  ): Promise<unknown> {
    // if blue print item resolve it
    if (val instanceof BluePrintItem)
      val = this.#resolveBlueprintItem(val, anchored, path);

    // handle value according to its type
    if (typeof val === "string") return await this.#resolveStringAsync(val, id);
    if (typeof val !== "object" || val === null) return val;
    if (val instanceof TagResolver)
      return await this.#resolveTagAsync(val, id, anchored, path);
    if (Array.isArray(val))
      return await this.#resolveArrayAsync(val, id, anchored, path);
    return await this.#resolveObjectAsync(val, id, anchored, path);
  }

  /** Method to resolve objects. */
  #resolveObject(
    obj: object,
    id: string,
    anchored: boolean,
    path?: string[]
  ): object {
    // resolve all the enteries of the original blue print
    const newObj = { ...obj };
    const enteries = Object.entries(newObj);

    // if empty return empty object
    if (enteries.length === 0) return {};

    // check if it's syntaxt {$val}
    const intMapping = this.#intHandler.handleIntMapping(enteries, id);
    if (intMapping) return intMapping;

    // loop enteries
    for (const [key, val] of enteries)
      (newObj as any)[key] = this.#resolveUnknown(val, id, anchored, path);
    return newObj;
  }

  /** Method to resolve objects. */
  async #resolveObjectAsync(
    obj: object,
    id: string,
    anchored: boolean,
    path?: string[]
  ): Promise<object> {
    // resolve all the enteries of the original blue print
    const newObj = { ...obj };
    const enteries = Object.entries(newObj);

    // if empty return empty object
    if (enteries.length === 0) return {};

    // check if it's syntaxt {$val}
    const intMapping = await this.#intHandler.handleIntMappingAsync(
      enteries,
      id
    );
    if (intMapping) return intMapping;

    // loop enteries
    for (const [key, val] of enteries)
      (newObj as any)[key] = await this.#resolveUnknownAsync(
        val,
        id,
        anchored,
        path
      );
    return newObj;
  }

  /** Method to resolve arrays. */
  #resolveArray(
    arr: any[],
    id: string,
    anchored: boolean,
    path?: string[]
  ): unknown[] {
    // resolve all the items of the original blue print
    const newArr = [...arr];

    // check if it's syntaxt [$val]
    const intSequence = this.#intHandler.handleIntSequence(newArr, id);
    if (intSequence) return intSequence;

    // handle all the values in the array
    for (let i = 0; i < newArr.length; i++)
      newArr[i] = this.#resolveUnknown(newArr[i], id, anchored, path);

    // return new array
    return newArr;
  }

  /** Method to resolve arrays. */
  async #resolveArrayAsync(
    arr: any[],
    id: string,
    anchored: boolean,
    path?: string[]
  ): Promise<unknown[]> {
    // resolve all the items of the original blue print
    const newArr = [...arr];

    // check if it's syntaxt [$val]
    const intSequence = await this.#intHandler.handleIntSequenceAsync(
      newArr,
      id
    );
    if (intSequence) return intSequence;

    // handle all the values in the array
    for (let i = 0; i < newArr.length; i++)
      newArr[i] = await this.#resolveUnknownAsync(
        newArr[i],
        id,
        anchored,
        path
      );

    // return new array
    return newArr;
  }

  /** Method to resolve strings. */
  #resolveString(str: string, id: string): string {
    // check if it's syntaxt $val
    const intScaler = this.#intHandler.handleIntScalar(str, id);
    if (intScaler) return intScaler;

    /** Var to hold out string. */
    let out: string = "";
    /** Var to hold loop index. */
    let i = 0;

    // start loop
    while (i < str.length) {
      // get character
      const ch = str[i];

      // if charachter is $ handle it
      if (ch === "$") {
        // escaped -> $${}
        if (str[i + 1] === "$" && str[i + 2] === "{") {
          out += "${"; // ad only one "$" to the out string
          i += 3; // skip the reset of the expression
          continue;
        }

        // non escaped -> ${}
        if (str[i + 1] === "{") {
          const end = this.#getClosingChar(str, "{", "}", i + 2);
          if (end === -1)
            throw new YAMLException(
              `String interpolation used without closing '}' in: ${str}`
            );
          const val = this.#intHandler.resolve(str.slice(i, end + 1), id);
          const stringifiedVal = String(val);
          out += stringifiedVal;
          i = end + 1;
          continue;
        }
      }

      // any other char just add it and increment index
      out += ch;
      i++;
    }

    // return out string
    return out;
  }

  /** Method to resolve strings. */
  async #resolveStringAsync(str: string, id: string): Promise<string> {
    // check if it's syntaxt $val
    const intScaler = await this.#intHandler.handleIntScalarAsync(str, id);
    if (intScaler) return intScaler;

    /** Var to hold out string. */
    let out: string = "";
    /** Var to hold loop index. */
    let i = 0;

    // start loop
    while (i < str.length) {
      // get character
      const ch = str[i];

      // if charachter is $ handle it
      if (ch === "$") {
        // escaped -> $${}
        if (str[i + 1] === "$" && str[i + 2] === "{") {
          out += "${"; // ad only one "$" to the out string
          i += 3; // skip the reset of the expression
          continue;
        }

        // non escaped -> ${}
        if (str[i + 1] === "{") {
          const end = this.#getClosingChar(str, "{", "}", i + 2);
          if (end === -1)
            throw new YAMLException(
              `String interpolation used without closing '}' in: ${str}`
            );
          const val = await this.#intHandler.resolveAsync(
            str.slice(i, end + 1),
            id
          );
          const stringifiedVal = String(val);
          out += stringifiedVal;
          i = end + 1;
          continue;
        }
      }

      // any other char just add it and increment index
      out += ch;
      i++;
    }

    // return out string
    return out;
  }

  /** Method to resolve tagResolver instance. */
  #resolveTag(
    resolveIns: TagResolver,
    id: string,
    anchored: boolean,
    path?: string[]
  ): unknown {
    // get data, params and resolve function
    const { data, params, resolve } = resolveIns;

    // handle data and params (data's type is unkown but params type is string)
    const resolvedData = this.#resolveUnknown(data, id, anchored, path);
    const resolvedParams = params && this.#resolveString(params, id);

    // save resolved values in the tag resolve instance
    resolveIns.data = resolvedData;
    resolveIns.params = resolvedParams;

    // execute the constructor function
    const value = resolve();
    return value;
  }

  /** Method to resolve tagResolver instance. */
  async #resolveTagAsync(
    resolveIns: TagResolver,
    id: string,
    anchored: boolean,
    path?: string[]
  ): Promise<unknown> {
    // get data, params and resolve function
    const { data, params, resolve } = resolveIns;

    // handle data and params (data's type is unkown but params type is string)
    const resolvedData = await this.#resolveUnknownAsync(
      data,
      id,
      anchored,
      path
    );
    const resolvedParams =
      params && (await this.#resolveStringAsync(params, id));

    // save resolved values in the tag resolve instance
    resolveIns.data = resolvedData;
    resolveIns.params = resolvedParams;

    // execute the constructor function
    const value = resolve();
    return value;
  }

  /** Method to filter private nodes. */
  #filterPrivate(resolve: unknown, id: string) {
    // get private arr
    const privateArr = this.#resolveCache.get(id)?.privateArr;
    if (!privateArr) return resolve;

    // loop through private array to handle each path
    for (const priv of privateArr) {
      // get parts of the path
      const path = priv.split(".");

      // var that holds the resolve to transverse through it
      let node = resolve;
      for (let i = 0; i < path.length; i++) {
        // get current part of the path
        const p = path[i];

        // if it's not a record then path is not true and just console a warning
        if (!this.#isRecord(node)) {
          console.warn(`Private path ${path} is not valid`);
          break;
        }

        // in last iteraion delete the child based on the parent type
        if (path.length - 1 === i) {
          if (Array.isArray(node)) node.splice(Number(p), 1);
          else delete node[p];
        } else node = node[p];
      }
    }

    return resolve;
  }

  /** Method to resolve blue print item. */
  #resolveBlueprintItem(
    val: unknown,
    anchored: boolean,
    path?: string[]
  ): unknown {
    if (!(val instanceof BluePrintItem)) return val;
    return anchored ? val.resolveAnchor(path) : val.resolve();
  }

  #isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null;
  }

  /** Helper method to get closing character at the same depth of the opening one. */
  #getClosingChar(
    str: string,
    openCh: string,
    closeCh: string,
    startIdx?: number
  ) {
    /** Var to hold depth of the opening and closing characters. */
    let depth = 0;
    /** Var to hold index of the looping. */
    let i = startIdx ?? 0;

    // start loop string
    while (i < str.length) {
      // get character
      const ch = str[i];

      // if char is closing char and depth already zero return index other whise decrease depth by one
      if (ch === closeCh && str[i - 1] !== "\\")
        if (depth === 0) return i;
        else depth--;

      // if char is opening char increment depth by one
      if (ch === openCh && str[i - 1] !== "\\") depth++;

      // increment loop index
      i++;
    }

    // if no closing at depth zero return -1
    return -1;
  }
}
