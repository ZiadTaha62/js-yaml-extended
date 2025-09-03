import { resolve } from "path";
import { hashObj, hashStr } from "../helpers.js";
import type {
  LoadCache,
  LoadIdsToModules,
  ModulesToLoadIds,
  DirectivesObj,
  ModuleLoadCache,
  ParamsCache,
} from "../../types.js";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Main cache stores.
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Map of all loads, which is keyed by loadId and each load id stores the important input and output of load function.
 */
export const modulesCache: LoadCache = new Map();

/**
 *  Map that links load ids to modules they utilize.
 */
export const loadIdsToModules: LoadIdsToModules = new Map();

/**
 * Map that links modules to load ids that calls them.
 */
export const modulesToLoadIds: ModulesToLoadIds = new Map();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Cache interaction functions.
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to add module (str) data under existing loadId. while updating links between loadIds and modules as well.
 * @param loadId - Unique id that identifies this load.
 * @param str - YAML String passed.
 * @param filename - Path of the readed YAML file.
 * @param blueprint - Output from execution of the YAML string.
 * @param dirObj - Object that holds metadata about the directives.
 */
export function addModule(
  loadId: string,
  str: string,
  filename: string,
  blueprint: unknown,
  dirObj: DirectivesObj
): void {
  // resolve filename
  const resPath = resolve(filename);

  // hash string, params and path
  const hashedStr = hashStr(str);

  // get module cache
  let moduleCache = modulesCache.get(resPath);

  // if module cache is not present create new one
  if (!moduleCache) {
    moduleCache = {
      str,
      resPath,
      hashedStr,
      dirObj,
      blueprint: undefined,
      loadCache: new Map(),
    };
    modulesCache.set(resPath, moduleCache);
  }

  // save blueprint
  moduleCache.blueprint = blueprint;

  // id -> paths
  let paths = loadIdsToModules.get(loadId);
  if (!paths) {
    paths = new Set<string>();
    loadIdsToModules.set(loadId, paths);
  }
  paths.add(resPath);

  // path -> ids
  let ids = modulesToLoadIds.get(resPath);
  if (!ids) {
    ids = new Set<string>();
    modulesToLoadIds.set(resPath, ids);
  }
  ids.add(loadId);
}

/**
 * Function that checks if module's data are cached and return them, if not it returns undefined.
 * @param modulePath - Url path of the module that will be deleted.
 * @param str - Strin passed to load function.
 * @returns Module's cache data or undefined if not present.
 */
export function checkModuleCache(
  modulePath: string | undefined,
  str: string
): ModuleLoadCache | undefined {
  // if no path supplied return
  if (!modulePath) return;

  // check if module cache is present
  const moduleCache = modulesCache.get(modulePath);
  if (!moduleCache) return;

  // 2nd step verification by comparing old and new hashed str
  const newStrHash = hashStr(str);
  if (newStrHash !== moduleCache.hashedStr) return;

  // return blue print
  return moduleCache;
}

/**
 * Function that checks if specific load with module params is cached.
 * @param modulePath - Url path of the module that will be deleted.
 * @param paramsVal - Value of module params in YAML sting.
 * @returns Object that stores load value and module params used to load it.
 */
export function checkLoadCache(
  modulePath: string | undefined,
  paramsVal: Record<string, unknown> | undefined
): ParamsCache | undefined {
  // if no path supplied return
  if (!modulePath) return;

  // check if module cache is present (should be present but do this for ts)
  const moduleCache = modulesCache.get(modulePath);
  if (!moduleCache) return;

  // hash params
  const hashedParams = hashObj(paramsVal ?? {});

  // get cache of this load with params using hashed params
  const cache = moduleCache.loadCache.get(hashedParams);
  if (!cache) return;

  // return cache
  return cache;
}

/**
 * Function to reset blueprint and all loads of the module.
 * @param modulePath - Url path of the module that will be deleted.
 */
export function resetModule(modulePath: string): void {
  const moduleCache = modulesCache.get(modulePath);
  if (moduleCache) {
    moduleCache.blueprint = undefined;
    moduleCache.loadCache.clear();
  }
}

/**
 * Function to delete a module from load id, using in live loader.
 * @param loadId - Unique id that identifies this load.
 * @param modulePath - Url path of the module that will be deleted.
 */
export function deleteModule(loadId: string, modulePath: string): void {
  // delete link between loadId (live loader id) and the path or module
  loadIdsToModules.get(loadId)?.delete(modulePath);
  modulesToLoadIds.get(modulePath)?.delete(loadId);
  if (modulesToLoadIds.get(modulePath)?.size === 0)
    modulesCache.delete(modulePath);
}

/**
 * Function to delete load id along with all its links and modules cache if it was the only one utilizing them.
 * @param loadId - Unique id that identifies this load.
 */
export function deleteLoadId(loadId: string): void {
  // get modules of this loadId, if not present just return
  const modules = loadIdsToModules.get(loadId);

  // for each modules remove the loadId from it, and if it became empty delete the modulesCache
  if (modules)
    for (const m of modules) {
      const ids = modulesToLoadIds.get(m);
      if (!ids) continue;

      ids.delete(loadId);

      if (ids.size === 0) modulesCache.delete(m);
    }

  // finally remove the entry for loadId
  loadIdsToModules.delete(loadId);
}
