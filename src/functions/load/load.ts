import { load as JLoad, YAMLException } from "js-yaml";
import type { LoadOptions as jLoadOptions } from "js-yaml";
import type {
  DirectivesObj,
  LoadOptions,
  ModuleLoadCache,
  HandledLoadOpts,
} from "../../types.js";
import { TagsHandler } from "./helperClasses/tagHandlers.js";
import { bridgeHandler } from "../bridge.js";
import { DirectivesHandler } from "./helperClasses/directives.js";
import { ResolveHandler } from "./treeResolving/resolveHandler.js";
import { WrapperYAMLException } from "../../wrapperClasses/error.js";
import { circularDepClass } from "./treeResolving/interpolation/import.js";
import {
  readFile,
  readFileAsync,
  resolvePath,
  generateId,
} from "../helpers.js";
import {
  getModuleCache,
  getLoadCache,
  addModuleCache,
  addLoadCache,
  deleteLoadIdFromCache,
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
export function load(str: string, opts?: LoadOptions): unknown {
  // if no str present throw an error
  if (str === undefined)
    throw new YAMLException(
      `You should pass either YAML string or url path of YAML file in str.`
    );

  // set new loadId
  const loadId = generateId();

  // handle options
  const handledOpts = handleOpts(opts);

  // check if string passed is actually a url, if yes read the file and update both str and filename of opts
  const match = str.match(pathRegex);
  if (match) {
    handledOpts.filename = resolve(handledOpts.basePath!, str!);
    str = rootFileRead(handledOpts);
  }

  // if no string present read file using options's filename
  if (str === undefined) str = rootFileRead(handledOpts);

  try {
    // define vars that will hold blueprint and dirObj
    let blueprint: ModuleLoadCache["blueprint"];
    let dirObj: ModuleLoadCache["dirObj"];

    // get cache of the module
    const cachedModule = getModuleCache(handledOpts.filename, str);

    // if module is cached get blue print and dir obj from it directly, if not execute string
    if (cachedModule && cachedModule.blueprint !== undefined) {
      blueprint = cachedModule.blueprint;
      dirObj = cachedModule.dirObj;
    } else {
      // execute string
      const val = handleNewModule(str, handledOpts, loadId);
      blueprint = val.blueprint;
      dirObj = val.dirObj;
    }

    // check if load with params is present in the cache
    const cachedLoad = getLoadCache(
      handledOpts.filename,
      handledOpts.paramsVal
    );

    // if load is cached return it
    if (cachedLoad !== undefined) return cachedLoad.load;

    // resolve blueprint and return
    const load = resolveHandler.resolve(
      handledOpts.filename,
      blueprint,
      dirObj,
      handledOpts.paramsVal ?? {},
      loadId,
      handledOpts
    );

    // add load to the cache if filename is supplied
    if (handledOpts.filename)
      addLoadCache(handledOpts.filename, handledOpts.paramsVal, load);

    // return load
    return load;
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
    deleteLoadIdFromCache(loadId);
    circularDepClass.deleteLoadId(loadId);
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
  str: string,
  opts?: LoadOptions
): Promise<unknown> {
  // if no str present throw an error
  if (str === undefined)
    throw new YAMLException(
      `You should pass either YAML string or url path of YAML file in str.`
    );

  // set new loadId
  const loadId = generateId();

  // handle options
  const handledOpts = handleOpts(opts);

  // check if string passed is actually a url, if yes read the file and update both str and filename of opts
  const match = str.match(pathRegex);
  if (match) {
    handledOpts.filename = resolve(handledOpts.basePath!, str!);
    str = await rootFileReadAsync(handledOpts);
  }

  try {
    // define vars that will hold blueprint and dirObj
    let blueprint: ModuleLoadCache["blueprint"];
    let dirObj: ModuleLoadCache["dirObj"];

    // get cache of the module
    const cachedModule = getModuleCache(handledOpts.filename, str);

    // if module is cached get blue print and dir obj from it directly, if not execute string
    if (cachedModule && cachedModule.blueprint !== undefined) {
      blueprint = cachedModule.blueprint;
      dirObj = cachedModule.dirObj;
    } else {
      const val = await handleNewModuleAsync(str, handledOpts, loadId);
      blueprint = val.blueprint;
      dirObj = val.dirObj;
    }

    // check if load with params is present in the cache
    const cachedLoad = getLoadCache(
      handledOpts.filename,
      handledOpts.paramsVal
    );

    // if load is cached return it
    if (cachedLoad !== undefined) return cachedLoad.load;

    // resolve blueprint and return
    const load = await resolveHandler.resolveAsync(
      handledOpts.filename,
      blueprint,
      dirObj,
      handledOpts.paramsVal ?? {},
      loadId,
      handledOpts
    );

    // add load to the cache if filename is supplied
    if (handledOpts.filename)
      addLoadCache(handledOpts.filename, handledOpts.paramsVal, load);

    // return load
    return load;
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
    deleteLoadIdFromCache(loadId);
    circularDepClass.deleteLoadId(loadId);
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
  // handle options
  const handledOpts = handleOpts(opts);

  try {
    // define vars that will hold blueprint and dirObj
    let blueprint: ModuleLoadCache["blueprint"];
    let dirObj: ModuleLoadCache["dirObj"];

    // get cache of the module
    const cachedModule = getModuleCache(handledOpts.filename, str);

    // if module is cached get blue print and dir obj from it directly, if not execute string
    if (cachedModule && cachedModule.blueprint !== undefined) {
      blueprint = cachedModule.blueprint;
      dirObj = cachedModule.dirObj;
    } else {
      const val = handleNewModule(str, handledOpts, loadId);
      blueprint = val.blueprint;
      dirObj = val.dirObj;
    }

    // check if load with params is present in the cache
    const cachedLoad = getLoadCache(
      handledOpts.filename,
      handledOpts.paramsVal
    );

    // if load is cached return it
    if (cachedLoad !== undefined) return cachedLoad.load;

    // resolve blueprint and return
    const load = resolveHandler.resolve(
      handledOpts.filename,
      blueprint,
      dirObj,
      handledOpts.paramsVal ?? {},
      loadId,
      handledOpts
    );

    // add load to the cache if filename is supplied
    if (handledOpts.filename)
      addLoadCache(handledOpts.filename, handledOpts.paramsVal, load);

    // return load
    return load;
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
  // handle options
  const handledOpts = handleOpts(opts);

  try {
    // define vars that will hold blueprint and dirObj
    let blueprint: ModuleLoadCache["blueprint"];
    let dirObj: ModuleLoadCache["dirObj"];

    // get cache of the module
    const cachedModule = getModuleCache(handledOpts.filename, str);

    // if module is cached get blue print and dir obj from it directly, if not execute string
    if (cachedModule && cachedModule.blueprint !== undefined) {
      blueprint = cachedModule.blueprint;
      dirObj = cachedModule.dirObj;
    } else {
      const val = await handleNewModuleAsync(str, handledOpts, loadId);
      blueprint = val.blueprint;
      dirObj = val.dirObj;
    }

    // check if load with params is present in the cache
    const cachedLoad = getLoadCache(
      handledOpts.filename,
      handledOpts.paramsVal
    );

    // if load is cached return it
    if (cachedLoad !== undefined) return cachedLoad.load;

    // resolve blueprint and return
    const load = await resolveHandler.resolveAsync(
      handledOpts.filename,
      blueprint,
      dirObj,
      handledOpts.paramsVal ?? {},
      loadId,
      handledOpts
    );

    // add load to the cache if filename is supplied
    if (handledOpts.filename)
      addLoadCache(handledOpts.filename, handledOpts.paramsVal, load);

    // return load
    return load;
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
function handleOpts(opts: LoadOptions | undefined): HandledLoadOpts {
  const basePath = opts?.basePath
    ? resolve(process.cwd(), opts.basePath)
    : process.cwd();
  const filename = opts?.filename && resolve(basePath, opts.filename);
  return {
    ...opts,
    basePath,
    paramsVal: opts?.paramsVal ?? {},
    filename,
  } as HandledLoadOpts;
}

/**
 * Method to read file from file system directly if str passed to load function was a path url or filename passed without str. works sync.
 * @param opts - Load options object.
 * @returns Read YAML string.
 */
function rootFileRead(opts: HandledLoadOpts): string {
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
async function rootFileReadAsync(opts: HandledLoadOpts): Promise<string> {
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
 * Function to handle new YAML file that hasn't been loaded before by creating module cache with blueprint for it. it also resolve the blueprint with empty params
 * value and save this load as it's the pure load of the module only. works sync.
 * @param str - YAML string or url path for YAML file.
 * @param opts - Options object passed to load function.
 * @param loadId - Load id of the load function or live loader that called it.
 * @returns Object that holds blue print and directive object which has meta data read from directive part of the YAML.
 */
function handleNewModule(
  str: string,
  opts: HandledLoadOpts,
  loadId: string
): { blueprint: unknown; dirObj: DirectivesObj } {
  // execute string
  const val = executeStr(str, opts, loadId);
  const blueprint = val.blueprint;
  const dirObj = val.dirObj;
  // resolve with undefined params
  const load = resolveHandler.resolve(
    opts.filename,
    blueprint,
    dirObj,
    {},
    loadId,
    opts
  );
  // add load to the cache if filename is supplied
  if (opts.filename) addLoadCache(opts.filename, opts.paramsVal, load);
  // return blueprint and directives object
  return { blueprint, dirObj };
}

/**
 * Function to handle new YAML file that hasn't been loaded before by creating module cache with blueprint for it. it also resolve the blueprint with empty params
 * value and save this load as it's the pure load of the module only. works async.
 * @param str - YAML string or url path for YAML file.
 * @param opts - Options object passed to load function.
 * @param loadId - Load id of the load function or live loader that called it.
 * @returns Object that holds blue print and directive object which has meta data read from directive part of the YAML.
 */
async function handleNewModuleAsync(
  str: string,
  opts: HandledLoadOpts,
  loadId: string
): Promise<{ blueprint: unknown; dirObj: DirectivesObj }> {
  // execute string
  const val = await executeStrAsync(str, opts, loadId);
  const blueprint = val.blueprint;
  const dirObj = val.dirObj;
  // resolve with undefined params
  const load = await resolveHandler.resolveAsync(
    opts.filename,
    blueprint,
    dirObj,
    {},
    loadId,
    opts
  );
  // add load to the cache if filename is supplied
  if (opts.filename) addLoadCache(opts.filename, opts.paramsVal, load);
  // return blueprint and directives object
  return { blueprint, dirObj };
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
  opts: HandledLoadOpts,
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
  if (opts.filename)
    addModuleCache(loadId, str, opts.filename, blueprint, dirObj);

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
  opts: HandledLoadOpts,
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
  if (opts.filename)
    addModuleCache(loadId, str, opts.filename, blueprint, dirObj);

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
