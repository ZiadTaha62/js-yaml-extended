import { type FSWatcher, type WatchEventType, watch } from "fs";

export class FileSystem {
  #files: string[] = [];
  #watchers: Map<string, FSWatcher> = new Map();

  /** Method to check if file is watched. */
  hasFile(path: string) {
    return this.#files.includes(path);
  }

  /** Method to watch file changes. */
  addFile(path: string, callback: (eventType: WatchEventType) => void) {
    // if already watched return
    if (this.#files.includes(path)) return;

    // create and add watcher to watcher's array
    const watcher = watch(path, callback);
    this.#watchers.set(path, watcher);

    // add file to files array
    this.#files.push(path);
  }

  /** Method to delete watched file. */
  deleteFile(path: string) {
    // delete file from file's array
    const idx = this.#files.indexOf(path);
    if (idx !== -1) this.#files.splice(idx, 1);

    // get watcher and delete it
    const watcher = this.#watchers.get(path);
    if (!watcher) return;
    watcher.removeAllListeners();
    watcher.close();
    this.#watchers.delete(path);
  }

  /** Files being watched. */
  get files() {
    return this.#files;
  }
}
