import { loadAsync } from "../index";

const load = await loadAsync("./3.yaml", { basePath: "./test" });
console.log("load: ", load);
