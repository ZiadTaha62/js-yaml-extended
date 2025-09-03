import { load as JLoad } from "js-yaml";
import type { LoadOptions as jLoadOptions } from "js-yaml";
import type {
  DirectivesObj,
  LoadOptions,
  ModuleLoadCache,
} from "../../types.js";
import { TagsHandler } from "./helperClasses/tagHandlers.js";
import { BridgeHandler } from "./helperClasses/bridge.js";
import { DirectivesHandler } from "./helperClasses/directives.js";
import { ResolveHandler } from "./treeResolving/resolveHandler.js";
import { WrapperYAMLException } from "../../wrapperClasses/error.js";
import {
  readFile,
  readFileAsync,
  resolvePath,
  generateId,
} from "../helpers.js";
import {
  checkModuleCache,
  checkLoadCache,
  addModule,
  deleteLoadId,
} from "./cache.js";
import { pathRegex } from "./regex.js";
import { resolve } from "path";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Helper classes that are used to load and resolve YAML strings.
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Directives handler class instance that is used to handle reading and normalizing directives back to normal YAML.
 */
const directivesHandler: DirectivesHandler = new DirectivesHandler();

/**
 * Tags handler class instance that is used to handle initial read of str using regex to capture tags and conversion of these tags into wrapper composite type
 * class that is ready to be bridged into js-yaml type class.
 */
const tagsHandler: TagsHandler = new TagsHandler();

/**
 * Bridge handler class instance that is used to convert wrapper classes (schema and type) into js-yaml classes.
 */
const bridgeHandler: BridgeHandler = new BridgeHandler();

/**
 * Resolve handler class that is used to resolve the raw node tree passed from js-yaml (handle tags and interpolation expressions).
 */
const resolveHandler: ResolveHandler = new ResolveHandler(
  internalLoad,
  internalLoadAsync
);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Main load functions.
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Load function to load YAML string into js object. works just like js-yaml load() but str is optional and you can either pass url path of the file or the actual YAML stirng. or just
 * leave it undefined and pass filename with the path inside opts. works sync as all the file reads and tag executions will be sync.
 * @param str - YAML string or url path for YAML file.
 * @param opts - Options object passed to load function.
 * @returnsL Loaded YAML string into js object.
 */
export function load(str?: string, opts?: LoadOptions): unknown {
  // set new loadId
  const loadId = generateId();

  // handle options
  const handledOpts = handleOpts(opts);

  // check if string passed is actually a url, if yes read the file and update both str and filename of opts
  const match = str?.match(pathRegex);
  if (match) {
    handledOpts.filename = resolve(handledOpts.basePath!, str!);
    str = rootFileRead(opts);
  }

  // if no string present read file using options's filename
  if (str === undefined) str = rootFileRead(handledOpts);

  try {
    // define vars that will hold blueprint and dirObj
    let blueprint: ModuleLoadCache["blueprint"];
    let dirObj: ModuleLoadCache["dirObj"];

    // get cache of the module
    const cachedModule = checkModuleCache(handledOpts.filename, str);

    // if module is cached get blue print and dir obj from it directly, if not execute string
    if (cachedModule && cachedModule.blueprint !== undefined) {
      blueprint = cachedModule.blueprint;
      dirObj = cachedModule.dirObj;
    } else {
      const val = executeStr(str, handledOpts, loadId);
      blueprint = val.blueprint;
      dirObj = val.dirObj;
    }

    // check if load with params is present in the cache
    const cachedLoad = checkLoadCache(
      handledOpts.filename,
      handledOpts.paramsVal
    );

    // if load is cached return it
    if (cachedLoad !== undefined) return cachedLoad.load;

    // resolve blueprint and return
    return resolveHandler.resolve(
      handledOpts.filename,
      blueprint,
      dirObj,
      handledOpts.paramsVal ?? {},
      loadId,
      handledOpts
    );
  } catch (err) {
    // if error not instance of error with message throw it directly
    if (!(err instanceof Error)) throw err;
    // add filename if supplied
    err.message = `${err.message}${
      handledOpts.filename
        ? ` This error occured in file: ${handledOpts.filename}`
        : ""
    }`;
    // rethrow
    throw err;
  } finally {
    deleteLoadId(loadId);
  }
}

/**
 * Load function to load YAML string into js object. works just like js-yaml load() but str is optional and you can either pass url path of the file or the actual YAML stirng. or just
 * leave it undefined and pass filename with the path inside opts. works async as all the file reads and tag executions will be async.
 * @param str - YAML string or url path for YAML file.
 * @param opts - Options object passed to load function.
 * @returnsL Loaded YAML string into js object.
 */
export async function loadAsync(
  str?: string,
  opts?: LoadOptions
): Promise<unknown> {
  // set new loadId
  const loadId = generateId();

  // handle options
  const handledOpts = handleOpts(opts);

  // check if string passed is actually a url, if yes read the file and update both str and filename of opts
  const match = str?.match(pathRegex);
  if (match) {
    handledOpts.filename = resolve(handledOpts.basePath!, str!);
    str = await rootFileReadAsync(opts);
  }

  // if no string present read file using options's filename
  if (str === undefined) str = await rootFileReadAsync(handledOpts);

  try {
    // define vars that will hold blueprint and dirObj
    let blueprint: ModuleLoadCache["blueprint"];
    let dirObj: ModuleLoadCache["dirObj"];

    // get cache of the module
    const cachedModule = checkModuleCache(handledOpts.filename, str);

    // if module is cached get blue print and dir obj from it directly, if not execute string
    if (cachedModule) {
      blueprint = cachedModule.blueprint;
      dirObj = cachedModule.dirObj;
    } else {
      const val = await executeStrAsync(str, handledOpts, loadId);
      blueprint = val.blueprint;
      dirObj = val.dirObj;
    }

    // check if load with params is present in the cache
    const cachedLoad = checkLoadCache(
      handledOpts.filename,
      handledOpts.paramsVal
    );

    // if load is cached return it
    if (cachedLoad !== undefined) return cachedLoad.load;

    // resolve blueprint and return
    return await resolveHandler.resolveAsync(
      handledOpts.filename,
      blueprint,
      dirObj,
      handledOpts.paramsVal ?? {},
      loadId,
      handledOpts
    );
  } catch (err) {
    // if error not instance of error with message throw it directly
    if (!(err instanceof Error)) throw err;
    // add filename if supplied
    err.message = `${err.message}${
      handledOpts.filename
        ? ` This error occured in file: ${handledOpts.filename}`
        : ""
    }`;
    // rethrow
    throw err;
  } finally {
    deleteLoadId(loadId);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Methods used by helper classes
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Just like load function but used in the code inside live loader and resolve handler. they execute the YAML string the same way load does but they don't create
 * new load id or handle clean-up and input validation. works sync.
 * @param str - YAML string or url path for YAML file.
 * @param opts - Options object passed to load function.
 * @param loadId - Load id of the load function or live loader that called it.
 * @returnsL Loaded YAML string into js object.
 */
export function internalLoad(
  str: string,
  opts: LoadOptions,
  loadId: string
): unknown {
  try {
    // define vars that will hold blueprint and dirObj
    let blueprint: ModuleLoadCache["blueprint"];
    let dirObj: ModuleLoadCache["dirObj"];

    // get cache of the module
    const cachedModule = checkModuleCache(opts.filename, str);

    // if module is cached get blue print and dir obj from it directly, if not execute string
    if (cachedModule) {
      blueprint = cachedModule.blueprint;
      dirObj = cachedModule.dirObj;
    } else {
      const val = executeStr(str, opts, loadId);
      blueprint = val.blueprint;
      dirObj = val.dirObj;
    }

    // check if load with params is present in the cache
    const cachedLoad = checkLoadCache(opts.filename, opts.paramsVal);

    // if load is cached return it
    if (cachedLoad !== undefined) return cachedLoad.load;

    // resolve blueprint and return
    return resolveHandler.resolve(
      opts.filename,
      blueprint,
      dirObj,
      opts.paramsVal ?? {},
      loadId,
      opts
    );
  } catch (err) {
    // if error not instance of error with message throw it directly
    if (!(err instanceof Error)) throw err;
    // add filename if supplied
    err.message = `${err.message}${
      opts.filename ? ` This error occured in file: ${opts.filename}` : ""
    }`;
    // rethrow
    throw err;
  }
}

/**
 * Just like load function but used in the code inside live loader and resolve handler. they execute the YAML string the same way load does but they don't create
 * new load id or handle clean-up and input validation. works async.
 * @param str - YAML string or url path for YAML file.
 * @param opts - Options object passed to load function.
 * @param loadId - Load id of the load function or live loader that called it.
 * @returnsL Loaded YAML string into js object.
 */
export async function internalLoadAsync(
  str: string,
  opts: LoadOptions,
  loadId: string
): Promise<unknown> {
  try {
    // define vars that will hold blueprint and dirObj
    let blueprint: ModuleLoadCache["blueprint"];
    let dirObj: ModuleLoadCache["dirObj"];

    // get cache of the module
    const cachedModule = checkModuleCache(opts.filename, str);

    // if module is cached get blue print and dir obj from it directly, if not execute string
    if (cachedModule) {
      blueprint = cachedModule.blueprint;
      dirObj = cachedModule.dirObj;
    } else {
      const val = await executeStrAsync(str, opts, loadId);
      blueprint = val.blueprint;
      dirObj = val.dirObj;
    }

    // check if load with params is present in the cache
    const cachedLoad = checkLoadCache(opts.filename, opts.paramsVal);

    // if load is cached return it
    if (cachedLoad !== undefined) return cachedLoad.load;

    // resolve blueprint and return
    return await resolveHandler.resolveAsync(
      opts.filename,
      blueprint,
      dirObj,
      opts.paramsVal ?? {},
      loadId,
      opts
    );
  } catch (err) {
    // if error not instance of error with message throw it directly
    if (!(err instanceof Error)) throw err;
    // add filename if supplied
    err.message = `${err.message}${
      opts.filename ? ` This error occured in file: ${opts.filename}` : ""
    }`;
    // rethrow
    throw err;
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Helper methdos
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to handle options by adding default needed values (basePath) if they weren't passed by user.
 * @param opts - Load options object.
 * @returns Options object with needed values.
 */
function handleOpts(opts: LoadOptions | undefined): LoadOptions {
  // if no options passed return default basePath and filename.
  if (!opts) return { basePath: process.cwd() };

  // if no base path passed set it to cwd
  if (!opts.basePath) opts.basePath = process.cwd();
  else opts.basePath = resolve(process.cwd(), opts.basePath);

  // resolve filename if supplied
  if (opts.filename) opts.filename = resolve(opts.basePath, opts.filename);

  // return options
  return opts;
}

/**
 * Method to read file from file system directly if str passed to load function was a path url or filename passed without str. works sync.
 * @param opts - Load options object.
 * @returns Read YAML string.
 */
function rootFileRead(opts: LoadOptions | undefined): string {
  // if no filename present throw
  if (!opts || !opts.filename)
    throw new WrapperYAMLException(
      `You should pass either a string to read or filename (path) of the YAML.`
    );
  // resolve path
  const resPath = resolvePath(opts.filename, opts.basePath!);
  // read file
  return readFile(resPath, opts.basePath!);
}

/**
 * Method to read file from file system directly if str passed to load function was a path url or filename passed without str. works async.
 * @param opts - Load options object.
 * @returns Read YAML string.
 */
async function rootFileReadAsync(
  opts: LoadOptions | undefined
): Promise<string> {
  // if no filename present throw
  if (!opts || !opts.filename)
    throw new WrapperYAMLException(
      `You should pass either a string to read or filename (path) of the YAML.`
    );
  // resolve path
  const resPath = resolvePath(opts.filename, opts.basePath!);
  // read file
  return await readFileAsync(resPath, opts.basePath!);
}

/**
 * Method to start handling the str by converting it to js-yaml compatible string and converting wrapper classes into js-yaml classes. it also convert the raw load
 * from js-yaml to a blueprint that is used to resolve the load. works sync.
 * @param str - YAML string or url path for YAML file.
 * @param opts - Options object passed to load function.
 * @param loadId - Load id of the load function or live loader that called it.
 * @returns Object that holds blue print and directive object which has meta data read from directive part of the YAML.
 */
function executeStr(
  str: string,
  opts: LoadOptions,
  loadId: string
): { blueprint: unknown; dirObj: DirectivesObj } {
  // read directives
  const { filteredStr, ...dirObj } = directivesHandler.handle(str);

  // handle tags by fetching them then converting them to wrapper types
  const tags = tagsHandler.captureTags(filteredStr);
  const types = tagsHandler.convertTagsToTypes(tags, opts.schema);

  // bridge from wrapper types to js-yaml types
  const JTypes = bridgeHandler.typesBridge(types);
  const JSchema = bridgeHandler.schemaBridge(opts.schema, JTypes);

  // load using js-yaml
  const rawLoad = JSchema
    ? JLoad(filteredStr, { ...opts, schema: JSchema } as jLoadOptions)
    : JLoad(filteredStr, { ...opts } as jLoadOptions);

  // create blueprint
  const blueprint = resolveHandler.createBlueprint(rawLoad);

  // add blueprint along with other module's data to the cache
  if (opts.filename) addModule(loadId, str, opts.filename, blueprint, dirObj);

  // return blueprint
  return { blueprint, dirObj };
}

/**
 * Method to start handling the str by converting it to js-yaml compatible string and converting wrapper classes into js-yaml classes. it also convert the raw load
 * from js-yaml to a blueprint that is used to resolve the load. works async.
 * @param str - YAML string or url path for YAML file.
 * @param opts - Options object passed to load function.
 * @param loadId - Load id of the load function or live loader that called it.
 * @returns Object that holds blue print and directive object which has meta data read from directive part of the YAML.
 */
async function executeStrAsync(
  str: string,
  opts: LoadOptions,
  loadId: string
): Promise<{ blueprint: unknown; dirObj: DirectivesObj }> {
  // read directives
  const { filteredStr, ...dirObj } = directivesHandler.handle(str);

  // handle tags by fetching them then converting them to wrapper types
  const tags = tagsHandler.captureTags(filteredStr);
  const types = tagsHandler.convertTagsToTypes(tags, opts.schema);

  // bridge from wrapper types to js-yaml types
  const JTypes = bridgeHandler.typesBridge(types);
  const JSchema = bridgeHandler.schemaBridge(opts.schema, JTypes);

  // load using js-yaml
  const rawLoad = JSchema
    ? JLoad(filteredStr, { ...opts, schema: JSchema } as jLoadOptions)
    : JLoad(filteredStr, { ...opts } as jLoadOptions);

  // create blueprint
  const blueprint = resolveHandler.createBlueprint(rawLoad);

  // add blueprint along with other module's data to the cache
  if (opts.filename) addModule(loadId, str, opts.filename, blueprint, dirObj);

  // return blueprint
  return { blueprint, dirObj };
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Exported types
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type Load = typeof load;
export type LoadAsync = typeof loadAsync;
export type InternalLoad = typeof internalLoad;
export type InternalLoadAsync = typeof internalLoadAsync;
