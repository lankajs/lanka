import { toPosix } from "./toPosix";

/** Whether the file sits inside any of the named directories. */
export const isInsideAny = (filename: string, dirs: readonly string[]): boolean =>
	dirs.some((dir) => toPosix(filename).includes(`/${dir}/`));
