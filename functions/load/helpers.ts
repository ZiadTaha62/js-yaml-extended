import { readFileSync as readFileSyncFS, realpathSync } from "fs";
import { readFile as readFileAsyncFS } from "fs/promises";
import { resolve, relative, parse } from "path";
import { YAMLException } from "../../wrapperClasses/error.js";
import { fileNameRegex } from "./regex.js";
import { createHash, randomBytes } from "crypto";

export function resolvePath(path: string, basePath: string) {
  return resolve(basePath, path);
}
export function readFile(resPath: string, basePath: string) {
  const resBasePath = resolve(basePath);

  if (!isInsideSandBox(resPath, resBasePath))
    throw new YAMLException(
      `Path used: ${resPath} is out of scope of base path: ${resBasePath}`
    );

  if (!isYamlFile(resPath))
    throw new YAMLException(`You can only load YAML files the loader.`);

  return readFileSyncFS(resPath, { encoding: "utf8" });
}

export async function readFileAsync(path: string, basePath: string) {
  const resPath = resolve(basePath, path);
  const resBasePath = resolve(basePath);

  if (!isInsideSandBox(resPath, resBasePath))
    throw new YAMLException(
      `Path used: ${resPath} is out of scope of base path: ${resBasePath}`
    );

  if (!isYamlFile(resPath))
    throw new YAMLException(
      `You can only load YAML files the loader. loaded file: ${resPath}`
    );

  return await readFileAsyncFS(resPath, { encoding: "utf8" });
}

export function isInsideSandBox(resPath: string, resBasePath: string) {
  // Resolve symlinks to avoid escaping via symlink tricks
  const realBase = realpathSync(resBasePath);
  const realRes = realpathSync(resPath);

  // Windows: different root/drive => definitely outside
  if (parse(realBase).root !== parse(realRes).root) return false;

  const rel = relative(realRes, realBase);

  // same directory
  if (rel === "") return true;

  // if it starts with '..' it escapes the base
  return !rel.startsWith("..");
}

export function isYamlFile(path: string) {
  return fileNameRegex.test(path);
}

/** Method to generate random id. */
export function generateId() {
  return randomBytes(12).toString("hex");
}

/** Method to stringify objects uniformly. */
export function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
    .join(",")}}`;
}

/** Method to normalize then hash objects. */
export function hashObj(obj: Record<string, any>) {
  // stringify object
  const strObj = stableStringify(obj);
  // hash and return
  return createHash("sha256").update(strObj).digest().toString("hex");
}

/** Method to hash string. */
export function hashStr(str: string) {
  return createHash("sha256").update(str).digest().toString("hex");
}
