import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, siguiente) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    try {
      return await siguiente(specifier, context);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND" || !context.parentURL) throw error;
      const conJs = new URL(`${specifier}.js`, context.parentURL);
      if (existsSync(fileURLToPath(conJs))) return siguiente(conJs.href, context);
      throw error;
    }
  }
  return siguiente(specifier, context);
}
