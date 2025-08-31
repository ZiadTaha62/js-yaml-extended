import { LiveLoaderOptions } from "../../../types.js";
import { FileSystem } from "./fileSystem.js";
import { Debouncer } from "./debouncer.js";
import {
  loadIdsToModules,
  modulesCache,
  deleteModule as deleteModuleFromCache,
} from "../cache.js";
import { readFile, readFileAsync, resolvePath } from "../helpers.js";
import { generateId } from "../helpers.js";
import type { WatchEventType } from "fs";
import { internalLoad, internalLoadAsync } from "../load.js";

export class LiveLoader {
  /** Class to handle file system watching in live loader. */
  #fileSystem: FileSystem = new FileSystem();

  /** Class to debounce updates of live loader. */
  #debouncer: Debouncer<void> = new Debouncer(200);

  /** Options of the live loading. */
  #liveLoaderOpts: LiveLoaderOptions = { basePath: process.cwd() };

  /** Random id generated for live loader. */
  #liveLoaderId: string = generateId();

  /** Method to set options of the live loader. works sync, also note that file watcher will work sync as well and with every update to the file it will  */
  setLiveLoaderOptions(opts: LiveLoaderOptions) {
    this.#liveLoaderOpts = { ...this.#liveLoaderOpts, ...opts };
    if (!this.#liveLoaderOpts.basePath)
      this.#liveLoaderOpts.basePath = process.cwd();
  }

  /** Method to add a path to the live loader. */
  addModule(path: string, paramsVal?: Record<string, unknown>): unknown {
    // get resolved path
    const resPath = resolvePath(path, this.#liveLoaderOpts.basePath!);
    // read str
    const str = readFile(resPath, this.#liveLoaderOpts.basePath!);
    // load str
    const load = internalLoad(
      str,
      { ...this.#liveLoaderOpts, paramsVal },
      this.#liveLoaderId
    );
    // check cache using loadId to get paths utilized by the live loader
    const paths = loadIdsToModules.get(this.#liveLoaderId);
    // if no paths return load directly
    if (!paths) return load;
    // if paths watch all of them then return load
    for (const p of paths) {
      if (this.#fileSystem.hasFile(p)) continue;
      const callback = this.#watchCallbackFactory(p, false);
      this.#fileSystem.addFile(p, callback);
    }
    return load;
  }

  /** Method to add a path to the live loader. */
  async addModuleAsync(
    path: string,
    paramsVal?: Record<string, unknown>
  ): Promise<unknown> {
    // get resolved path
    const resPath = resolvePath(path, this.#liveLoaderOpts.basePath!);
    // read str
    const str = await readFileAsync(resPath, this.#liveLoaderOpts.basePath!);
    // load str
    const load = await internalLoadAsync(
      str,
      { ...this.#liveLoaderOpts, paramsVal },
      this.#liveLoaderId
    );
    // check cache using loadId to get paths utilized by the live loader
    const paths = loadIdsToModules.get(this.#liveLoaderId);
    // if no paths return load directly
    if (!paths) return load;
    // if paths watch all of them then return load
    for (const p of paths) {
      if (this.#fileSystem.hasFile(p)) continue;
      const callback = this.#watchCallbackFactory(p, true);
      this.#fileSystem.addFile(p, callback);
    }
    return load;
  }

  /** Method to delete a path from the live loader. */
  deleteModule(path: string) {
    // delete module's cache
    deleteModuleFromCache(this.#liveLoaderId, path);
    // delete watcher
    this.#fileSystem.deleteFile(path);
  }

  deleteAllModules(): void {
    // check cache using loadId to get paths utilized by the live loader
    const paths = loadIdsToModules.get(this.#liveLoaderId);
    if (!paths) return;
    // if paths delete all of them
    for (const p of paths) this.deleteModule(p);
  }

  /** Method to create watch functions in live loader. */
  #watchCallbackFactory(
    path: string,
    async: boolean
  ): (eventType: WatchEventType) => void {
    return (e) => {
      this.#debouncer.debounce(() => {
        // if file is change reset it's cache then re-load it
        if (e === "change") {
          // reset module cache so it will be re-evaluated
          const moduleCache = modulesCache.get(path);
          if (moduleCache) {
            moduleCache.baseLoad = undefined;
            moduleCache.paramsCache.clear();
          }

          // re-load
          if (async) this.addModule(path);
          else this.addModuleAsync(path);
        }

        // if file is renamed delete it's cache as all future loads will use the new name
        if (e === "rename") this.deleteModule(path);

        // execute listener
        if (this.#liveLoaderOpts.onUpdate)
          this.#liveLoaderOpts.onUpdate(path, e);
      });
    };
  }
}
