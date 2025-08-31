/** Helper class to handle circular dependency checks. */
export class CircularDepHandler {
  /** adjacency list: node -> set of dependencies (edges node -> dep) */
  #graph = new Map<string, Set<string>>();

  addDep(modulePath: string, targetPath?: string): string[] | null {
    // guard if destroyed
    if (!this.#graph) return null;

    // ensure nodes exist
    if (!this.#graph.has(modulePath)) this.#graph.set(modulePath, new Set());

    // root/initial load — nothing to check
    if (!targetPath) return null;

    if (!this.#graph.has(targetPath)) this.#graph.set(targetPath, new Set());

    // add the edge modulePath -> targetPath
    this.#graph.get(modulePath)!.add(targetPath);

    // Now check if there's a path from targetPath back to modulePath.
    // If so, we constructed a cycle.
    const path = this.#findPath(targetPath, modulePath);
    if (path) {
      // path is [targetPath, ..., modulePath]
      // cycle: [modulePath, targetPath, ..., modulePath]
      return [modulePath, ...path];
    }

    return null;
  }

  /** Method to delete dep node (strId) from graph. */
  deleteDep(modulePath: string): boolean {
    // guard if destroyed
    if (!this.#graph) return false;

    let changed = false;

    // remove outgoing edges (delete node key)
    if (this.#graph.has(modulePath)) {
      this.#graph.delete(modulePath);
      changed = true;
    }

    // remove incoming edges from other nodes
    for (const [k, deps] of this.#graph.entries()) {
      if (deps.delete(modulePath)) changed = true;
    }

    return changed;
  }

  /** Method to null graph. */
  destroy() {
    this.#graph.clear();
  }

  #findPath(start: string, target: string): string[] | null {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      if (visited.has(node)) return false;
      visited.add(node);
      path.push(node);

      if (node === target) return true;

      const neighbors = this.#graph.get(node);
      if (neighbors) {
        for (const n of neighbors) {
          if (dfs(n)) return true;
        }
      }

      path.pop();
      return false;
    };

    return dfs(start) ? [...path] : null;
  }
}
