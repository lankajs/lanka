/**
 * What an adapter says when it wrote barrels the consumer has to commit.
 *
 * One sentence, in one place: six adapters say it, and six copies would drift
 * into six slightly different instructions for the same situation.
 */
export const lankaDiScaffoldNotice = (created: readonly string[]): string =>
	`lanka scaffolded the consumer contract:\n  ${created.join("\n  ")}\n` +
	"Commit these — they are your application's wiring, not build output.";
