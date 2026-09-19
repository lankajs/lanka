/**
 * Drops commented-out lines so a disabled line does not read as a live one.
 *
 * LINE-oriented, and that is the whole point. A block-comment regex is wrong
 * for what reads these files: the strings inspected include globs, and a
 * recursive include pattern contains a slash-star and a star-slash in the
 * middle. A block regex treats that as a comment, eats the middle of every
 * include pattern and reports the include as missing.
 *
 * A commented-out entry always occupies its own line in a formatted file, which
 * is the only case that has to be understood.
 *
 * The continuation form — a line whose first non-space character is `*` — is
 * what makes this readable over a BARREL and not just a `tsconfig`. Every stub
 * this package writes carries a doc comment, and the namespace stubs carry an
 * `@example export { UserGateway } from "../src/...";` inside it. Without this,
 * an untouched scaffolded barrel reads as one that already exports a gateway.
 */
export const withoutCommentedLines = (source: string): string =>
	source
		.split("\n")
		.filter((line) => {
			const trimmed = line.trim();
			return (
				!trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*")
			);
		})
		.join("\n");
