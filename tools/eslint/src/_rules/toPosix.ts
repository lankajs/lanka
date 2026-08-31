/** Paths are compared in one form; Windows backslashes would break matching. */
export const toPosix = (filename: string): string => filename.split("\\").join("/");
