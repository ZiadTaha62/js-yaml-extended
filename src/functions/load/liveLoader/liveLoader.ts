import { LiveLoaderOptions } from "../../../types.js";
import { FileSystem } from "./fileSystem.js";
import { Debouncer } from "./debouncer.js";
import {
  loadIdsToModules,
  deleteModule as deleteModuleFromCache,
  resetModule,
} from "../cache.js";
import {
  readFile,
  readFileAsync,
  resolvePath,
  generateId,
} from "../../helpers.js";
import type { WatchEventType } from "fs";
import { internalLoad, internalLoadAsync } from "../load.js";

/**
 * Class that handles multiple YAML file entery points at the same time, while also watching these files and re-load them when they are changed.
 */
export class LiveLoader {
  /** Class to handle file system interactions in live loader. */
  #fileSystem: FileSystem = new FileSystem();

  /** Class to debounce updates of live loader. */
  #debouncer: Debouncer<void> = new Debouncer(200);

  /** Options of the live loading. */
  #liveLoaderOpts: LiveLoaderOptions = { basePath: process.cwd() };

  /** Random id generated for live loader and used as loadId in load function. */
  #liveLoaderId: string = generateId();

  /**
   * Method to set options of the live loader.
   * @param opts - New options that will be passed.
   */
  setLiveLoaderOptions(opts: LiveLoaderOptions) {
    this.#liveLoaderOpts = { ...this.#liveLoaderOpts, ...opts };
    if (!this.#liveLoaderOpts.basePath)
      this.#liveLoaderOpts.basePath = process.cwd();
  }

  /**
   * Method to add YAML file to the live loader using its path. works sync.
   * @param path - Path of the YAML file.
   * @param paramsVal - Optional params value to be passed to this loaded module.
   * @returns Resolved value of YAML file load.
   */
  addModule(path: string, paramsVal?: Record<string, string>): unknown {
    // get resolved path
    const resPath = resolvePath(path, this.#liveLoaderOpts.basePath!);
    // read str
    const str = readFile(resPath, this.#liveLoaderOpts.basePath!);

    try {
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
    } catch (err) {
      if (this.#liveLoaderOpts.logError) console.warn(err);
      if (this.#liveLoaderOpts.resetOnError) resetModule(resPath);
    }
  }

  /**
   * Method to add YAML file to the live loader using its path. works async.
   * @param path - Path of the YAML file.
   * @param paramsVal - Optional params value to be passed to this loaded module.
   * @returns Resolved value of YAML file load.
   */
  async addModuleAsync(
    path: string,
    paramsVal?: Record<string, string>
  ): Promise<unknown> {
    // get resolved path
    const resPath = resolvePath(path, this.#liveLoaderOpts.basePath!);
    // read str
    const str = await readFileAsync(resPath, this.#liveLoaderOpts.basePath!);

    try {
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
    } catch (err) {
      if (this.#liveLoaderOpts.resetOnError) resetModule(resPath);
      if (this.#liveLoaderOpts.logError) console.warn(err);
    }
  }

  /**
   * Method to delete YAML file from file being handled by live loader.
   * @param path - Path of the YAML file.
   */
  deleteModule(path: string): void {
    // delete module's cache
    deleteModuleFromCache(this.#liveLoaderId, path);
    // delete watcher
    this.#fileSystem.deleteFile(path);
  }

  /**
   * Method to delete all YAML files being handled by live loader.
   */
  deleteAllModules(): void {
    // check cache using loadId to get paths utilized by the live loader
    const paths = loadIdsToModules.get(this.#liveLoaderId);
    if (!paths) return;
    // if paths delete all of them
    for (const p of paths) this.deleteModule(p);
  }

  /**
   * Method to create callbacks that will be passed to fs watch function.
   * @param path - Path of the YAML file.
   * @param async - Boolean that indicates if file load in the change callback should run async or not.
   * @returns Callback function that will be passed to fs watch function.
   */
  #watchCallbackFactory(
    path: string,
    async: boolean
  ): (eventType: WatchEventType) => void {
    return (e) => {
      try {
        this.#debouncer.debounce(() => {
          // if file is change reset it's cache then re-load it
          if (e === "change") {
            // reset module cache so it will be re-evaluated
            resetModule(path);

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
      } catch (err) {
        if (this.#liveLoaderOpts.logError) console.warn(err);
        if (this.#liveLoaderOpts.resetOnError) resetModule(path);
      }
    };
  }
}
