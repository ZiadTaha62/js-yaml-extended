# yaml-extend

**yaml-extend** — a wrapper around [`js-yaml`] that adds focused, deterministic templating features to YAML: imports, per-module params, locals, private fields, typed interpolations and small tag payloads — with caching and a file-watching `LiveLoader`.

> Package name: **`yaml-extend`**

---

## Table of contents

- [Why yaml-extend](#why-yaml-extend)
- [Install](#install)
- [Quickstart](#quickstart)
- [API reference](#api-reference)
- [Extended YAML features overview](#extended-yaml-features-overview)
- [Directives](#directives)
- [Expressions](#expressions)
- [Escaping](#escaping)
- [Tags with payloads](#tags-with-payloads)
- [Evaluation order & semantics](#evaluation-order--semantics)
- [Security & sandboxing](#security--sandboxing)
- [Architecture and Design](#architecture-and-design)
- [Live reloading (LiveLoader)](#live-reloading-liveloader)
- [Examples & repo layout](#examples--repo-layout)
- [Troubleshooting / common errors](#troubleshooting--common-errors)
- [Contributing](#contributing)
- [License](#license)

---

## Why yaml-extend

`yaml-extend` gives you the small, practical features that can greatly extend YAML language while keeping it's simplicity and favourable syntax. you can:

- Import other YAML files with module level parameter declirations.
- Declare intra-module locals.
- Mark evaluation-only nodes that are removed from output.
- Reference nodes directly without need to declare anchors and aliases, reference also allows defining locals value.
- Small tag payloads (single-scalar payloads for tags like `!switch(...)`)
- Built-in caching and a `LiveLoader` for watch+reload workflows

All of this with Deterministic left-to-right evaluation and immediate circular-import detection of course.

Design goal: keep YAML familiar and simple while enabling safe, deterministic configuration templating.

---

## Install

```bash
# npm
npm install yamlx

# yarn
yarn add yamlx
```

## Quickstart

Being a wrapper around js-yaml library the api is almost identical, all you need to use the wrapper is to change the imports from js-yaml to yaml-extend

```js
- import { load } from "js-yaml";
+ import { load } from "yaml-extend";

const str = "node: value";
const loaded = load(str);
```

Also wrapper accept url paths for yaml files directly in the place of YAML string, it only accept files that end with .yml or .yaml

```js
import { load } from "yaml-extend";

const loaded = load("./path/file.yaml");
```

Also make in mind that in order for some features like import to work you need to add some extra configirations. so don't forget to check API reference.

## API reference

These are all the imports from yaml-extend library

```js
import {
  load,
  loadAsync,
  resolve,
  resolveAsync,
  LiveLoader,
  dump,
  Type,
  Schema,
  DEFAULT_SCHEMA,
  CORE_SCHEMA,
  JSON_SCHEMA,
  FAILSAFE_SCHEMA,
  YAMLException,
  WrapperYAMLException,
} from "yaml-extend";
```

From the first look you can notice that they are the same imports of `js-yaml` but with some extra functions/classes which are `loadAsync`, `resolve`, `resolveAsync`, `LiveLoader` and `WrapperYAMLException`.  
Also we can notice the new async functions which are introduced to manage imports and YAML file reads without blocking the JS main thread.

### Functions

#### load(str: string, opts?: LoadOptions)

Function to load YAML string into js value. works sync so all file system reads are sync, also all tag's construct functions executions will be treated as sync functions and not awaited. If you are using imports or async tag construct functions use loadAsync instead.

- `str` — YAML string or filesystem path for the YAML file. The loader uses a regex to detect path-like strings; when a path is used it will be resolved using `opts.basePath` and it will overwite `opts.filepath` value.

- `opts` — see [LoadOptions](#loadoptions).

- `returns` — Js value of loaded YAML string.

#### loadAsync(str: string, opts?: LoadOptions)

Function to load YAML string into js value. works async so all file system reads are async, also all tag's construct functions executions are awaited.

- `str` — YAML string or filesystem path for the YAML file. The loader uses a regex to detect path-like strings; when a path is used it will be resolved using `opts.basePath` and it will overwite `opts.filepath` value.

- `opts` — see [LoadOptions](#loadoptions).

- `returns` — Js value of loaded YAML string.

#### dump(obj: any, opts?: DumpOptions)

Function to dump js value into YAML string.

- `obj` — Js object that will be converted to YAML string

- `DumpOptions` — see [DumpOptions](#dumpoptions)

- `returns` — YAML string of dumped js value.

#### resolve(str: string, opts?: ResolveOptions)

Function to resolve tags and wrapper expressions (imports, params, locals and privates) to generate one resolved YAML string. short hand for calling load() then dump(). useful to convert YAML modules into one YAML string that will be passed for configiration. works sync.

- `str` — YAML string or filesystem path for the YAML file. The loader uses a regex to detect path-like strings; when a path is used it will be resolved using `opts.basePath` and it will overwite `opts.filepath` value.

- `opts` — see [ResolveOptions](#resolveoptions).

- `returns` — Resolved YAML string.

#### resolveAsync

Function to resolve tags and wrapper expressions (imports, params, locals and privates) to generate one resolved YAML string. short hand for calling load() then dump(). useful to convert YAML modules into one YAML string that will be passed for configiration. works async.

- `str` — YAML string or filesystem path for the YAML file. The loader uses a regex to detect path-like strings; when a path is used it will be resolved using `opts.basePath` and it will overwite `opts.filepath` value.

- `opts` — see [ResolveOptions](#resolveoptions).

- `returns` — Resolved YAML string.

### Classes

#### Type

Type to handle tags and custom data types in YAML. The only difference between js-yaml and yaml-extend inside Type class is construct function. as due to lazy evaluation of tags value in the wrapper async functions are allowed and awaited. also new params flag is present

- `constructor:(tag: string, opts?: TypeConstructorOptions)` — See [`TypeConstructorOptions`](#typeconstructoroptions)
  Type class constructor.
  `Tag`: Tag that will be used in YAML text.
  `TypeConstructorOptions`: Configirations and options that defines how tag handle data.

- `kind: Kind | null` — See [`Kind`](#kind)
  YAML data type that will be handled by this Tag/Type.

- `resolve: (data: any) => boolean`
  Runtime type guard used when parsing YAML to decide whether a raw node (scalar, mapping or sequence) should be treated as this custom type. Return true when the incoming data matches this type.
  `data`: Raw node's value.
  `returns`: Boolean to indicate if raw value should be handled using this type.

- `construct: (data: any, type?: string, param?: string) => any | Promise<any>`
  Function that will be executed on raw node to return custom data type in the load.
  `data`: Raw node's value.
  `type`: Type of the tag.
  `param`: Param passed along with the tag which is single scalar value.
  `returns`: Value that will replace node's raw value in the load.

- `instanceOf: object | null`
  Used when dumping (serializing) JS objects to YAML. If a value is an instance of the provided constructor (or matches the object prototype), the dumper can choose this type to represent it.

- `predicate: ((data: object) => boolean) | null`
  Alternative to instanceOf for dump-time detection. If predicate returns true for a JS value, the dumper can select this type to represent that object. Useful when instanceof is not possible (plain objects, duck-typing).

- `represent: ((data: object) => any) | { [x: string]: (data: object) => any } | null`
  Controls how a JS value is converted into a YAML node when serializing (dumping). Return either a primitive, array or mapping representation suitable for YAML. When provided as an object, each property maps a style name to a function that produces the representation for that style.

- `representName: ((data: object) => any) | null`
  When represent is given as a map of styles, representName chooses which style to use for a particular value at dump time. It should return the style key (e.g., "canonical" or "short").

- `defaultStyle: string | null`
  The fallback style name to use when represent provides multiple styles and representName is not present (or does not return a valid style).

- `multi: boolean`
  Indicates whether this tag/type can be used for multiple YAML tags (i.e., it is not strictly tied to a single tag). This affects how the parser/dumper treats tag resolution and may allow more flexible matching.

- `styleAliases: { [x: string]: any }`
  Map alias style names to canonical style identifiers. This lets users refer to styles by alternate names; the dumper normalizes them to the canonical style before selecting a represent function.

#### Schema

Schema that holds Types used for loading and dumping YAML string. The only difference between js-yaml and yaml-extend inside Schema class is additional optional group param in Schema construct, group params defines which built-in schema is used.

- `constructor(definition: SchemaDefinition | Type[] | Type, group?: Group)` — See [`SchemaDefinition`](#schemadefinition) / [`Type`](#type) / [`Group`](#group)
  Schema class constructor.
  `definition`: Either schema definition or types that will control how parser handle tags in YAML.
  `group`: Optional built-in schema to use.

- `extend(types: SchemaDefinition | Type[] | Type) => Schema` — See [`SchemaDefinition`](#schemadefinition) / [`Type`](#type)
  Method to extend schema by adding more types.
  `types`: Either schema definition or types that will control how parser handle tags in YAML.
  `returns`: Reference to the schema.

#### DEFAULT_SCHEMA

Default built-in schema. for more details check js-yaml docs.

#### CORE_SCHEMA

Core built-in shcema. for more details check js-yaml docs.

#### JSON_SCHEMA

Json built-in shcema. for more details check js-yaml docs.

#### FAILSAFE_SCHEMA

Failsafe built-in shcema. for more details check js-yaml docs.

#### LiveLoader

Class that handles loading multiple YAML files at the same time while watching loaded files and update there loads as files change.

- `constructor(opts: LiveLoaderOptions)` — See [`LiveLoaderOptions`](#liveloaderoptions)
  LiveLoader class constructor.
  `opts`: Options object passed to control live loader behavior.

- `setOptions(opts: LiveLoaderOptions) => void` — See [`LiveLoaderOptions`](#liveloaderoptions)
  Method to set options of the class.
  `opts`: Options object passed to control live loader behavior.

- `addModule(path: string, paramsVal?: Record<string, string>) => unknown`
  Method to add new module to the live loader. added modules will be watched using fs.watch() and updated as the watched file changes. note that imported YAML files in the read YAML string are watched as well. works sync so all file watch, reads are sync and tags executions are handled as sync functions and will not be awaited.
  `path`: Filesystem path of YAML file. it will be resolved using `LiveLoaderOptions.basePath`.
  `paramsVal`: Object of module params aliases and there values to be used in this load. so it's almost always better to use addModuleAsync instead.
  `returns`: Value of loaded YAML file.

- `addModuleAsync(path: string, paramsVal?: Record<string, string>) => unknown`
  Method to add new module to the live loader. added modules will be watched using fs.watch() and updated as the watched file changes. note that imported YAML files in the read YAML string are watched as well. works async so all file watch, reads are async and tags executions will be awaited.
  `path`: Filesystem path of YAML file. it will be resolved using `LiveLoaderOptions.basePath`.
  `paramsVal`: Object of module params aliases and there values to be used in this load.
  `returns`: Value of loaded YAML file.

- `getModule(path: string) => unknown`
  Method to get cached value of loaded module or file. note that value retuned is module's resolve when paramsVal is undefined (default params value are used).
  `path`: Filesystem path of YAML file. it will be resolved using `LiveLoaderOptions.basePath`.
  `returns`: Cached value of YAML file with default modules params or undefined if file is not loaded.

- `getAllModules() => Record<string, unknown>`
  Method to get cached value of all loaded modules or files. note that values retuned are module's resolve when paramsVal is undefined (default params value are used).
  `returns`: Object with keys resolved paths of loaded YAML files and values cached values of YAML files with default modules params.

- `deleteModule(path: string) => void`
  Method to delete module or file from live loader.
  `path`: Filesystem path of YAML file. it will be resolved using `LiveLoaderOptions.basePath`.

- `deleteAllModules() => void`
  Method to clear cache of live loader by deleting all modules or files from live loader.

- `destroy() => void`
  Method to clear live loader along with all of its watchers and cache from memory.

#### YAMLException

Error object when js-yaml parse error it thrown.

- `constructor(reason?: string, mark?: Mark)` — See [`Mark`](#mark)
  YAMLException class constructor
  `reason`: Reason of the error.
  `mark`: Mark object that defines error's details.

- `toString(compact?: boolean) => string`
  Method to convert Error object into string.
  `compact`: Boolean to indicated if output error string should be compacted.
  `returns`: Stringified error.

- `name: string`
  Logical name of the YAML string where error is thrown.

- `reason: string`
  Reason of the error.

- `message: string`
  Message of the error.

- `mark: Mark`
  Object that defines error's details.

#### WrapperYAMLException

Error object when yaml-extend resolve error is thrown. One of the down sides of being a wrapper is inability to gether error details (exact line, positions... of the error), so mark is replaced by filepath.

- `constructor(reason?: string, filepath?: string, name?: string)`
  WrapperYAMLException class constructor
  `reason`: Reason of the error.

- `toString(compact?: boolean) => string`
  Method to convert Error object into string.
  `compact`: Boolean to indicated if output error string should be compacted.
  `returns`: Stringified error.

- `name: string`
  Logical name of the YAML string where error is thrown.

- `reason: string`
  Reason of the error.

- `message: string`
  Message of the error.

- `filepath: string`
  Filesystem path of the YAML file where error is thrown.

### Interfaces

#### LoadOptions

Options object passed to control load behavior. basePath, filpath and paramsVal are added.

- `basePath?: string | undefined` — Default: `process.cwd()`
  Filesystem path used as the sandbox root for imports. Prevents access to files outside this directory and is used as the base when resolving relative imports or special `@base/...` import syntax. Example: if basePath is `/proj` and an import says `./configs/a.yaml`, the loader resolves against `/proj`.

- `filepath?: string | undefined` — Default: `undefined`
  The resolved path of the YAML source. Useful for error messages, caching, and resolving relative imports. If you call `load("./file.yaml")` the loader should set this to the resolved absolute path automatically. `Note that imports and caching will not work if filepath is not supplied here or in function's str field`.

- `filename?: string | undefined` — Default: `undefined`
  String to be used as a file path in error/warning messages. It will be overwritten by YAML text `FILENAME` directive if used.

- `onWarning?: ((this: null, err: YAMLException | WrapperYAMLException) => void) | undefined` — Default: `undefined` — see [`YAMLException`](#yamlexception) / [`WrapperYAMLException`](#wrapperyamlexception)
  Function to call on warning messages.
  `err`: Error thrown either YAMLException or WrapperYAMLException.

- `schema?: Schema | undefined` — Default: `undefined` — See [`Schema`](#schema)
  Specific schema to use.

- `json?: boolean | undefined` — Default: `undefined`
  Compatibility with JSON.parse behaviour.

- `listener?: ((this: State, eventType: ParseEventType, state: State) => void) | undefined` — Default: `undefined` — see [`ParseEventType`](#parseeventtype) / [`State`](#state)
  Listener for parse events.
  `eventType`: Type of the parse event. either close or open.
  `state`: State of the current parse.

- `paramsVal?: Record<string, string> | undefined` — Default: `undefined`
  Mapping of module param aliases to string values that will be used to resolve %PARAM declarations in the module. Loader-supplied paramsVal should override any defaults declared with %PARAM.

#### DumpOptions

Options object passed to control dump behavior. Identical to js-yaml.

- `indent?: number | undefined` — Default: `undefined`
  Indentation width to use (in spaces).

- `noArrayIndent?: boolean | undefined` — Default: `undefined`
  When true, will not add an indentation level to array elements.

- `skipInvalid?: boolean | undefined` — Default: `undefined`
  Do not throw on invalid types (like function in the safe schema) and skip pairs and single values with such types.

- `flowLevel?: number | undefined` — Default: `undefined`
  Specifies level of nesting, when to switch from block to flow style for collections. -1 means block style everwhere.

- `styles?: { [x: string]: any } | undefined` — Default: `undefined`
  Each tag may have own set of styles. - "tag" => "style" map.

- `schema?: Schema | undefined` — Default: `undefined` — See [`Schema`](#schema)
  Specific schema to use.

- `sortKeys?: boolean | ((a: any, b: any) => number) | undefined` — Default: `false`
  If true, sort keys when dumping YAML. If a function, use the function to sort the keys.

- `lineWidth?: number | undefined` — Default: `80`
  Set max line width.

- `noRefs?: boolean | undefined` — Default: `false`
  If true, don't convert duplicate objects into references.

- `noCompatMode?: boolean | undefined` — Default: `false`
  If true don't try to be compatible with older yaml versions. Currently: don't quote "yes", "no" and so on, as required for YAML 1.1 .

- `condenseFlow?: boolean | undefined` — Default: `false`
  If true flow sequences will be condensed, omitting the space between `key: value` or `a, b`. Eg. `'[a,b]'` or `{a:{b:c}}`. Can be useful when using yaml for pretty URL query params as spaces are %-encoded.

- `quotingType?: "'" | '"' | undefined` — Default: `'`
  Strings will be quoted using this quoting style. If you specify single quotes, double quotes will still be used for non-printable characters.

- `forceQuotes?: boolean | undefined` — Default: `false`
  If true, all non-key strings will be quoted even if they normally don't need to.

- `replacer?: ((key: string, value: any) => any) | undefined` — Default: `undefined`
  Callback `function (key, value)` called recursively on each key/value in source object (see `replacer` docs for `JSON.stringify`).

#### ResolveOptions

Options object passed to control resolve behavior. Extends `LoadOptions` and `DumpOptions` with additional configirations defined below.

- `outputPath?: string` — Default: `undefined`
  Filesystem path to write generated resolved YAML text into.

#### LiveLoaderOptions

Options object passed to control liveLoader behavior.

- `onUpdate?: (eventType: FileEventType, path: string, load: unknown)` — Default: `undefined` — See [`FileEventType`](#fileeventtype)
  Function to call when a watcher detect file change.
  `eventType`: Type of the file change event. either "change" or "rename".
  `path`: Path of updated YAML file.
  `load`: New load value of the YAML file or last cached load value if error is thrown.

- `warnOnError?: boolean` — Default: `false`
  How live loader will react when load error is thrown. You should note that error throwing will be very likely to occur when you update files. if setted to true errors will be passed to onWarning function otherwise errors will be ommited.

- `resetOnError?: boolean` — Default: `false`
  How live loader will react when load error is thrown. You should note that error throwing will be very likely to occur when you update files. if setted to true cache of this module will be reseted to null otherwise nothing will happen to old cache when error is thrown.

- `basePath?: string` — Default: `process.cwd()`
  Filesystem path used as the sandbox root for imports. Prevents access to files outside this directory and is used as the base when resolving relative imports or special `@base/...` import syntax. Example: if basePath is `/proj` and an import says `./configs/a.yaml`, the loader resolves against `/proj`.

- `onWarning?: (this: null, err: YAMLException | WrapperYAMLException) => void` — Default: `undefined` — see [`YAMLException`](#yamlexception) / [`WrapperYAMLException`](#wrapperyamlexception)
  Function to call on warning messages.
  `err`: Error thrown either YAMLException or WrapperYAMLException.

- `schema?: Schema` — Default: `undefined` — See [`Schema`](#schema)
  Specific schema to use.

- `json?: boolean` — Default: `undefined`
  Compatibility with JSON.parse behaviour.

- `listener?: (this: State, eventType: ParseEventType, state: State) => void` — Default: `undefined` — see [`ParseEventType`](#parseeventtype) / [`State`](#state)
  Listener for parse events.
  `eventType`: Type of the parse event. either "close" or "open".
  `state`: State of the current parse.

#### TypeConstructorOptions

Configirations and options that defines how tag handle data.

- `kind?: Kind | undefined` — Default: `undefined` — See [`Kind`](#kind)
  YAML data type that will be handled by this Tag/Type.

- `resolve?: ((data: any) => boolean) | undefined` — Default: `undefined`
  Runtime type guard used when parsing YAML to decide whether a raw node (scalar, mapping or sequence) should be treated as this custom type. Return true when the incoming data matches this type.
  `data`: Raw node's value.
  `returns`: Boolean to indicate if raw value should be handled using this type.

- `construct?: ((data: any, type?: string, param?: string) => any | Promise<any>) | undefined` — Default: `undefined`
  Function that will be executed on raw node to return custom data type in the load.
  `data`: Raw node's value.
  `type`: Type of the tag.
  `param`: Param passed along with the tag which is single scalar value.
  `returns`: Value that will replace node's raw value in the load.

- `instanceOf?: object | undefined` — Default: `undefined`
  Used when dumping (serializing) JS objects to YAML. If a value is an instance of the provided constructor (or matches the object prototype), the dumper can choose this type to represent it.

- `predicate?: ((data: object) => boolean) | undefined` — Default: `undefined`
  Alternative to instanceOf for dump-time detection. If predicate returns true for a JS value, the dumper can select this type to represent that object. Useful when instanceof is not possible (plain objects, duck-typing).
  `data`: Raw node's value.
  `returns`: Boolean to indicate if type will represent object or not while dumping.

- `represent?: ((data: object) => any) | { [x: string]: (data: object) => any } | undefined` — Default: `undefined`
  Controls how a JS value is converted into a YAML node when serializing (dumping). Return either a primitive, array or mapping representation suitable for YAML. When provided as an object, each property maps a style name to a function that produces the representation for that style.

- `representName?: ((data: object) => any) | undefined` — Default: `undefined`
  When represent is given as a map of styles, representName chooses which style to use for a particular value at dump time. It should return the style key (e.g., "canonical" or "short").
  `data`: Raw node's value.
  `returns`: Style key of represent.

- `defaultStyle?: string | undefined` — Default: `undefined`
  The fallback style name to use when represent provides multiple styles and representName is not present (or does not return a valid style).

- `multi?: boolean | undefined` — Default: `undefined`
  Indicates whether this tag/type can be used for multiple YAML tags (i.e., it is not strictly tied to a single tag). This affects how the parser/dumper treats tag resolution and may allow more flexible matching.

- `styleAliases?: ({ [x: string]: any }) | undefined` — Default: `undefined`
  Map alias style names to canonical style identifiers. This lets users refer to styles by alternate names; the dumper normalizes them to the canonical style before selecting a represent function.

#### SchemaDefinition

Definition of schema by supplying both implicit and explicit types.

- `implicit?: Type[] | undefined` — Default: `undefined` — See [`Type`](#type)
  Internal YAML tags or types.

- `explicit?: Type[] | undefined` — Default: `undefined` — See [`Type`](#type)
  Extenral YAML tags or types.

#### State

State of the YAML file parse.

- `input: string`
  The raw YAML text being parsed.

- `filename: string | null`
  Logical name for YAML string.

- `schema: Schema`
  The `Schema` instance currently in use.

- `onWarning: (this: null, e: YAMLException) => void`
  Optional callback invoked for non-fatal parse warnings.

- `json: boolean`
  If true, parser attempts to behave like `JSON.parse` where applicable (restricts some YAML behaviors for JSON compatibility).

- `length: number`
  The total length (number of characters) of `input`.

- `position: number`
  Current zero-based index within `input` where the parser is reading.

- `line: number`
  Current line number (zero-based).

- `lineStart: number`
  The index in `input` where the current line begins. Combined with `position` to compute the `column`.

- `lineIndent: number`
  Number of spaces (indent) at the current line.

- `version: null | number`
  YAML version (e.g. 1.1, 1.2) if the document declares one; otherwise null.

- `checkLineBreaks: boolean`
  Whether to validate line-break characters strictly.

- `kind: string`
  Internal marker describing the current parsing context (for example document, mapping, sequence, etc.).

- `result: any`
  The partially- or fully-parsed JavaScript value produced so far for the current document. Updated as nodes are constructed.

- `implicitTypes: Type[]`
  Array of `Type` instances that the parser should consider implicitly when trying to recognize scalars/values.

#### Mark

Mark for YAMLException that defines error's details.

- `buffer: string`
  The original input text (or the relevant buffer slice) used to produce the error.

- `column: number`
  Zero-based column number (character offset from lineStart) where the error occurred.

- `line: number`
  Zero-based line number where the problem was detected.

- `name: string`
  The logical name for YAML string (filename).

- `position: number`
  Absolute character index in `buffer` for the error location.

- `snippet: string`
  short excerpt from the input surrounding the error.

### Enums

#### Kind

Kind or type of YAML data.
`Value`: "sequence" | "scalar" | "mapping"

#### Group

Built-in schemas by js-yaml.
`Value`: "DEFAULT" | "CORE" | "JSON" | "FAILSAFE";

#### ParseEventType

Types of parse event.
`Value`: "close" | "open"

#### FileEventType

Types of file system event.
`Value`: "change" | "rename"

## Extended YAML features overview

I like YAML: it's simple and very readable compared with other serialization formats. That’s why I used it to write the schema for a backend API I was building.

But as the schema grew, YAML’s simplicity revealed some limitations: `no native imports, no parameterization, and limited reuse without anchors/aliases`. People sometimes bend YAML tags to compensate, but tags are meant for type transformation; using them for imports introduces complexity and inconsistent behavior across tools.

When designing yaml-extend my primary goal was: `keep the document node tree clean and close to normal YAML`, while adding a small set of features that make large schemas maintainable and developer-friendly. To do that I introduced:

`Directives` — top-of-file declarations (separated from the node tree)

`Expressions` — compact inline references inside the node tree

### Key Ideas

`Directives` live at the top of the file. They declare imports, module parameters, or locals.

`Node tree (the document) stays clean`: you use short inline expressions to reference directive data.

`Expressions` are compact scalars like $import.alias.path.to.node that resolve to the value.

### Example: the problem (tag-based import)

To give you an example of usage let's imagine we have endpoints file where we defines all endpoints for our APIs.

**`endpoints.yaml`**

```yaml
user:
  singIn: "/api/user/singIn"
  singUp: "api/user/singUp"
```

Here’s a typical approach using a custom tag for a single import. This is verbose when you need many imports:

#### Tag approach

**`userApis.yaml`**

```yaml
singUp:
  endpoint: !import
    path: `./path/endpoints.yaml`
    node: user.signUp
  auth: "JWT"
  headers: headers
  body: body
```

To import a single value you must create a mapping with a tag — and if you import a lot, the file becomes noisy.

#### Yaml-extend approach — directives + expressions

Define all imports at the top, then reference them compactly in the node tree.

**`userApis.yaml`**

```yaml
%IMPORT endpoints ./path/endpoints.yaml
---
signUp:
  endpoint: $import.endpoints.user.signUp
  auth: "JWT"
  headers: headers
  body: body
```

- The %IMPORT directive declares: alias endpoints → ./path/endpoints.yaml. it can also declare module params but to keep things simple for now we just defined alias and path.
- --- separates directives from the document.
- Inside the document, $import.endpoints.user.signUp is a compact expression that resolves to the imported value /api/user/signUp.

This style keeps the YAML node tree minimal and easy to scan — you can see at a glance which values are imported (they start with $import) and where they came from (alias endpoints).

## Directives

`yaml-extend` currently supports the following directive declarations: `FILENAME`, `PARAM`, `LOCAL`, `IMPORT` and `PRIVATE`. These are defined at the top of the YAML file, before the `---` document separator (the same YAML directive block used for version and tag aliases). Directives can be extended in the future only if needed.

### Summary of directives

`FILENAME` — Define logical name for the file to be used in YAMLException and WrapperYAMLException.

`PARAM` — Define module-level parameters (scalars only) with defaults that can be overridden when importing or loading the module.

`LOCAL` — Define file-local variables (scalars only) used within the same YAML document; useful for inline templates.

`IMPORT` — Import another YAML file and provide default module parameters for that import.

`PRIVATE` — Marks a node in the current YAML as internal; it will be removed from the final output.

### FILENAME

#### Structure

Geneal structure is: `%FILENAME <filename>`

`filename` — Logical name for the file to be used in YAMLException and WrapperYAMLException. overwrites filename of options. wrap the filename inside [escape-character]

#### Example

**`api.yaml`**

```yaml
%FILENAME apis
```

### PARAM

#### Structure

Geneal structure is: `%PARAM <alias> <default-value>`

- `alias` — A unique name used to reference this parameter (e.g. endpoint). If an alias is reused, the last declaration wins.
- `default-value` — The default scalar value used when the parameter is not supplied by the importer. If omitted, the default is `null`.

`Note`: PARAM values are intentionally limited to scalars (strings, numbers, booleans, null). Mapping or sequence values are not allowed because they greatly increase complexity and defeat the core simplicity of YAML.

#### Purpose

`PARAM` lets you create reusable modules that accept simple scalar configuration values from outside the file. This reduces repetition for common structures.

#### Example: module template

See the below YAML example:

**`apis.yaml`**

```yaml
createUser:
  endpoint: "/api/users/create"
  method: POST
  auth: "JWT"
  headers:
    Content-Type: "application/json"
  rateLimit: 100

updateUser:
  endpoint: "/api/users/update"
  method: PUT
  auth: "JWT"
  headers:
    Content-Type: "application/json"
  rateLimit: 100

getUser:
  endpoint: "/api/users/get"
  method: GET
  auth: "JWT"
  headers:
    Content-Type: "application/json"
  rateLimit: 200
```

Notice how method, auth, headers, and much of the structure repeat. If you had dozens of endpoints you’d repeat this pattern a lot. One solution for this is putting the reusable structure in a separate module file and refer to params inside it.

**`api-template.yaml`**

```yaml
%PARAM endpoint ./def/endpoint
%PARAM method GET
%PARAM auth JWT
%PARAM rateLimit 100
---
module:
  endpoint: $param.endpoint
  method: $param.method
  auth: $param.auth
  headers:
    Content-Type: "application/json"
  rateLimit: $param.rateLimit
```

**`apis.yaml`**

```yaml
%IMPORT apiTemplate ./path/api-template.yaml
---
createUser:
  {
    $import.apiTemplate.module endpoint=/api/users/create method=POST auth=JWT rateLimit=100,
  }

updateUser:
  {
    $import.apiTemplate.module endpoint=/api/users/update method=PUT auth=JWT rateLimit=100,
  }

getUser:
  {
    $import.apiTemplate.module endpoint=/api/users/get method=GET auth=JWT rateLimit=200,
  }
```

`Note: `One of the downsides is that only scalar values are allowed. so if we added a mapping value in our Apis, for example bodySchema. the structure will look like this as we can't define it's value through module params:

**`apis.yaml`**

```yaml
%IMPORT apiTemplate ./path/api-template.yaml
---
createUser:
  <<:
    {
      $import.apiTemplate.module endpoint=/api/users/create method=POST auth=JWT rateLimit=100,
    }
  bodySchema: {} #mock for mapping

updateUser:
  <<:
    {
      $import.apiTemplate.module endpoint=/api/users/update method=PUT auth=JWT rateLimit=100,
    }
  bodySchema: {} #mock for mapping

getUser:
  <<:
    {
      $import.apiTemplate.module endpoint=/api/users/get method=GET auth=JWT rateLimit=200,
    }
  bodySchema: {} #mock for mapping
```

#### Tag example using PARAM

PARAM is great for environment switches, short configuration values, or tokens used by custom tags. In this example tag `!switch` with kind mapping. it checks value of param (Tag's payload) and return matching key of the mapping.

**`endpoints.yaml`**

```yaml
%PARAM env dev
---
endpoint: !switch($param.env)
  dev: ./path/dev
  prod: ./path/pro
```

And you can import it and choose which env to pass:

**`api.yaml`**

```yaml
%IMPORT endpoint ./path/endpoints.yaml
---
devApi:
  endpoint: $import.endpoint env=dev

prodApi:
  endpoint: $import.endpoint env=prod
```

### LOCAL

#### Structure

Geneal structure is: `%LOCAL <alias> <default-value>`

- `alias` — A unique name used to reference the local value within the same YAML document. If an alias is reused, the last declaration wins.
- `default-value` — Default scalar used when a $this reference does not override it. If omitted, the default is null.

`Note`: LOCAL values are intentionally limited to scalars (strings, numbers, booleans, null). Mapping or sequence values are not allowed because they greatly increase complexity and defeat the core simplicity of YAML.

#### Purpose

LOCAL lets you create reusable, file-scoped values and templates inside the same YAML file. Use it when you want everything in one file rather than splitting templates into separate modules.

#### Example: inline template with LOCAL

Same as earlier, but now all the data lives in the same YAML file.

**`apis.yaml`**

```yaml
%LOCAL endpoint ./def/endpoint
%LOCAL method GET
%LOCAL auth JWT
%LOCAL rateLimit 100
%PRIVATE template
---
template:
  endpoint: $local.endpoint
  method: $local.method
  auth: $local.auth
  headers:
    Content-Type: "application/json"
  rateLimit: $local.rateLimit

createUser:
  {
    $this.template.module endpoint=/api/users/create method=POST auth=JWT rateLimit=100,
  }

updateUser:
  {
    $this.template.module endpoint=/api/users/update method=PUT auth=JWT rateLimit=100,
  }

getUser:
  {
    $this.template.module endpoint=/api/users/get method=GET auth=JWT rateLimit=200,
  }
```

### When to prefer LOCAL vs PARAM

- Use `PARAM` when creating separate module files meant to be imported and reused across documents.
- Use `LOCAL` when the template or helper should remain inside the same YAML file.

### IMPORT

#### Structure

Geneal structure is: `%IMPORT <alias> <path> [<key>=<value> ...]`

- `alias` — A unique name used to reference the imported file (e.g. apiTemplate). If an alias is reused, the last declaration wins.
- `path` — Filesystem path (or module path) to the YAML file being imported.
- `key=value` — Optional default module parameter assignments used for this import. These can be overridden inline when referencing the imported module.

#### Purpose

`IMPORT` loads another YAML file into the current document under an alias. You can define default PARAMs for that import in the directive itself, and you can override or provide values when you reference nodes from the import.

#### Accessing imported data

- Use `$import.<alias>.[<node> ...]` to reference nodes inside the imported file.
- When the imported file defines PARAMs, you can supply param values inline while referencing, for example:

```yaml
node: $import.apiTemplate.module endpoint=/api/users/create method=POST
```

- Any defaults provided in the %IMPORT directive are used unless overridden inline.

#### Example

Same as earlier.

**`api-template.yaml`**

```yaml
%PARAM endpoint ./def/endpoint
%PARAM method GET
%PARAM auth JWT
%PARAM rateLimit 100
---
module:
  endpoint: $param.endpoint
  method: $param.method
  auth: $param.auth
  headers:
    Content-Type: "application/json"
  rateLimit: $param.rateLimit
```

Import with defaults:

**`apis.yaml`**

```yaml
%IMPORT apiTemplate ./path/api-template.yaml method=POST rateLimit=50
---
# uses the import defaults unless overridden inline
createUser: { $import.apiTemplate.module }
```

Inline override:

**`apis.yaml`**

```yaml
%IMPORT apiTemplate ./path/api-template.yaml method=POST rateLimit=50
---
# uses the import defaults unless overridden inline
createUser:
  {
    $import.apiTemplate.module endpoint=/api/users/get method=GET rateLimit=200,
  }
```

### PRIVATE

#### Structure

Geneal structure is: `%PRIVATE [[<node> ...] ...]`

- `node` — A node name in the current YAML document that should be treated as internal. node's path inside YAML text is separated by dots (`.`) .

#### Purpose

PRIVATE marks nodes (typically templates or helper objects) that are used during document processing but should be removed from the final output. This is useful for keeping templates, examples, or internal data inside your YAML code while preventing them from appearing in the exported/consumed YAML.

#### Rules & behavior

- The PRIVATE directive signals the processor to strip the named node from the final output after all references are resolved.

- PRIVATE nodes can reference and use $local and $param values.

- If you need multiple private nodes, you can either declare each with its own %PRIVATE directive or pass them all to one directive separated by spaces.

#### Example

**`example.yaml`**

```yaml
%PRIVATE auth.JWT # single node path
%PRIVATE auth.DeviceBinding api1 # multiple node paths (auth.deviceBinding and api1)
---
auth:
  - JWT
  - DeviceBinding
  - SessionToken

api1:
  auth: $this.auth.JWT

api2:
  auth: $this.auth.DeviceBinding

api3:
  auth: $this.auth.SessionToken
```

In this example we declared all auth options in our app in single auth sequence then refrenced them in our APIs (single source of truth). when YAML file is loaded the references are resolved but auth sequence (which is now not needed) is deleted from final output.

## Expressions

`yaml-extend` currently supports the following expression declarations: `this`, `param`, `local`, and `import`. These are defined at the top of the YAML file, before the `---` document separator (the same YAML directive block used for version and tag aliases). Directives can be extended in the future only if needed.

### this

### import

### param

### local

## Escaping

In directives and expressions, sometimes tokens `<filename>, <alias>, <default-value>, <key>, <value> and <node>` may contain delimiters as white speces, `=` in `<key>=<value>` or `.` in `[<node> ...]` . to escape these characters you need to wrap the token inside [escape characters](#escape-characters).

### Escape characters

- `Double quotes ("")` — Double quotes only, `Single quotes ('') are not supported`.

- `Square brackets ([])` — Java script like.

### Examples

-`<filename>`

```yaml
%FILENAME name with space # non escaped, only name will be used
%FILENAME "name with space" # escaped using Double quotes, "name with space" is used as filename
%FILENAME [name with space] # escaped using Square brackets, "name with space" is used as filename
```

- `<key>=<value>`

```yaml
%IMPORT alias path.yaml key with space=value wi=th space  # non escaped, this evalueates to -> key=undefined with=undefined space=value wi=th space=undefined
%IMPORT alias path.yaml "key with space"="value wi=th space" # escaped using Double quotes, key: "key with space" and value: "value wi=th space" is used.
%IMPORT alias path.yaml [key with space]=[value wi=th space] # escaped using Square brackets, key: "key with space" and value: "value wi=th space" is used.

### Note that this is not valid ###
%IMPORT alias path.yaml "key with space=value wi=th space" # You should wrap key and value separetly.
```

- `[<node> ...]`

```yaml
$this.node with space.subNode key=value # non escaped, the node path will evaluate to $this.node and key value pairs will evaluate to with=undefined space.subNode=undefined key=value
$this."node with space".subNode key=value # escaped using Double quotes, the node path will evaluate to $this.["node with space"].subNode and key value pairs will evaluate to key=value
$this."node with space".subNode key=value # escaped using Square brackets, the node path will evaluate to $this.["node with space"].subNode and key value pairs will evaluate to key=value
```

## Tags with payloads

## Evaluation order & semantics

## Security & sandboxing

## Architecture and Design

## Live reloading (LiveLoader)

## Examples & repo layout

## Troubleshooting / common errors

## Contributing

## License
