/**
 * The slice of an `ImportDeclaration` the rules read.
 *
 * `importKind` — on the declaration and on each specifier — exists only under a
 * TypeScript parser; espree leaves it undefined, which every reader must treat
 * as "a value import". The specifiers are typed as bare objects because ESTree's
 * own specifier types do not declare `importKind`; `isTypeOnlyImport` reads it
 * off each one.
 */
export interface IImportNode {
	source: { value?: unknown };
	importKind?: string;
	specifiers?: readonly object[];
}
