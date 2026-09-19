import { describe, expect, it } from "vitest";
import { withoutCommentedLines } from "./withoutCommentedLines";

describe("withoutCommentedLines", () => {
	it("drops a line comment", () => {
		expect(withoutCommentedLines(`// gone\nkept`)).toBe(`kept`);
	});

	it("drops a doc comment, opener and continuation alike", () => {
		expect(withoutCommentedLines(`/**\n * gone\n */\nkept`).trim()).toBe("kept");
	});

	it("drops a comment the formatter indented", () => {
		expect(withoutCommentedLines(`\t\t// gone\nkept`)).toBe(`kept`);
	});

	// The reason this is line-oriented rather than a block-comment regex. A
	// recursive include pattern contains a slash-star and a star-slash, so a block
	// regex eats the middle of every glob in a tsconfig and reports the include
	// as missing.
	it("leaves a glob alone, although it contains both comment markers", () => {
		const include = `"include": ["src/**/*", ".lanka/**/*"]`;

		expect(withoutCommentedLines(include)).toBe(include);
	});

	it("keeps a trailing comment on a live line, because the line is live", () => {
		expect(withoutCommentedLines(`kept // note`)).toBe(`kept // note`);
	});
});
