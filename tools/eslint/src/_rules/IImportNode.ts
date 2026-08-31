/**
 * An import node in the shape ESLint hands it over.
 *
 * Declared here rather than taken from `estree`: the type package would be a
 * consumer-visible dependency added for a single field.
 */
export interface IImportNode {
	source: { value?: unknown };
}
