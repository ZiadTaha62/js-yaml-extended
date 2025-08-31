import { resolve } from "path";
import { readFile as readFileAsync } from "fs/promises";
import { readFileSync } from "fs";
import { YAMLException } from "../../../../wrapperClasses/error.js";
import {
  LoadOptions,
  InternalLoad,
  InternalLoadAsync,
} from "../../../../types.js";
import { CircularDepHandler } from "./circularDep.js";
import { fileNameRegex } from "../../regex.js";
import { isInsideSandBox, isYamlFile } from "../../helpers.js";

/** Class to handle importing another YAML files. */
export class ImportHandler {
  /** Class to handle circular dependency check */
  #circularDepClass: CircularDepHandler;

  /** Internal load function from load class. */
  #load: InternalLoad;

  /** Internal load async function from load class. */
  #loadAsync: InternalLoadAsync;

  constructor(load: InternalLoad, loadAsync: InternalLoadAsync) {
    this.#circularDepClass = new CircularDepHandler();
    this.#load = load;
    this.#loadAsync = loadAsync;
  }

  /** Method to import another YAML files synchronously. */
  import(
    modulePath: string,
    targetPath: string,
    targetParams: Record<string, string>,
    loadOpts: LoadOptions | undefined,
    loadId: string
  ) {
    // remove file name from module path if present
    const dirModulePath = this.#removeFileName(modulePath);

    // resolve path by adding targer path to module path
    const resPath = this.#handlePath(
      loadOpts?.basePath ?? process.cwd(),
      dirModulePath,
      targetPath
    );

    // read YAML file and get string
    const str = readFileSync(resPath, { encoding: "utf8" });

    // load str
    const load = this.#load(
      str,
      {
        ...loadOpts,
        paramsVal: targetParams,
        filename: resPath,
      },
      loadId
    );

    // return load
    return load;
  }

  /** Method to import another YAML files asynchronously. */
  async importAsync(
    modulePath: string,
    targetPath: string,
    targetParams: Record<string, string>,
    loadOpts: LoadOptions | undefined,
    loadId: string
  ) {
    // remove file name from module path if present
    const dirModulePath = this.#removeFileName(modulePath);

    // resolve path by adding targer path to module path
    const resPath = this.#handlePath(
      loadOpts?.basePath ?? process.cwd(),
      dirModulePath,
      targetPath
    );

    // read YAML file and get string
    const str = await readFileAsync(resPath, { encoding: "utf8" });

    // load str
    const load = await this.#loadAsync(
      str,
      {
        ...loadOpts,
        paramsVal: targetParams,
        filename: resPath,
      },
      loadId
    );

    // return load
    return load;
  }

  /** Method to handle relative paths by resolving & insuring that they live in the sandbox, also detect circular dependency if present. */
  #handlePath(
    basePath: string,
    modulePath: string,
    targetPath: string
  ): string {
    // resolve path
    const resPath = resolve(modulePath, targetPath);

    // make sure it's inside sandbox
    const isSandboxed = isInsideSandBox(basePath, resPath);
    if (!isSandboxed)
      throw new YAMLException(
        `Path used: ${targetPath} is out of scope of base path: ${basePath}`
      );

    const isYaml = isYamlFile(resPath);
    if (!isYaml)
      throw new YAMLException(
        `You can only load YAML files the loader. loaded file: ${resPath}`
      );

    // detect circular dependency if present
    const circularDep = this.#circularDepClass.addDep(modulePath, resPath);
    if (circularDep)
      throw new YAMLException(
        `Circular dependency detected: ${circularDep.join(" -> ")}`
      );

    // return path
    return resPath;
  }

  #removeFileName(path: string) {
    const match = path.match(fileNameRegex);
    if (match) {
      const pathParts = path.split(/\/|\\/);
      pathParts.pop();
      return pathParts.join("/");
    }
    return path;
  }
}
