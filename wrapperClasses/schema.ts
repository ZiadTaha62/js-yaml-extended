import type { SchemaDefinition } from "../types.js";
import { Type } from "./type.js";

export class Schema {
  /** Object to hold types added to the schema. */
  #types: Record<
    string,
    Partial<Record<"sequence" | "scalar" | "mapping" | "undefined", Type>>
  > = {};

  /** Var to hold group if special group is used. */
  #group: "FAILSAFE" | "JSON" | "CORE" | "DEFAULT" | undefined;

  constructor(
    definition: SchemaDefinition | Type | Type[],
    group?: "FAILSAFE" | "JSON" | "CORE" | "DEFAULT" | undefined
  ) {
    this.#addTypes(definition);
    this.#group = group;
  }

  extend(types: SchemaDefinition | Type[] | Type): Schema {
    this.#addTypes(types);
    return this;
  }

  /** Helper to add types through constructor or extend functions. */
  #addTypes(types: SchemaDefinition | Type | Type[]) {
    // if array convert it to object
    if (Array.isArray(types)) {
      for (const t of types) {
        const kind = String(t.kind) as
          | "sequence"
          | "scalar"
          | "mapping"
          | "undefined";
        this.#types[t.tag] ??= {};
        this.#types[t.tag][kind] = t;
      }
      return;
    }
    // if single type add it directly
    if (types instanceof Type) {
      const kind = String(types.kind) as
        | "sequence"
        | "scalar"
        | "mapping"
        | "undefined";
      this.#types[types.tag] ??= {};
      this.#types[types.tag][kind] = types;
      return;
    }
    // if implicit types add them
    if (types.implicit) {
      for (const t of types.implicit) {
        const kind = String(t.kind) as
          | "sequence"
          | "scalar"
          | "mapping"
          | "undefined";
        this.#types[t.tag] ??= {};
        this.#types[t.tag][kind] = t;
      }
    }
    // if explicit types add them
    if (types.explicit) {
      for (const t of types.explicit) {
        const kind = String(t.kind) as
          | "sequence"
          | "scalar"
          | "mapping"
          | "undefined";
        this.#types[t.tag] ??= {};
        this.#types[t.tag][kind] = t;
      }
    }
  }

  get types() {
    return this.#types;
  }

  get group() {
    return this.#group;
  }
}
