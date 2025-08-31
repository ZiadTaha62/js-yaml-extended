import { YAMLException } from "../../../wrapperClasses/error.js";
import { dirEndRegex, pathRegex } from "../regex.js";
import type { DirectivesObj } from "../../../types.js";

/** Class to handle reading wrapper directives at the top of the string. with normalizing the string back to normal YAML so it can be passed to the loader. */
export class DirectivesHandler {
  /**
   * Method to read directives in the string, handle wrapper specific directives by reading and filtering them from original string.
   * @param str - String passed in load function.
   * @returns Object that holds safe & filtered string ready to be fed to the parser. along with params & private arrays which holds defined params and private nodes, and import object
   * with keys aliases and there corrispoding paths.
   */
  handle(str: string): DirectivesObj & { filteredStr: string } {
    // define main arrays and maps to hold directives data
    /** Holds list of private node's definition. */
    const privateArr: string[] = [];
    /** Holds list of param's aliases and default values used in the module. */
    const paramsMap: Map<string, string> = new Map();
    /** Holds list of local's aliases and default values used in the module. */
    const localsMap: Map<string, string> = new Map();
    /** Map of aliases for imports and import data as path and modules params. */
    const importsMap: Map<
      string,
      { path: string; paramsVal: Record<string, string> }
    > = new Map();

    // split using regex to get directives if present
    const parts = str.split(dirEndRegex);

    // handle length verification of parts
    if (parts.length === 1)
      return {
        filteredStr: str,
        paramsMap,
        privateArr,
        localsMap,
        importsMap,
      }; // no directives
    if (parts.length > 2)
      throw new YAMLException("Directives splitting can only be done once."); // more than one dir end mark in the file

    // split directive part into lines
    const lines = parts[0]
      .split("\n")
      .filter((l) => this.#isEmptyLine(l))
      .map((l) => l.trim());

    // array to hold directive lines that are related to my wrapper to delete them before passing to the parser
    let filterIdx: number[] = [];

    // loop through lines to handle wrapper lines
    for (let i = 0; i < lines.length; i++) {
      // get line
      const line = lines[i];

      // split line into parts
      const parts = line.split(" ");

      // according to first part (directive decleration) pass remaining parts to specific function
      const dec = parts.shift();
      switch (dec) {
        case "%PARAM":
          this.#handleParams(paramsMap, parts);
          filterIdx.push(i);
          break;
        case "%PRIVATE":
          this.#handlePrivate(privateArr, parts);
          filterIdx.push(i);
          break;
        case "%IMPORT":
          this.#handleImports(importsMap, parts);
          filterIdx.push(i);
          break;
        case "%LOCAL":
          this.#handleLocals(localsMap, parts);
          filterIdx.push(i);
          break;
      }
    }

    // filter wrapper lines from lines and rejoin remaining directives
    const filteredLines = lines.filter((_, idx) => !filterIdx.includes(idx));
    const filteredDirs = filteredLines.join("\n");

    // replace directives with filtered directives
    const filteredStr = str.replace(parts[0], filteredDirs);

    return {
      filteredStr,
      privateArr,
      paramsMap,
      localsMap,
      importsMap,
    };
  }

  /** Method to push private nodes to the private store. */
  #handlePrivate(privateArr: string[], parts: string[]) {
    for (const p of parts) privateArr.push(p);
  }

  /** Method to create locals map where key is alias for the local and value is default value. */
  #handleLocals(localsMap: Map<string, string>, parts: string[]) {
    // make sure that alias is present
    if (parts.length < 1)
      throw new YAMLException(`Local directive should include at least alias.`);
    // get alias and default value
    const alias = parts[0];
    const defValue = parts[1];

    // add the alias with default value to the paramsMap
    localsMap.set(alias, defValue);
  }

  /** Method to create params map where key is alias for the local and value is default value. */
  #handleParams(paramsMap: Map<string, string>, parts: string[]) {
    // make sure that alias is present
    if (parts.length < 1)
      throw new YAMLException(`Param directive should include at least alias.`);
    // get alias and default value
    const alias = parts[0];
    const defValue = parts[1];

    // add the alias with default value to the paramsMap
    paramsMap.set(alias, defValue);
  }

  /** Method to verify imports structure (<alias> <path>) and add them to the map. */
  #handleImports(
    importsMap: Map<
      string,
      { path: string; paramsVal: Record<string, string> }
    >,
    parts: string[]
  ) {
    if (parts.length < 2)
      throw new YAMLException(
        `Import directive should have at least 2 parts with the following structure: <alias> <path> <params>?`
      );

    // define alias and path, also remove "" from path if present
    const alias = parts[0];
    const path = parts[1].replaceAll('"', "");
    const paramsKeyVal = parts.slice(2) ?? [];

    // verify path
    const isYamlPath = pathRegex.test(path);
    if (!isYamlPath)
      throw new YAMLException(`This is not a valid YAML file path: ${path}`);

    // create params value object
    const paramsVal: Record<string, string> = {};
    for (const param of paramsKeyVal) {
      const split = param.split("=");

      if (split.length !== 2)
        throw new YAMLException(
          `Params in Import directive should have the following structure: key=value`
        );

      paramsVal[split[0]] = split[1];
    }

    // add them to the map
    importsMap.set(alias, { path, paramsVal });
  }

  /**
   * Helper method to check if line is empty (no chars or just "\s").
   * @param str - string which will be checked.
   * @returns boolean that indicates if line is empty or not.
   */
  #isEmptyLine(str: string) {
    return str.trim().length > 0;
  }
}
