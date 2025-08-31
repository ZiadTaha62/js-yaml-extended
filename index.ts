import { load, loadAsync } from "./functions/load/load.js";
import { YAMLException } from "./wrapperClasses/error.js";
import { Type } from "./wrapperClasses/type.js";
import { Schema } from "./wrapperClasses/schema.js";
import {
  DEFAULT_SCHEMA,
  CORE_SCHEMA,
  JSON_SCHEMA,
  FAILSAFE_SCHEMA,
} from "./wrapperClasses/schemaGroups.js";

export {
  load,
  loadAsync,
  Type,
  YAMLException,
  Schema,
  DEFAULT_SCHEMA,
  CORE_SCHEMA,
  JSON_SCHEMA,
  FAILSAFE_SCHEMA,
};

import { readFileSync } from "fs";

const str = readFileSync("./src/lib/test/3.yaml", "utf8");

const val = await loadAsync(str, {
  schema: new Schema([]),
  filename: "./src/lib/test/3.yaml",
  paramsVal: { user: "khalid", role: "sharmota" },
});
console.log(val, (val as any)?.jhon);
