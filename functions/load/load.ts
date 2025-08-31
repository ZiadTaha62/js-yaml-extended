import { load as JLoad } from "js-yaml";
import type { LoadOptions as jLoadOptions } from "js-yaml";
import type { DirectivesObj, LoadOptions } from "../../types.js";
import { TagsHandler } from "./helperClasses/tagHandlers.js";
import { BridgeHandler } from "./helperClasses/bridge.js";
import { DirectivesHandler } from "./helperClasses/directives.js";
import { ResolveHandler } from "./treeResolving/resolveHandler.js";
import { YAMLException } from "../../wrapperClasses/error.js";
import { readFile, readFileAsync, resolvePath, generateId } from "./helpers.js";
import {
  checkModuleCache,
  checkLoadCache,
  addModule,
  deleteLoadId,
} from "./cache.js";
import { pathRegex } from "./regex.js";

/** Directives handler class instance that is used to handle reading and normalizing directives back to normal YAML. */
const directivesHandler: DirectivesHandler = new DirectivesHandler();

/** Tags handler class instance that is used to handle initial read of str using regex to capture tags and conversion of these tags into wrapper composite type class that is ready to be bridged into js-yaml type class. */
const tagsHandler: TagsHandler = new TagsHandler();

/** Bridge handler class instance that is used to convert wrapper classes (schema and type) into js-yaml classes. */
const bridgeHandler: BridgeHandler = new BridgeHandler();

/** Class to handle resolving of the raw tree (handling tags and interpolation expressions). */
const resolveHandler: ResolveHandler = new ResolveHandler(
  internalLoad,
  internalLoadAsync
);

export function load(str?: string, opts?: LoadOptions): unknown {
  // set new loadId
  const loadId = generateId();

  // handle options
  const handledOpts = handleOpts(opts);

  // check if string passed is actually a url, if yes read the file and update both str and filename of opts
  const match = str?.match(pathRegex);
  if (match) {
    handledOpts.filename = str;
    str = rootFileRead(opts);
  }

  // if no string present read file using options's filename
  if (str === undefined) str = rootFileRead(handledOpts);

  try {
    // define vars that will hold blueprint and dirObj
    let bluePrint;
    let dirObj;

    // get cache of the module
    const cachedModule = checkModuleCache(handledOpts.filename, str);

    // if module is cached get blue print and dir obj from it directly, if not execute string
    if (cachedModule) {
      bluePrint = cachedModule.bluePrint;
      dirObj = cachedModule.dirObj;
    } else {
      const val = executeStr(str, handledOpts, loadId);
      bluePrint = val.blueprint;
      dirObj = val.dirObj;
    }

    // check if load with params is present in the cache
    const cachedLoad = checkLoadCache(
      handledOpts.filename,
      handledOpts.paramsVal
    );

    // if load is cached return it
    if (cachedLoad) return cachedLoad.load;

    // resolve blueprint and return
    return resolveHandler.resolve(
      handledOpts.filename,
      bluePrint,
      dirObj,
      handledOpts.paramsVal ?? {},
      loadId,
      handledOpts
    );
  } finally {
    deleteLoadId(loadId);
  }
}

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
    handledOpts.filename = str;
    str = await rootFileReadAsync(opts);
  }

  // if no string present read file using options's filename
  if (str === undefined) str = await rootFileReadAsync(handledOpts);

  try {
    // define vars that will hold blueprint and dirObj
    let bluePrint;
    let dirObj;

    // get cache of the module
    const cachedModule = checkModuleCache(handledOpts.filename, str);

    // if module is cached get blue print and dir obj from it directly, if not execute string
    if (cachedModule) {
      bluePrint = cachedModule.bluePrint;
      dirObj = cachedModule.dirObj;
    } else {
      const val = await executeStrAsync(str, handledOpts, loadId);
      bluePrint = val.blueprint;
      dirObj = val.dirObj;
    }

    // check if load with params is present in the cache
    const cachedLoad = checkLoadCache(
      handledOpts.filename,
      handledOpts.paramsVal
    );

    // if load is cached return it
    if (cachedLoad) return cachedLoad.load;

    // resolve blueprint and return
    return await resolveHandler.resolveAsync(
      handledOpts.filename,
      bluePrint,
      dirObj,
      handledOpts.paramsVal ?? {},
      loadId,
      handledOpts
    );
  } finally {
    deleteLoadId(loadId);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Methods used by helper classes
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/** Method to allow classes as Imports and createLoad read load YAML strings. */
export function internalLoad(
  str: string,
  opts: LoadOptions,
  loadId: string
): unknown {
  // define vars that will hold blueprint and dirObj
  let bluePrint;
  let dirObj;

  // get cache of the module
  const cachedModule = checkModuleCache(opts.filename, str);

  // if module is cached get blue print and dir obj from it directly, if not execute string
  if (cachedModule) {
    bluePrint = cachedModule.bluePrint;
    dirObj = cachedModule.dirObj;
  } else {
    const val = executeStr(str, opts, loadId);
    bluePrint = val.blueprint;
    dirObj = val.dirObj;
  }

  // check if load with params is present in the cache
  const cachedLoad = checkLoadCache(opts.filename, opts.paramsVal);

  // if load is cached return it
  if (cachedLoad) return cachedLoad.load;

  // resolve blueprint and return
  return resolveHandler.resolve(
    opts.filename,
    bluePrint,
    dirObj,
    opts.paramsVal ?? {},
    loadId,
    opts
  );
}

/** Method to allow classes as Imports and createLoad read load YAML strings. */
export async function internalLoadAsync(
  str: string,
  opts: LoadOptions,
  loadId: string
): Promise<unknown> {
  // define vars that will hold blueprint and dirObj
  let bluePrint;
  let dirObj;

  // get cache of the module
  const cachedModule = checkModuleCache(opts.filename, str);

  // if module is cached get blue print and dir obj from it directly, if not execute string
  if (cachedModule) {
    bluePrint = cachedModule.bluePrint;
    dirObj = cachedModule.dirObj;
  } else {
    const val = await executeStrAsync(str, opts, loadId);
    bluePrint = val.blueprint;
    dirObj = val.dirObj;
  }

  // check if load with params is present in the cache
  const cachedLoad = checkLoadCache(opts.filename, opts.paramsVal);

  // if load is cached return it
  if (cachedLoad) return cachedLoad.load;

  // resolve blueprint and return
  return await resolveHandler.resolveAsync(
    opts.filename,
    bluePrint,
    dirObj,
    opts.paramsVal ?? {},
    loadId,
    opts
  );
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Helper methdos
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/** Method to read file from file system directly if no string was supplied to load(). works sync. */
function rootFileRead(opts: LoadOptions | undefined): string {
  // if no filename present throw
  if (!opts || !opts.filename)
    throw new YAMLException(
      `You should pass either a string to read or filename (path) of the YAML.`
    );
  // resolve path
  const resPath = resolvePath(opts.filename, opts.basePath!);
  // read file
  return readFile(resPath, opts.basePath!);
}

/** Method to read file from file system directly if no string was supplied to load(). works async. */
async function rootFileReadAsync(
  opts: LoadOptions | undefined
): Promise<string> {
  // if no filename present throw
  if (!opts || !opts.filename)
    throw new YAMLException(
      `You should pass either a string to read or filename (path) of the YAML.`
    );
  // resolve path
  const resPath = resolvePath(opts.filename, opts.basePath!);
  // read file
  return await readFileAsync(resPath, opts.basePath!);
}

/** Method to start execution of the wrapper and handling of the str. */
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

/** Method to handle options by adding default needed values if they weren't passed by user. */
function handleOpts(opts: LoadOptions | undefined): LoadOptions {
  // if no options passed return default basePath and filename.
  if (!opts) return { basePath: process.cwd() };

  // if no base path passed set it to cwd
  if (!opts.basePath) opts.basePath = process.cwd();

  // return options
  return opts;
}

export type Load = typeof load;
export type LoadAsync = typeof loadAsync;
export type InternalLoad = typeof internalLoad;
export type InternalLoadAsync = typeof internalLoadAsync;
