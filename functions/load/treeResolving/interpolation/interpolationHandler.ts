import { YAMLException } from "../../../../wrapperClasses/error.js";
import {
  ResolveCache,
  InternalLoad,
  InternalLoadAsync,
} from "../../../../types.js";
import { BluePrintItem } from "../bluePrintItem.js";
import { ImportHandler } from "./import.js";

const BUG_MESSAGE = `Error while resolving, contact us about this error as it's most propably a bug.`;

export class Interpolation {
  /** Cache to hold data during resolve. */
  #resolveCache: ResolveCache;

  /** Class to handle imports. */
  #importHandler: ImportHandler;

  #resolveUnkown: (
    val: unknown,
    id: string,
    anchored: boolean,
    path?: string[]
  ) => unknown;

  #resolveUnkownAsync: (
    val: unknown,
    id: string,
    anchored: boolean,
    path?: string[]
  ) => unknown;

  constructor(
    resolveCache: ResolveCache,
    resolveFunc: (
      val: unknown,
      id: string,
      anchored: boolean,
      path?: string[]
    ) => unknown,
    resolveFuncAsync: (
      val: unknown,
      id: string,
      anchored: boolean,
      path?: string[]
    ) => unknown,
    load: InternalLoad,
    loadAsync: InternalLoadAsync
  ) {
    this.#importHandler = new ImportHandler(load, loadAsync);
    this.#resolveCache = resolveCache;
    this.#resolveUnkown = resolveFunc;
    this.#resolveUnkownAsync = resolveFuncAsync;
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Methods to handle interpolation check in the resolver
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /** Method to check if mapping (object) in raw load is actaully mapping interpolation. */
  isIntMapping(ent: [string, unknown][]) {
    return ent.length === 1 && this.#isIntNode(ent[0][0]) && ent[0][1] == null;
  }

  /** Method to check if sequence (array) in raw load is actaully sequence interpolation. */
  isIntSequence(arr: unknown[]) {
    return arr.length === 1 && this.#isIntNode(arr[0]);
  }

  /** Method to check if scalar (string) in raw load is actaully scaler interpolation. */
  isIntScalar(str: string) {
    return this.#isIntNode(str);
  }

  /** Method to handle mapping interpolations by checking if passed enteries and return value if it was an interpolation or undefined if not. works sync. */
  handleIntMapping(ent: [string, unknown][], id: string): object | undefined {
    if (this.isIntMapping(ent)) {
      const val = this.resolve(ent[0][0], id);
      if (typeof val !== "object" || val == null || Array.isArray(val))
        throw new YAMLException(
          `Interpolation: ${ent[0][0]} is wrapped inside {} but it's value is not a mapping.`
        );
      return val;
    }
  }

  /** Method to handle mapping interpolations by checking if passed enteries and return value if it was an interpolation or undefined if not. works async. */
  async handleIntMappingAsync(
    ent: [string, unknown][],
    id: string
  ): Promise<object | undefined> {
    if (this.isIntMapping(ent)) {
      const val = await this.resolveAsync(ent[0][0], id);
      if (typeof val !== "object" || val == null || Array.isArray(val))
        throw new YAMLException(
          `Interpolation: ${ent[0][0]} is wrapped inside {} but it's value is not a mapping.`
        );
      return val;
    }
  }

  /** Method to handle sequence interpolations by checking if passed array and return value if it was an interpolation or undefined if not. works sync. */
  handleIntSequence(arr: unknown[], id: string): unknown[] | undefined {
    if (this.isIntSequence(arr)) {
      const val = this.resolve(arr[0] as string, id);
      if (!Array.isArray(val))
        throw new YAMLException(
          `Interpolation: ${arr[0]} is wrapped inside [] but it's value is not a sequence.`
        );
      return val;
    }
  }

  /** Method to handle sequence interpolations by checking if passed array and return value if it was an interpolation or undefined if not. works async. */
  async handleIntSequenceAsync(
    arr: unknown[],
    id: string
  ): Promise<unknown[] | undefined> {
    if (this.isIntSequence(arr)) {
      const val = await this.resolveAsync(arr[0] as string, id);
      if (!Array.isArray(val))
        throw new YAMLException(
          `Interpolation: ${arr[0]} is wrapped inside [] but it's value is not a sequence.`
        );
      return val;
    }
  }

  /** Method to handle scalar interpolations by checking if passed string and return value if it was an interpolation or undefined if not. works sync. */
  handleIntScalar(str: string, id: string): string | undefined {
    if (this.isIntScalar(str)) {
      const val = this.resolve(str, id);
      if (val && typeof val === "object")
        console.warn(
          `Interpolation without wrapping [] or {} is an object. wrap the expression in the appropraite type if you don't want it to be stringified.`
        );
      return String(val);
    }
  }

  /** Method to handle scalar interpolations by checking if passed string and return value if it was an interpolation or undefined if not. works async. */
  async handleIntScalarAsync(
    str: string,
    id: string
  ): Promise<string | undefined> {
    if (this.isIntScalar(str)) {
      const val = await this.resolveAsync(str, id);
      if (val && typeof val === "object")
        console.warn(
          `Interpolation without wrapping [] or {} is an object. wrap the expression in the appropraite type if you don't want it to be stringified.`
        );
      return String(val);
    }
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Methods to handle interpolation check in the resolver
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /** Method to resolve interpolations. works sync. */
  resolve(int: string, id: string): unknown {
    // split interpolation
    const { exprBase, exprPath, payload } = this.#splitInt(int);

    // handle interpolation according to base
    switch (exprBase) {
      case "this":
        return this.#handleThisInt(exprPath, payload, id);
      case "imp":
        return this.#handleImpInt(exprPath, payload, id);
      case "param":
        return this.#handleParamInt(exprPath, payload, id);
      case "local":
        return this.#handleLocalInt(exprPath, payload, id);
      case "ts":
        return `$${int}`; // will be handled in ts-builder
      default:
        throw new YAMLException(
          `Invalid base in interpolation: ${int} defined bases are: 'this' , 'imp' and 'param'`
        );
    }
  }

  /** Method to resolve interpolations. works async. */
  async resolveAsync(int: string, id: string) {
    // split interpolation
    const { exprBase, exprPath, payload } = this.#splitInt(int);

    // handle interpolation according to base
    switch (exprBase) {
      case "this":
        return await this.#handleThisIntAsync(exprPath, payload, id);
      case "imp":
        return await this.#handleImpIntAsync(exprPath, payload, id);
      case "param":
        return this.#handleParamInt(exprPath, payload, id);
      case "local":
        return this.#handleLocalInt(exprPath, payload, id);
      case "ts":
        return `$${int}`; // will be handled in ts-builder
      default:
        throw new YAMLException(
          `Invalid base in interpolation: ${int} defined bases are: 'this' , 'imp' and 'param'`
        );
    }
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Helper methods
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /** Method that takes interpolation and devide it into its parts. */
  #splitInt(int: string) {
    // normalize int by removing starting "$" or "${" and trailing "}" if present with trimimg
    int = int.trim();
    if (int.startsWith("${")) int = int.slice(2, int.length - 1);
    if (int.startsWith("$")) int = int.slice(1);
    int = int.trim();

    // split interpolation into parts
    const parts = int.split(" ").filter((v) => v);

    // separate parts into expr and payload
    if (parts.length === 0)
      throw new YAMLException(`Emtpy Interpolation expression detected.`);
    const expr = parts[0];
    const payload = parts.slice(1);

    // split expr into parts
    const exprParts = expr.split(".").filter((v) => v);

    // separate expr parts into base and path
    const exprBase = exprParts[0];
    if (!exprBase)
      throw new YAMLException(`Interpolation should start with a base.`); // should never fire but added for type script
    const exprPath = exprParts.slice(1);

    return { payload, exprBase, exprPath };
  }

  /** Method to handle this interpolation. */
  #handleThisInt(exprPath: string[], payload: string[], id: string) {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new YAMLException(BUG_MESSAGE);

    // get needed cache data
    const { blueprint } = cache;

    // load has structure of <local>=<value> ... so split each item using "=" to get key and value
    const localsVal = this.#handleKeyValue(payload);

    // update local values
    cache.localsVal.push(localsVal);

    // read node
    const val = this.#traverseNodes(blueprint, exprPath, id);

    // remove added localVals
    cache.localsVal.pop();

    // return value
    return val;
  }

  /** Method to handle this interpolation. */
  async #handleThisIntAsync(exprPath: string[], payload: string[], id: string) {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new YAMLException(BUG_MESSAGE);

    // get needed cache data
    const { blueprint } = cache;

    // load has structure of <local>=<value> ... so split each item using "=" to get key and value
    const localsVal = this.#handleKeyValue(payload);

    // update local values
    cache.localsVal.push(localsVal);

    // read node
    const val = await this.#traverseNodesAsync(blueprint, exprPath, id);

    // remove added localVals
    cache.localsVal.pop();

    // return value
    return val;
  }

  /** Method to handle import interpolation. works sync. */
  #handleImpInt(exprPath: string[], payload: string[], id: string) {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new YAMLException(BUG_MESSAGE);

    // get needed cache data
    const { importsMap, path, opts } = cache;

    // if no path supplied (which occurs only it the root load() by user) throw error that asks user to add filename if he wants to use imports
    if (!path)
      throw new YAMLException(
        `You need to define filename in options if you want to use imports.`
      );

    // get alias and node path from expr path
    const alias = exprPath[0];
    const nodePath = exprPath.slice(1);

    // use imports map to get path and defualt params of this import
    const impData = importsMap.get(alias);
    if (!impData)
      throw new YAMLException(
        `Alias used in import interpolation: '${exprPath}' is not defined in directives.`
      );
    const { paramsVal: defParamsVal, path: targetPath } = impData;

    // get params value defined after interpolation
    const paramsVal = this.#handleKeyValue(payload);

    // merge default with defined params
    const finalParams = { ...defParamsVal, ...paramsVal };

    // import file
    const load = this.#importHandler.import(
      path,
      targetPath,
      finalParams,
      opts,
      id.split("_")[0] // get loadId from id back
    );

    // traverse load using nodePath and return value
    return this.#traverseNodes(load, nodePath, id);
  }

  /** Method to handle import interpolation. works async. */
  async #handleImpIntAsync(exprPath: string[], payload: string[], id: string) {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new YAMLException(BUG_MESSAGE);

    // get needed cache data
    const { importsMap, path, opts } = cache;

    // if no path supplied (which occurs only it the root load() by user) throw error that asks user to add filename if he wants to use imports
    if (!path)
      throw new YAMLException(
        `You need to define filename in options if you want to use imports.`
      );

    // get alias and node path from expr path
    const alias = exprPath[0];
    const nodePath = exprPath.slice(1);

    // use imports map to get path and defualt params of this import
    const impData = importsMap.get(alias);
    if (!impData)
      throw new YAMLException(
        `Alias used in import interpolation: '${exprPath}' is not defined in directives.`
      );
    const { paramsVal: defParamsVal, path: targetPath } = impData;

    // get params value defined after interpolation
    const paramsVal = this.#handleKeyValue(payload);

    // merge default with defined params
    const finalParams = { ...defParamsVal, ...paramsVal };

    // import file
    const load = await this.#importHandler.importAsync(
      path,
      targetPath,
      finalParams,
      opts,
      id.split("_")[0] // get loadId from id back
    );

    // traverse load using nodePath and return value
    return await this.#traverseNodesAsync(load, nodePath, id);
  }

  /** Method to handle params interpolation. */
  #handleParamInt(exprPath: string[], payload: string[], id: string) {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new YAMLException(BUG_MESSAGE);

    // get needed cache data
    const { paramsMap, paramsVal } = cache;

    // get alias and node path from expr path
    const alias = exprPath[0];

    // check if alias is defined in directives using paramsMap, if yes get def param value
    if (!paramsMap.has(alias))
      throw new YAMLException(
        `Alias used in params interpolation: '${exprPath}' is not defined in directives.`
      );
    const defParam = paramsMap.get(alias);

    // if value is passed for this alias use it otherwise use default value
    return paramsVal[alias] ?? defParam ?? null;
  }

  /** Method to hndle locals interpolation. */
  #handleLocalInt(exprPath: string[], payload: string[], id: string) {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new YAMLException(BUG_MESSAGE);

    // get needed cache data
    const { localsMap, localsVal } = cache;

    // get alias and node path from expr path
    const alias = exprPath[0];

    // check if alias is defined in directives using localsMap
    if (!localsMap.has(alias))
      throw new YAMLException(
        `Alias used in local interpolation: '${exprPath}' is not defined in directives.`
      );
    const defLocal = localsMap.get(alias);

    // generate localsVal object from values passed after $this
    const handledLocalsVal = Object.fromEntries(
      localsVal
        .map((obj) => {
          return Object.entries(obj);
        })
        .flat(1)
    );

    // if value is passed for this alias use it otherwise use default value
    return handledLocalsVal[alias] ?? defLocal ?? null;
  }

  /** Method to traverse through nodes tree in tags like imp and this. */
  #traverseNodes(tree: unknown, path: string[], id: string) {
    // start node from base of the tree
    let node = tree;

    // start traversing
    for (const p of path) {
      // if node is not record throw
      if (!this.#isRecord(node) || node instanceof BluePrintItem)
        throw new YAMLException(
          `Invalid path in interpolation: ${path.join(".")}`
        );

      // if item is present in node update it and continue
      if (p in node) {
        node = node[p];
        continue;
      }

      // only if node is an array then try matching using string value
      if (Array.isArray(node) && typeof p === "string") {
        // resolve array values to get strings from blueprint items
        const resolved = this.#resolveUnkown(node, id, true, path);
        // if resolved is still an array check if item is present, if yes update node and continue
        if (Array.isArray(resolved)) {
          const idx = resolved.indexOf(p);
          if (idx !== -1) {
            node = node[idx];
            continue;
          }
        }
      }

      // throw error if no resolving happened until now
      throw new YAMLException(
        `Invalid path in interpolation: ${path.join(".")}`
      );
    }

    // return node
    return this.#resolveUnkown(node, id, true, path);
  }

  /** Method to traverse through nodes tree in tags like imp and this. */
  async #traverseNodesAsync(tree: unknown, path: string[], id: string) {
    // start node from base of the tree
    let node = tree;

    // start traversing
    for (const p of path) {
      // if node is not record throw
      if (!this.#isRecord(node) || node instanceof BluePrintItem)
        throw new YAMLException(
          `Invalid path in interpolation: ${path.join(".")}`
        );

      // if item is present in node update it and continue
      if (p in node) {
        node = node[p];
        continue;
      }

      // only if node is an array then try matching using string value
      if (Array.isArray(node) && typeof p === "string") {
        // resolve array values to get strings from blueprint items
        const resolved = await this.#resolveUnkownAsync(node, id, true, path);
        // if resolved is still an array check if item is present, if yes update node and continue
        if (Array.isArray(resolved)) {
          const idx = resolved.indexOf(p);
          if (idx !== -1) {
            node = node[idx];
            continue;
          }
        }
      }

      // throw error if no resolving happened until now
      throw new YAMLException(
        `Invalid path in interpolation: ${path.join(".")}`
      );
    }

    // return node
    return await this.#resolveUnkownAsync(node, id, true, path);
  }

  /** Helper method to check if string is interpolation. */
  #isIntNode(val: unknown) {
    if (val instanceof BluePrintItem) val = val.rawValue;
    if (typeof val !== "string") return false;
    (val as string) = val.trim();
    return val[0] === "$" && val[1] !== "$" && val[1] !== "{";
  }

  /** Method to check if value is a record (object or array). */
  #isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null;
  }

  /** Method to convert key=value payload array into object. */
  #handleKeyValue(payload: string[]) {
    return Object.fromEntries(
      payload.map((v) => {
        const keyVal = v.split("=");
        if (keyVal.length > 2)
          throw new YAMLException(
            `Payload after interpolation should have this structure: ( key=value ... )`
          );
        return keyVal;
      })
    );
  }
}
