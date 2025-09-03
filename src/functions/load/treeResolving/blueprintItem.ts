import { WrapperYAMLException } from "../../../wrapperClasses/error.js";

/**
 * Class that replaces any scalar or interpolation in the raw load. leaving only blueprint items and structure of YAML file. there blue print items are used as storing containers
 * for raw load and interpolations while also save history of resolving, which is needed to be able to dynamically resolve node tree, so with different locals or params values
 * the same raw load gives different final values.
 */
export class BlueprintItem {
  /** Boolean that indicates if blueprint item has been resolved at least once or not, important to prevent referencing nodes in the YAML text that have not been resolved yet. */
  #resolved: boolean = false;

  /** Stored raw value from js-yaml load. */
  #rawValue: unknown;

  /**
   * @param rawValue - Value returned from js-yaml load directly before resolving.
   */
  constructor(rawValue: unknown) {
    this.#rawValue = rawValue;
  }

  /**
   * Method to resolve item be setting resolve to true and return raw value, used only inside the main resolve loop.
   * @returns Raw value from the js-yaml load.
   */
  resolve(): unknown {
    this.#resolved = true;
    return this.#rawValue;
  }

  /**
   * Method to resolve item by retuning raw value, but with a check if node has been resolved or not yet, if not error is thrown. used in reference interpolations as $this and $import.
   * @param path - Path of the node in the tree, used for error messages.
   * @returns Raw value from the js-yaml load.
   */
  resolveAnchor(path: string[] | undefined): unknown {
    if (!this.#resolved)
      throw new WrapperYAMLException(
        `Tried to access ${
          path ? path.join(".") : "value"
        } before intialization.`
      );
    return this.#rawValue;
  }

  /** Method to get raw value. deprecated. */
  get rawValue(): unknown {
    return this.#rawValue;
  }

  /** Method to get resolved boolean. depracated. */
  get resolved(): boolean {
    return this.#resolved;
  }
}
