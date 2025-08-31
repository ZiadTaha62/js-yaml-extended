import { YAMLException } from "../../../wrapperClasses/error.js";
import { Schema } from "../../../wrapperClasses/schema.js";
import { Type } from "../../../wrapperClasses/type.js";
import { TagResolver } from "../tagResolver.js";

import {
  tagsStrucRegex,
  captureTagsRegex,
  invalidTagCharRegex,
  missingTagParQoutesRegex,
} from "../regex.js";

export class TagsHandler {
  /** Method to capture tags in YAML text. */
  captureTags(str: string): string[] | undefined {
    return str.match(captureTagsRegex)?.map((tag) => tag.trim());
  }

  /** Method to add read tags to the schema as types. */
  convertTagsToTypes(
    tags: string[] | undefined,
    schema: Schema | undefined
  ): Type[] | undefined {
    if (!tags || !schema) return; // if no tags of schema return directly

    let types: Type[] = [];
    let cache: string[] = [];
    for (const tag of tags) {
      // if already in the cache skip
      if (cache.includes(tag)) continue;
      cache.push(tag);

      // run structure regex on the tag, if no match pass it to syntax error handler
      const match = tag.match(tagsStrucRegex);
      if (!match) {
        types.push(...this.#handleSyntaxErrorTag(tag));
        continue;
      }

      // destructure match
      const [_, tagName, params] = match;

      // get type from schema, if not present pass it to missing type handler
      const tagTypes = Object.values(schema.types[tagName]);
      if (tagTypes.length === 0) {
        types.push(...this.#handleMissingType(tag, tagName));
        continue;
      }

      // generate types
      for (const type of tagTypes) {
        const newType = new Type(tag, {
          kind: type.kind,
          construct: (d, t?, p?) => {
            if (type.construct)
              return new TagResolver(type.construct, d, t, params);
            else return d;
          },
          resolve: type.resolve,
          instanceOf: type.instanceOf,
          predicate: type.predicate,
          represent: type.represent,
          representName: type.representName,
          defaultStyle: type.defaultStyle,
          multi: type.multi,
          styleAliases: type.styleAliases,
        });

        // add type to the schema
        types.push(newType);
      }
    }

    return types;
  }

  #handleMissingType(tag: string, tagName: string) {
    // get error object
    const error = new YAMLException(`Unkown tag: ${tagName}`);

    // generate types
    const scalarType = new Type(tag, {
      kind: "scalar",
      construct(data, type, params) {
        throw error;
      },
    });

    const mappingType = new Type(tag, {
      kind: "mapping",
      construct(data, type, params) {
        throw error;
      },
    });

    const sequenceType = new Type(tag, {
      kind: "sequence",
      construct(data, type, params) {
        throw error;
      },
    });

    // add types to the schema
    return [scalarType, mappingType, sequenceType];
  }

  #handleSyntaxErrorTag(tag: string) {
    // get error object
    const error = this.#getError(tag);

    // generate types
    const scalarType = new Type(tag, {
      kind: "scalar",
      construct(data, type, params) {
        throw error;
      },
    });

    const mappingType = new Type(tag, {
      kind: "mapping",
      construct(data, type, params) {
        throw error;
      },
    });

    const sequenceType = new Type(tag, {
      kind: "sequence",
      construct(data, type, params) {
        throw error;
      },
    });

    // add types to the schema
    return [scalarType, mappingType, sequenceType];
  }

  #getError(tag: string): YAMLException {
    // check if error due to invalid char
    const invCharMatch = tag.match(ERRORS_OBJ.invChar.reg);
    if (invCharMatch)
      return new YAMLException(ERRORS_OBJ.invChar.mes(invCharMatch));

    // check if error due to missing '' in the params
    const missQoutesMatch = tag.match(ERRORS_OBJ.missQoutes.reg);
    if (missQoutesMatch)
      return new YAMLException(ERRORS_OBJ.missQoutes.mes(missQoutesMatch));

    // check if error due to more that 2 "!" used
    const numExc = this.#numChar(tag, ["!"]);
    if (numExc > 2)
      return new YAMLException(
        `Only two '!' marks are allowed in the tag. tag defined: ${tag}`
      );

    // check if error due to ivalid patenthesis
    const numPar = this.#numChar(tag, ["(", ")"]);
    if (numPar > 2 || numPar === 1)
      return new YAMLException(
        `One pair of parenthesis are allowed only in the end of the tag name to define params. tag defined: ${tag}`
      );
    if (!tag.endsWith(")"))
      return new YAMLException(
        `Parenthesis should be at the end of the string. tag defined: ${tag}`
      );

    // return generic error message
    return new YAMLException(
      `Invalid tag: ${tag}. tag should start with '!' and contain only only A-Z a-z 0-9 "\\" "/" "(" ")" "'" "." "_" "-" "#" "$" and "@" characters. with optional parenthesis with single quotes to define params string inside.`
    );
  }

  #numChar(tag: string, searchChar: string[]) {
    let num = 0;
    for (let i = 0; i < tag.length; i++) {
      const ch = tag[i];
      for (const c of searchChar) if (ch === c) num++;
    }
    return num;
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Helper error map.
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/** Object that holds specific errors regex and messages. */
const ERRORS_OBJ = {
  invChar: {
    reg: invalidTagCharRegex,
    mes: (m: RegExpMatchArray) =>
      `Tag: ${m[0]} contains a blacklisted characher: ${m[1]}, allowed charachters are: A-Z a-z 0-9 "\\" "/" "(" ")" "'" "." "_" "-" "#" "$" and "@" only. `,
  },
  missQoutes: {
    reg: missingTagParQoutesRegex,
    mes: (m: RegExpMatchArray) =>
      `Missing signle Qoutes ('') in tag's payload: ${m[0]}`,
  },
};
