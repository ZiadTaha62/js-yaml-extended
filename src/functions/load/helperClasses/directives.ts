import { WrapperYAMLException } from "../../../wrapperClasses/error.js";
import { dirEndRegex, pathRegex } from "../regex.js";
import type { DirectivesObj } from "../../../types.js";

/**
 * Class to handle reading directives at the top of YAML string. it also strip them from the string and convert it back to normal YAML so it can be passed to js-yaml loader function.
 */
export class DirectivesHandler {
  /**
   * Method to read directives in YAML string, handle wrapper specific directives by reading and filtering them from original string.
   * @param str - String passed in load function.
   * @returns Filtered string ready to be fed to the parser along with directives object which holds meta data about directives to be used in the resolver.
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
      throw new WrapperYAMLException(
        "Directives splitting can only be done once."
      ); // more than one dir end mark in the file

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

      // split line into parts by deviding using white space
      const parts = line.split(" ").filter((v) => v);

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

  /**
   * Method to push private nodes to the private array of directives object.
   * @param privateArr - Reference to the array that holds private nodes and will be passed to directives object.
   * @param parts - Parts of the line.
   */
  #handlePrivate(privateArr: string[], parts: string[]): void {
    for (const p of parts) privateArr.push(p);
  }

  /**
   * Method to add to locals map where key is alias for the local and value is the default value.
   * @param localsMap - Reference to the map that holds local's aliases and default values and will be passed to directives object.
   * @param parts - Parts of the line.
   */
  #handleLocals(localsMap: Map<string, string>, parts: string[]): void {
    // make sure that alias is present
    if (parts.length < 1)
      throw new WrapperYAMLException(
        `Local directive should include at least alias.`
      );

    // get alias and default value
    const alias = parts[0];
    const defValue = parts[1];

    // add the alias with default value to the paramsMap
    localsMap.set(alias, defValue);
  }

  /**
   * Method to add to params map where key is alias for the param and value is the default value.
   * @param paramsMap - Reference to the map that holds params's aliases and default values and will be passed to directives object.
   * @param parts - Parts of the line.
   */
  #handleParams(paramsMap: Map<string, string>, parts: string[]) {
    // make sure that alias is present
    if (parts.length < 1)
      throw new WrapperYAMLException(
        `Param directive should include at least alias.`
      );
    // get alias and default value
    const alias = parts[0];
    const defValue = parts[1];

    // add the alias with default value to the paramsMap
    paramsMap.set(alias, defValue);
  }

  /** Method to verify imports structure (<alias> <path>) and add them to the map. */
  /**
   * Method to add to imports map where key is alias for the import and value is the path and default params values passed to this import.
   * @param importsMap - Reference to the map that holds imports's aliases and path with default params values and will be passed to directives object.
   * @param parts - Parts of the line.
   */
  #handleImports(
    importsMap: Map<
      string,
      { path: string; paramsVal: Record<string, string> }
    >,
    parts: string[]
  ): void {
    if (parts.length < 2)
      throw new WrapperYAMLException(
        `Import directive should have at least 2 parts with the following structure: <alias> <path> <params>?`
      );

    // define alias and path, also remove "" from path if present
    const alias = parts[0];
    const path = parts[1].replaceAll('"', "");
    const paramsKeyVal = parts.slice(2) ?? [];

    // verify path
    const isYamlPath = pathRegex.test(path);
    if (!isYamlPath)
      throw new WrapperYAMLException(
        `This is not a valid YAML file path: ${path}`
      );

    // create params value object
    const paramsVal: Record<string, string> = {};
    for (const param of paramsKeyVal) {
      const split = param.split("=");

      if (split.length !== 2)
        throw new WrapperYAMLException(
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
  #isEmptyLine(str: string): boolean {
    return str.trim().length > 0;
  }
}
