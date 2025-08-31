import { YAMLException } from "../../../wrapperClasses/error.js";

/** Class that replaces any scalar in the raw load. leaving only blueprint or structure of YAML file. */
export class BluePrintItem {
  #resolved: boolean = false;
  #rawValue: unknown;

  constructor(rawValue: unknown) {
    this.#rawValue = rawValue;
  }

  resolve() {
    this.#resolved = true;
    return this.#rawValue;
  }

  resolveAnchor(path: string[] | undefined) {
    if (!this.#resolved)
      throw new YAMLException(
        `Tried to access ${
          path ? path.join(".") : "value"
        } before intialization.`
      );
    return this.#rawValue;
  }

  get rawValue() {
    return this.#rawValue;
  }

  get resolved() {
    return this.#resolved;
  }
}
