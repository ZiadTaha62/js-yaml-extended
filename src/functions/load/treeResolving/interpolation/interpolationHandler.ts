import { WrapperYAMLException } from "../../../../wrapperClasses/error.js";
import {
  ResolveCache,
  InternalLoad,
  InternalLoadAsync,
} from "../../../../types.js";
import { BlueprintItem } from "../blueprintItem.js";
import { ImportHandler } from "./import.js";

/** Message that will be sent if an error occured during resolving that should not happen. */
const BUG_MESSAGE = `Error while resolving, contact us about this error as it's most propably a bug.`;

/**
 * Class to handle resolving and handling of interpolations in YAML text.
 */
export class Interpolation {
  /** Reference to resolve cache of parent resolveHandler class. */
  #resolveCache: ResolveCache;

  /** Reference to resolveUnknown method of parent resolveHandler class. */
  #resolveUnknown: (
    val: unknown,
    id: string,
    anchored: boolean,
    path?: string[]
  ) => unknown;

  /** Reference to resolveUnknownAsync method of parent resolveHandler class. */
  #resolveUnknownAsync: (
    val: unknown,
    id: string,
    anchored: boolean,
    path?: string[]
  ) => unknown;

  /** Class to handle imports. */
  #importHandler: ImportHandler;

  /**
   * @param resolveCache - Reference to resolve cache of parent resolveHandler class.
   * @param resolveUnknown - Reference to resolveUnknown method of parent resolveHandler class. passed like this to avoid circular dependency.
   * @param resolveUnknownAsync - Reference to resolveUnknownAsync method of parent resolveHandler class. passed like this to avoid circular dependency.
   * @param load - Reference to internalLoad function, so it can be used in $imp interpolation. passed like this to avoid circular dependency.
   * @param loadAsync - Reference to internalLoadAsync function, so it can be used in $imp interpolation. passed like this to avoid circular dependency.
   */
  constructor(
    resolveCache: ResolveCache,
    resolveUnknown: (
      val: unknown,
      id: string,
      anchored: boolean,
      path?: string[]
    ) => unknown,
    resolveUnknownAsync: (
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
    this.#resolveUnknown = resolveUnknown;
    this.#resolveUnknownAsync = resolveUnknownAsync;
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Methods to handle interpolation check and resolve by calling resolving methods.
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /**
   * Method to check if mapping (object) in raw load is actaully mapping interpolation. mapping interpolations are defined with this structure in YAML file: { $<int> }
   * which is pared by js-yaml to: { $<int>: null }. so it actally check if it's a one key object and the key is valid interpolation syntax with value null.
   * @param ent - Enteries of checked object.
   * @returns Boolean that indicate if it's an interpolation or not.
   */
  isIntMapping(ent: [string, unknown][]): boolean {
    return ent.length === 1 && this.#isIntNode(ent[0][0]) && ent[0][1] == null;
  }

  /**
   * Method to check if sequence (array) in raw load is actaully sequence interpolation. sequence interpolations are defined with this structure in YAML file: [ $<int> ]
   * which is pared by js-yaml to: [ $<int> ]. so it actally check if it's a one item array and the this item is valid interpolation syntax.
   * @param arr - Array that will be checked.
   * @returns Boolean that indicate if it's an interpolation or not.
   */
  isIntSequence(arr: unknown[]): boolean {
    return arr.length === 1 && this.#isIntNode(arr[0]);
  }

  /**
   * Method to check if scalar (string) in raw load is actaully scalar interpolation. scalar interpolations are defined with this structure in YAML file: $<int>
   * which is pared by js-yaml to: $<int>. so it actally check if the string is valid interpolation syntax.
   * @param str - string that will be checked.
   * @returns Boolean that indicate if it's an interpolation or not.
   */
  isIntScalar(str: string): boolean {
    return this.#isIntNode(str);
  }

  /**
   * Method to handle mapping interpolations by resolving value if it was indeed mapping interpolation, if it wasn't udnefined is returned instead. works sync.
   * @param ent - Enteries of handled object.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Resolved value of mapping interpolation.
   */
  handleIntMapping(ent: [string, unknown][], id: string): object | undefined {
    if (this.isIntMapping(ent)) {
      const val = this.resolve(ent[0][0], id);
      if (typeof val !== "object" || val == null || Array.isArray(val))
        throw new WrapperYAMLException(
          `Interpolation: ${ent[0][0]} is wrapped inside {} but it's value is not a mapping.`
        );
      return val;
    }
  }

  /**
   * Method to handle mapping interpolations by resolving value if it was indeed mapping interpolation, if it wasn't udnefined is returned instead. works async.
   * @param ent - Enteries of handled object.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Resolved value of mapping interpolation.
   */
  async handleIntMappingAsync(
    ent: [string, unknown][],
    id: string
  ): Promise<object | undefined> {
    if (this.isIntMapping(ent)) {
      const val = await this.resolveAsync(ent[0][0], id);
      if (typeof val !== "object" || val == null || Array.isArray(val))
        throw new WrapperYAMLException(
          `Interpolation: ${ent[0][0]} is wrapped inside {} but it's value is not a mapping.`
        );
      return val;
    }
  }

  /**
   * Method to handle sequence interpolations by resolving value if it was indeed sequence interpolation, if it wasn't udnefined is returned instead. works sync.
   * @param arr - Array that will be handled.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Resolved value of sequence interpolation.
   */
  handleIntSequence(arr: unknown[], id: string): unknown[] | undefined {
    if (this.isIntSequence(arr)) {
      const val = this.resolve(arr[0] as string, id);
      if (!Array.isArray(val))
        throw new WrapperYAMLException(
          `Interpolation: ${arr[0]} is wrapped inside [] but it's value is not a sequence.`
        );
      return val;
    }
  }

  /**
   * Method to handle sequence interpolations by resolving value if it was indeed sequence interpolation, if it wasn't udnefined is returned instead. works async.
   * @param arr - Array that will be handled.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Resolved value of resolving interpolation.
   */
  async handleIntSequenceAsync(
    arr: unknown[],
    id: string
  ): Promise<unknown[] | undefined> {
    if (this.isIntSequence(arr)) {
      const val = await this.resolveAsync(arr[0] as string, id);
      if (!Array.isArray(val))
        throw new WrapperYAMLException(
          `Interpolation: ${arr[0]} is wrapped inside [] but it's value is not a sequence.`
        );
      return val;
    }
  }

  /**
   * Method to handle scalar interpolations by resolving value if it was indeed scalar interpolation, if it wasn't udnefined is returned instead. works sync.
   * @param str - string that will be handled.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Resolved value of scalar interpolation.
   */
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

  /**
   * Method to handle scalar interpolations by resolving value if it was indeed scalar interpolation, if it wasn't udnefined is returned instead. works async.
   * @param str - string that will be handled.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Resolved value of scalar interpolation.
   */
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
  // Methods to handle interpolation resolve.
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /**
   * Method to resolve interpolations. works sync.
   * @param int - Interpolation that will be handled.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Value returned from interpolation resolve.
   */
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
        throw new WrapperYAMLException(
          `Invalid base in interpolation: ${int} defined bases are: 'this' , 'imp' and 'param'`
        );
    }
  }

  /**
   * Method to resolve interpolations. works async.
   * @param int - Interpolation that will be handled.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Value returned from interpolation resolve.
   */
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
      default:
        throw new WrapperYAMLException(
          `Invalid base in interpolation: ${int} defined bases are: this, imp, param and local.`
        );
    }
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Helper methods
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /**
   * Method that takes interpolation and devide it into its parts. each interpolation has this structure: $<expression> <payload...> and expression is further devided
   * into: <expression base>.<expression path>. for example interpolation $imp.module.node param1=value1 param2=value2, the expression is imp.module.node which is
   * further devided into imp (expression base) and module.node (expression path). and payload is param1=value1 param2=value2. and here's explanation of each part role:
   *    - expression base: defines type of interpolation and how it's handled by parser and so is defined by library. for example imp base used earlier tells the parser
   *    that it should import yaml file. or this base that tells parser to check current YAML file.
   *    - expression path: main metadata of the interpolation, returning to out earlier example module.node you tell the parser to import the module with name "module"
   *    and return value of a node named "node".
   *    - payload: additional meta data that affects how parser treat to return value but it's not essential, payload in the previous example was telling parser to resolve
   *    and module params it faces with name "param1" to value "value1" and so for "param2" and "value2".
   * @param int - Interpolatio that will be splitted.
   * @returns Object of the parts ready to be handled.
   */
  #splitInt(int: string): {
    exprBase: string;
    exprPath: string[];
    payload: string[];
  } {
    // normalize int by removing starting "$" or "${" and trailing "}" if present with trimimg
    int = int.trim();
    if (int.startsWith("${")) int = int.slice(2, int.length - 1);
    if (int.startsWith("$")) int = int.slice(1);
    int = int.trim();

    // split interpolation into parts
    const parts = int.split(" ").filter((v) => v);

    // separate parts into expr and payload
    if (parts.length === 0)
      throw new WrapperYAMLException(
        `Emtpy Interpolation expression detected.`
      );
    const expr = parts[0];
    const payload = parts.slice(1);

    // split expr into parts
    const exprParts = expr.split(".").filter((v) => v);

    // separate expr parts into base and path
    const exprBase = exprParts[0];
    if (!exprBase)
      throw new WrapperYAMLException(`Interpolation should start with a base.`); // should never fire but added for type script
    const exprPath = exprParts.slice(1);

    return { exprBase, exprPath, payload };
  }

  /**
   * Method to handle 'this' interpolation. works sync.
   * @param exprPath - Main metadata passed in the expression.
   * @param payload - Additional metadata passed after expression.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Value from resolving the interpolation.
   */
  #handleThisInt(exprPath: string[], payload: string[], id: string): unknown {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new WrapperYAMLException(BUG_MESSAGE);

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

  /**
   * Method to handle 'this' interpolation. works async.
   * @param exprPath - Main metadata passed in the expression.
   * @param payload - Additional metadata passed after expression.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Value from resolving the interpolation.
   */
  async #handleThisIntAsync(
    exprPath: string[],
    payload: string[],
    id: string
  ): Promise<unknown> {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new WrapperYAMLException(BUG_MESSAGE);

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

  /**
   * Method to handle 'imp' interpolation. works sync.
   * @param exprPath - Main metadata passed in the expression.
   * @param payload - Additional metadata passed after expression.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Value from resolving the interpolation.
   */
  #handleImpInt(exprPath: string[], payload: string[], id: string): unknown {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new WrapperYAMLException(BUG_MESSAGE);

    // get needed cache data
    const { importsMap, path, opts } = cache;

    // if no path supplied (which occurs only it the root load() by user) throw error that asks user to add filename if he wants to use imports
    if (!path)
      throw new WrapperYAMLException(
        `You need to define filename in options if you want to use imports.`
      );

    // get alias and node path from expr path
    const alias = exprPath[0];
    const nodePath = exprPath.slice(1);

    // use imports map to get path and defualt params of this import
    const impData = importsMap.get(alias);
    if (!impData)
      throw new WrapperYAMLException(
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

  /**
   * Method to handle 'imp' interpolation. works async.
   * @param exprPath - Main metadata passed in the expression.
   * @param payload - Additional metadata passed after expression.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Value from resolving the interpolation.
   */
  async #handleImpIntAsync(
    exprPath: string[],
    payload: string[],
    id: string
  ): Promise<unknown> {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new WrapperYAMLException(BUG_MESSAGE);

    // get needed cache data
    const { importsMap, path, opts } = cache;

    // if no path supplied (which occurs only it the root load() by user) throw error that asks user to add filename if he wants to use imports
    if (!path)
      throw new WrapperYAMLException(
        `You need to define filename in options if you want to use imports.`
      );

    // get alias and node path from expr path
    const alias = exprPath[0];
    const nodePath = exprPath.slice(1);

    // use imports map to get path and defualt params of this import
    const impData = importsMap.get(alias);
    if (!impData)
      throw new WrapperYAMLException(
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

  /**
   * Method to handle 'param' interpolation.
   * @param exprPath - Main metadata passed in the expression.
   * @param payload - Additional metadata passed after expression.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Value from resolving the interpolation.
   */
  #handleParamInt(exprPath: string[], payload: string[], id: string): unknown {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new WrapperYAMLException(BUG_MESSAGE);

    // get needed cache data
    const { paramsMap, paramsVal } = cache;

    // get alias and node path from expr path
    const alias = exprPath[0];

    // check if alias is defined in directives using paramsMap, if yes get def param value
    if (!paramsMap.has(alias))
      throw new WrapperYAMLException(
        `Alias used in params interpolation: '${exprPath}' is not defined in directives.`
      );
    const defParam = paramsMap.get(alias);

    // if value is passed for this alias use it otherwise use default value
    return paramsVal[alias] ?? defParam ?? null;
  }

  /**
   * Method to handle 'local' interpolation.
   * @param exprPath - Main metadata passed in the expression.
   * @param payload - Additional metadata passed after expression.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Value from resolving the interpolation.
   */
  #handleLocalInt(exprPath: string[], payload: string[], id: string): unknown {
    // get cache
    const cache = this.#resolveCache.get(id);
    if (!cache) throw new WrapperYAMLException(BUG_MESSAGE);

    // get needed cache data
    const { localsMap, localsVal } = cache;

    // get alias and node path from expr path
    const alias = exprPath[0];

    // check if alias is defined in directives using localsMap
    if (!localsMap.has(alias))
      throw new WrapperYAMLException(
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

  /**
   * Method to traverse through nodes tree. works sync.
   * @param tree - Node tree that will be traversed.
   * @param path - Path of traversal.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Value after traversal and retuning subnode.
   */
  #traverseNodes(tree: unknown, path: string[], id: string): unknown {
    // start node from base of the tree
    let node = tree;

    // start traversing
    for (const p of path) {
      // if node is not record throw
      if (!this.#isRecord(node) || node instanceof BlueprintItem)
        throw new WrapperYAMLException(
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
        const resolved = this.#resolveUnknown(node, id, true, path);
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
      throw new WrapperYAMLException(
        `Invalid path in interpolation: ${path.join(".")}`
      );
    }

    // return node
    return this.#resolveUnknown(node, id, true, path);
  }

  /**
   * Method to traverse through nodes tree. works async.
   * @param tree - Node tree that will be traversed.
   * @param path - Path of traversal.
   * @param id - Unique id generated for this resolve executiion, used to access cache.
   * @returns Value after traversal and retuning subnode.
   */
  async #traverseNodesAsync(
    tree: unknown,
    path: string[],
    id: string
  ): Promise<unknown> {
    // start node from base of the tree
    let node = tree;

    // start traversing
    for (const p of path) {
      // if node is not record throw
      if (!this.#isRecord(node) || node instanceof BlueprintItem)
        throw new WrapperYAMLException(
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
        const resolved = await this.#resolveUnknownAsync(node, id, true, path);
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
      throw new WrapperYAMLException(
        `Invalid path in interpolation: ${path.join(".")}`
      );
    }

    // return node
    return await this.#resolveUnknownAsync(node, id, true, path);
  }

  /**
   * Method to check if value is interpolation node.
   * @param val - Value that will be checked.
   * @returns Boolean that indicates if value is interpolation node or not.
   */
  #isIntNode(val: unknown): boolean {
    if (val instanceof BlueprintItem) val = val.rawValue;
    if (typeof val !== "string") return false;
    (val as string) = val.trim();
    return val[0] === "$" && val[1] !== "$" && val[1] !== "{";
  }

  /**
   * Method to check if value is an array or object (record that can contains other primative values).
   * @param val - Value that will be checked.
   * @returns Boolean that indicates if value is a record or not.
   */
  #isRecord(val: unknown): val is Record<string, unknown> {
    return typeof val === "object" && val !== null;
  }

  /**
   * Method to convert key=value payload array into object.
   * @param payload - Payload that will be converted.
   * @returns Object that holds key-value pairs of the payload.
   */
  #handleKeyValue(payload: string[]) {
    return Object.fromEntries(
      payload.map((v) => {
        const keyVal = v.split("=");
        if (keyVal.length > 2)
          throw new WrapperYAMLException(
            `Payload after interpolation should have this structure: ( key=value ... )`
          );
        return keyVal;
      })
    );
  }
}
