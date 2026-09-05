import type { IImportNode } from "../IImportNode";

/**
 * Whether an import brings in types only — `import type { X }`, or every
 * specifier marked `type`.
 *
 * A type-only import is erased before the code runs: it makes no call, holds no
 * state and shares no owner. The boundary rules that exist because of a CALL
 * (a gateway reached from a component, one gateway chaining another, two
 * ViewModels co-owning state) do not apply to it, and reporting it taught the
 * first consumer to read those rules as noise — 219 findings, not one of them a
 * request.
 *
 * Under espree neither field exists and the answer is `false`: the syntax is
 * TypeScript's, so a project without the TypeScript parser has no type imports.
 */
export const isTypeOnlyImport = (node: IImportNode): boolean => {
	if (node.importKind === "type") return true;
	const specifiers = node.specifiers ?? [];
	return (
		specifiers.length > 0 &&
		specifiers.every((s) => (s as { importKind?: string }).importKind === "type")
	);
};
