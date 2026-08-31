/**
 * Folds several extractors into one: the first to find something wins.
 *
 * Order matters and is set by the application: it has one backend and knows its
 * shape. Trying "everything known" is the guessing this parsing moved here to
 * avoid.
 */
export const lankaFirstOf =
	(...extractors: readonly ((body: unknown) => string | undefined)[]) =>
	(body: unknown): string | undefined => {
		for (const extract of extractors) {
			const found = extract(body);
			if (found) return found;
		}
		return undefined;
	};
