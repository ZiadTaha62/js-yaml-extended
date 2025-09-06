import { loadAsync, Schema, Type } from "../index";

const swithType = new Type("switch", {
  kind: "mapping",
  resolve(data) {
    return data && typeof data === "object" && !Array.isArray(data);
  },
  construct(data, type, params) {
    console.debug("params: ", params);
    return (data as Record<string, string>)[params ?? ""] ?? null;
  },
});

const schema = new Schema(swithType, "DEFAULT");

const load = await loadAsync("./3.yaml", { basePath: "./test", schema });
console.log("load: ", load);
