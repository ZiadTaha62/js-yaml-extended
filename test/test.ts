import { resolveAsync } from "../index";

resolveAsync("./resolved.yaml", "./3.yaml", {
  basePath: "./test",
});
