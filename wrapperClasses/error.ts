import { YAMLException as jYAMLException } from "js-yaml";
import type { Mark } from "../types.js";

export class YAMLException extends jYAMLException {
  constructor(reason?: string, mark?: Mark) {
    super(reason, mark);
  }
}
