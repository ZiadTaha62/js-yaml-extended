import type { Type } from "./wrapperClasses/type.js";
import type { Schema } from "./wrapperClasses/schema.js";
import type { YAMLException } from "./wrapperClasses/error.js";

import type {
  Load,
  LoadAsync,
  InternalLoad,
  InternalLoadAsync,
} from "./functions/load/load.js";

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Classes types
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type { Type };
export type { Schema };
export type { YAMLException };
export interface TypeConstructorOptions {
  kind?: "sequence" | "scalar" | "mapping" | undefined;
  resolve?: ((data: any) => boolean) | undefined;
  construct?:
    | ((data: any, type?: string, params?: string) => unknown)
    | undefined;
  instanceOf?: object | undefined;
  predicate?: ((data: object) => boolean) | undefined;
  represent?:
    | ((data: object) => any)
    | { [x: string]: (data: object) => any }
    | undefined;
  representName?: ((data: object) => any) | undefined;
  defaultStyle?: string | undefined;
  multi?: boolean | undefined;
  styleAliases?: { [x: string]: any } | undefined;
}

export interface SchemaDefinition {
  implicit?: Type[] | undefined;
  explicit?: Type[] | undefined;
}
export type Group = "FAILSAFE" | "JSON" | "CORE" | "DEFAULT";
/** only strings, arrays and plain objects: http://www.yaml.org/spec/1.2/spec.html#id2802346 */
export let FAILSAFE_SCHEMA: Schema;
/** only strings, arrays and plain objects: http://www.yaml.org/spec/1.2/spec.html#id2802346 */
export let JSON_SCHEMA: Schema;
/** same as JSON_SCHEMA: http://www.yaml.org/spec/1.2/spec.html#id2804923 */
export let CORE_SCHEMA: Schema;
/** all supported YAML types */
export let DEFAULT_SCHEMA: Schema;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Load types
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export { Load, LoadAsync, InternalLoad, InternalLoadAsync };
export interface LoadOptions {
  /** Path of loaded string if raw YAML string is used in load function. used in error/warning messages and to resolve relative paths. if not passed place holder "<basePath>/<strHash>.yaml" is used instead. */
  filename?: string | undefined;
  /** function to call on warning messages. */
  onWarning?(this: null, e: YAMLException): void;
  /** specifies a schema to use. */
  schema?: Schema | undefined;
  /** compatibility with JSON.parse behaviour. */
  json?: boolean | undefined;
  /** listener for parse events */
  listener?(this: State, eventType: EventType, state: State): void;
  /** Path to be used as base in imports if "@base" is used, also it path of sandboxing preventin any file access outside it. if not passed cwd is used instead. */
  basePath?: string | undefined;
  /** Params value to be used in module (str). */
  paramsVal?: Record<string, string> | undefined;
}
export type LiveLoaderOptions = Omit<LoadOptions, "filename" | "paramsVal"> & {
  /** listener that will run with every update to files loaded in live loader. */
  onUpdate?: (path: string, eventType: "change" | "rename") => void;
};

export type EventType = "open" | "close";
export interface State {
  input: string;
  filename: string | null;
  schema: Schema;
  onWarning: (this: null, e: YAMLException) => void;
  json: boolean;
  length: number;
  position: number;
  line: number;
  lineStart: number;
  lineIndent: number;
  version: null | number;
  checkLineBreaks: boolean;
  kind: string;
  result: any;
  implicitTypes: Type[];
}

////////////////////////////////////////////// LOAD WRAPPER RELATED
export type ParamsCache = {
  /** Params used to load module. */
  paramsVal: Record<string, unknown> | undefined;
  /** Final load after parsing YAML text. */
  load: unknown;
};
/** Cache of single module (str) read by load(). map of params hash as keys. */
export type ModuleLoadCache = {
  /** Map of params hash as a key and load with params used as value. */
  loadCache: Map<string, ParamsCache>;
  /** Object that holds data of directives. */
  dirObj: DirectivesObj;
  /** Resolved path of the module. */
  resPath: string;
  /** String passed from load(). */
  str: string;
  /** Hash of the string passed to load(). */
  hashedStr: string;
  /** Load of the YAML file when no params value are passed. */
  bluePrint: unknown;
};
/** Cache of the modules loaded by load functions (load, loadAsync, createLoader...). each module loaded is keyed by hash of it's resolved path. */
export type LoadCache = Map<string, ModuleLoadCache>;

/** Map that links each loadId with modules read by this load. */
export type LoadIdsToModules = Map<string, Set<string>>;
/** Map that links module with loadIds that read this module. */
export type ModulesToLoadIds = Map<string, Set<string>>;

/** Map the holds directives data. */
export type DirectivesObj = {
  /** Array of node paths that are defined to be private in YAML directive. */
  privateArr: string[];
  /** Map of <alias> <defualt value> for the params that are defined to be private in YAML directive. */
  paramsMap: Map<string, string>;
  /** Map of <alias> <defualt value> for the locals that are defined to be private in YAML directive. */
  localsMap: Map<string, string>;
  /** Map of <alias> <path> <params value> for the module imports that are defined to be private in YAML directive. */
  importsMap: Map<string, { path: string; paramsVal: Record<string, string> }>;
};

export type ModuleResolveCache = DirectivesObj & {
  /** Options passed to load(). used in interpolations. */
  opts: LoadOptions;

  /** Resolved path of this module. */
  path: string | undefined;

  /** Blueprint of this module. */
  blueprint: unknown;

  /** Params value passed along with load(). along with paramsMap's defualt values they are used to resolve params defined in module. */
  paramsVal: Record<string, string>;

  /**
   * Locals value defined after $this interpolation. along with localsMap's defualt values they are used to resolve locals defined in module.
   * array as each $this read will add it's defined locals value and delete it after being handled
   */
  localsVal: Record<string, string>[];
};
export type ResolveCache = Map<string, ModuleResolveCache>;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Dump types
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DumpOptions {
  /** indentation width to use (in spaces). */
  indent?: number | undefined;
  /** when true, will not add an indentation level to array elements */
  noArrayIndent?: boolean | undefined;
  /** do not throw on invalid types (like function in the safe schema) and skip pairs and single values with such types. */
  skipInvalid?: boolean | undefined;
  /** specifies level of nesting, when to switch from block to flow style for collections. -1 means block style everwhere */
  flowLevel?: number | undefined;
  /** Each tag may have own set of styles.    - "tag" => "style" map. */
  styles?: { [x: string]: any } | undefined;
  /** specifies a schema to use. */
  schema?: Schema | undefined;
  /** if true, sort keys when dumping YAML. If a function, use the function to sort the keys. (default: false) */
  sortKeys?: boolean | ((a: any, b: any) => number) | undefined;
  /** set max line width. (default: 80) */
  lineWidth?: number | undefined;
  /** if true, don't convert duplicate objects into references (default: false) */
  noRefs?: boolean | undefined;
  /** if true don't try to be compatible with older yaml versions. Currently: don't quote "yes", "no" and so on, as required for YAML 1.1 (default: false) */
  noCompatMode?: boolean | undefined;
  /**
   * if true flow sequences will be condensed, omitting the space between `key: value` or `a, b`. Eg. `'[a,b]'` or `{a:{b:c}}`.
   * Can be useful when using yaml for pretty URL query params as spaces are %-encoded. (default: false).
   */
  condenseFlow?: boolean | undefined;
  /** strings will be quoted using this quoting style. If you specify single quotes, double quotes will still be used for non-printable characters. (default: `'`) */
  quotingType?: "'" | '"' | undefined;
  /** if true, all non-key strings will be quoted even if they normally don't need to. (default: false) */
  forceQuotes?: boolean | undefined;
  /** callback `function (key, value)` called recursively on each key/value in source object (see `replacer` docs for `JSON.stringify`). */
  replacer?: ((key: string, value: any) => any) | undefined;
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Others
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface Mark {
  buffer: string;
  column: number;
  line: number;
  name: string;
  position: number;
  snippet: string;
}
