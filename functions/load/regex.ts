export const pathRegex =
  /^(?:[\/\\]|[A-Za-z]:[\/\\]|\.{1,2}[\/\\])?(?:[^\/\\\s]+[\/\\])*[^\/\\\s]+\.ya?ml$/;

export const dirEndRegex = /\n---\s*\n/;

export const captureTagsRegex = /(?:^|\s)(![^\s!\{\}\[\]]+)(?=\s|$)/;

export const tagsStrucRegex =
  /^!(?:[A-Za-z0-9\/\\_\-#*\.@$]*!)?([A-Za-z0-9\/\\_\-#*\.@$]+)(?:\(\'([A-Za-z0-9\/\\_\-#*\.@$]+)\'\))?$/;

export const invalidTagCharRegex =
  /^!(?=[\s\S]*([^A-Za-z0-9\/\\_\-#*\.@$!()']))[\s\S]+$/;

/** Regex that captures paranthesis without quotes or double qoutes. */
export const missingTagParQoutesRegex =
  /^[\s\S]*\((?:[^\'][\s\S]*|[\s\S]*[^\'])\)$/;

/** Regex to capture array merge operator. */
export const arrMergeRegex = /^<<<?- /;

export const fileNameRegex = /.ya?ml$/;
