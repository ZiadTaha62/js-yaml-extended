import {
  Schema as JSchema,
  Type as JType,
  DEFAULT_SCHEMA,
  CORE_SCHEMA,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
} from "js-yaml";
import type { Schema } from "../../../wrapperClasses/schema.js";
import type { Type } from "../../../wrapperClasses/type.js";

/** Class to handle conversion of wrapper compositeTypes into js-yaml types and wrapper schemas into js-yaml schemas. */
export class BridgeHandler {
  /** Convert types from wrapper types to js-yaml types. */
  typesBridge(types: Type[] | undefined): JType[] | undefined {
    if (!types) return; // if no types return

    /** Array to hold converted types */
    const convertedTypes: JType[] = [];

    // loop through all wrapper types and convert them one by one
    for (const t of types) {
      const convertedT = new JType(t.tag, {
        kind: t.kind,
        construct: t.construct,
        resolve: t.resolve,
        instanceOf: t.instanceOf,
        predicate: t.predicate,
        represent: t.represent,
        representName: t.representName,
        defaultStyle: t.defaultStyle,
        multi: t.multi,
        styleAliases: t.styleAliases,
      });
      convertedTypes.push(convertedT);
    }

    // return converted types
    return convertedTypes;
  }

  /** Convert schema from wrapper schema to js-yaml schema. */
  schemaBridge(
    schema: Schema | undefined,
    types: JType[] | undefined
  ): JSchema | undefined {
    if (!schema) return; // if no schema return

    // create schema of the types and return it
    switch (schema.group) {
      case "CORE":
        if (types) return CORE_SCHEMA.extend(types);
        else return CORE_SCHEMA;
      case "DEFAULT":
        if (types) return DEFAULT_SCHEMA.extend(types);
        else return DEFAULT_SCHEMA;
      case "FAILSAFE":
        if (types) return FAILSAFE_SCHEMA.extend(types);
        else return FAILSAFE_SCHEMA;
      case "JSON":
        if (types) return JSON_SCHEMA.extend(types);
        else return JSON_SCHEMA;
      default:
        if (types) return new JSchema(types);
        else return new JSchema([]);
    }
  }

  /** For now empty. if in future needed to add any internal store clear it from memory here. */
  destroy() {}
}
