import type { IImportNode } from "./IImportNode";

/** The import specifier as a string, or `null` when it is not a string literal. */
export const importSourceOf = (node: IImportNode): string | null =>
	typeof node.source.value === "string" ? node.source.value : null;
