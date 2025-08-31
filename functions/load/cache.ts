import { resolve } from "path";
import { hashObj, hashStr } from "./helpers.js";
import type {
  LoadCache,
  LoadIdsToModules,
  ModulesToLoadIds,
  DirectivesObj,
} from "../../types.js";

/** Object that will hold all the payloads passed to load functions. */
export const modulesCache: LoadCache = new Map();

/** Map that links load ids to modules they utilize. */
export const loadIdsToModules: LoadIdsToModules = new Map();

/** Map that links modules to load ids that calls them. */
export const modulesToLoadIds: ModulesToLoadIds = new Map();

export function addModule(
  loadId: string,
  str: string,
  filename: string,
  blueprint: unknown,
  dirObj: DirectivesObj
) {
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
      bluePrint: undefined,
      loadCache: new Map(),
    };
    modulesCache.set(resPath, moduleCache);
  }

  // save blueprint
  moduleCache.bluePrint = blueprint;

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

/** Method to delete a path from the live loader. */
export function deleteModule(loadId: string, module: string) {
  // delete link between loadId (live loader id) and the path or module
  loadIdsToModules.get(loadId)?.delete(module);
  modulesToLoadIds.get(module)?.delete(loadId);
  if (modulesToLoadIds.get(module)?.size === 0) modulesCache.delete(module);
}

/** Method to check base load cache. */
export function checkModuleCache(modulePath: string | undefined, str: string) {
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

/** Method to check load cache according to params value passed. */
export function checkLoadCache(
  modulePath: string | undefined,
  paramsVal: Record<string, unknown> | undefined
) {
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

/** Method to cleanUp after reading all str of current execution (loadId). */
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
