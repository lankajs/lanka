/**
 * Pins `tarball-links.mjs`: which links in shipped markdown land, and which do
 * not — and `absoluteLinks`, the rewrite that makes the generated ones land.
 *
 * Driven against a temporary package, because what is decided is a fact about
 * a directory: what `files` names, and what is on disk under it. Run against
 * the real packages the spec could only prove today's state, the one in which
 * the gate passes.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deadTarballLinks, linkTargets, shippedMarkdown } from "./tarball-links.mjs";
import { absoluteLinks } from "./skills.mjs";
import { ORIGIN } from "./registry.mjs";

let root = null;

/** A package directory holding exactly these files. */
const packageWith = (files) => {
	root = mkdtempSync(join(tmpdir(), "lanka-tarball-links-"));
	for (const [path, contents] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), contents, "utf8");
	}
	return root;
};

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = null;
});

const FILES = ["dist", "LICENSE", "README.md", "skills"];

describe("deadTarballLinks", () => {
	it("refuses the links every README carried before issue #9", () => {
		const pkg = packageWith({
			"README.md":
				"[GUIDE.md](./GUIDE.md) · [SKILL.md](./SKILL.md) · [map](../../README.md)\n",
			"GUIDE.md": "# guide\n",
			"SKILL.md": "# skill\n",
		});

		// Both files exist beside the README — in the repository. Neither ships.
		expect(deadTarballLinks(pkg, FILES)).toEqual([
			"README.md: ./GUIDE.md",
			"README.md: ./SKILL.md",
			"README.md: ../../README.md",
		]);
	});

	it("accepts absolute links, page anchors and mail", () => {
		const pkg = packageWith({
			"README.md":
				"[guide](https://github.com/lankajs/lanka/blob/main/core/GUIDE.md) " +
				"[here](#usage) [mail](mailto:x@example.test)\n",
		});

		expect(deadTarballLinks(pkg, FILES)).toEqual([]);
	});

	it("accepts a link to a file the tarball carries, with or without `./`", () => {
		const pkg = packageWith({
			"README.md": "[skill](./skills/lanka-x/SKILL.md) [licence](LICENSE)\n",
			LICENSE: "MIT\n",
			"skills/lanka-x/SKILL.md": "[reference](reference.md) [top](#top)\n",
			"skills/lanka-x/reference.md": "# reference\n",
		});

		expect(deadTarballLinks(pkg, FILES)).toEqual([]);
	});

	it("reads markdown under `files`, resolving each link from its own file", () => {
		const pkg = packageWith({
			"README.md": "# x\n",
			"skills/lanka-x/reference.md": "[maintaining](../../SKILL.md)\n",
			"SKILL.md": "# maintaining\n",
		});

		expect(deadTarballLinks(pkg, FILES)).toEqual([
			"skills/lanka-x/reference.md: ../../SKILL.md",
		]);
	});

	it("refuses a link that lands on a directory, even one that ships", () => {
		// The case the README-only version missed: a guide's `../` copied two
		// levels down lands on the package's own `skills/` — present, and not
		// what the text names.
		const pkg = packageWith({
			"README.md": "# x\n",
			"skills/lanka-x/reference.md": "[`modules/validators/`](../)\n",
		});

		expect(deadTarballLinks(pkg, FILES)).toEqual(["skills/lanka-x/reference.md: ../"]);
	});

	it("refuses a link that climbs out of the package, whatever is above it", () => {
		const pkg = packageWith({
			"README.md": "[sibling](../other/README.md)\n",
		});

		expect(deadTarballLinks(pkg, FILES)).toEqual(["README.md: ../other/README.md"]);
	});

	it("refuses a link under `files` to a file that does not exist", () => {
		const pkg = packageWith({
			"README.md": "[gone](./skills/lanka-x/missing.md)\n",
		});

		expect(deadTarballLinks(pkg, FILES)).toEqual(["README.md: ./skills/lanka-x/missing.md"]);
	});

	it("is not fooled by a path that walks out of a shipped directory and back", () => {
		const pkg = packageWith({
			"README.md": "[guide](./skills/../GUIDE.md)\n",
			"GUIDE.md": "# guide\n",
		});

		expect(deadTarballLinks(pkg, FILES)).toEqual(["README.md: ./skills/../GUIDE.md"]);
	});
});

describe("shippedMarkdown", () => {
	it("is the README plus the markdown under `files`, never `dist`", () => {
		const pkg = packageWith({
			"README.md": "# x\n",
			"GUIDE.md": "# not shipped\n",
			"dist/notes.md": "# built\n",
			"skills/lanka-x/SKILL.md": "# skill\n",
		});

		expect(shippedMarkdown(pkg, FILES).sort()).toEqual([
			"README.md",
			"skills/lanka-x/SKILL.md",
		]);
	});
});

describe("linkTargets", () => {
	it("reads inline links, images and links with a title", () => {
		expect(linkTargets('[a](./a.md) ![b](./b.png) [c](./c.md "title")')).toEqual([
			"./a.md",
			"./b.png",
			"./c.md",
		]);
	});
});

describe("absoluteLinks", () => {
	it("rewrites `./` and `../` links against the package directory", () => {
		expect(absoluteLinks("[g](./GUIDE.md) [m](../../README.md#map)", "modules/storage")).toBe(
			`[g](${ORIGIN.repository}/blob/main/modules/storage/GUIDE.md) ` +
				`[m](${ORIGIN.repository}/blob/main/README.md#map)`,
		);
	});

	it("rewrites a bare `../` to the directory's tree view", () => {
		// Skipped outright before: the pattern wanted a character after the slash.
		expect(absoluteLinks("[`modules/validators/`](../)", "modules/validators/yup")).toBe(
			`[\`modules/validators/\`](${ORIGIN.repository}/tree/main/modules/validators/)`,
		);
	});

	it("leaves absolute links and page anchors alone", () => {
		const text = "[a](https://example.test/x.md) [b](#usage)";
		expect(absoluteLinks(text, "core")).toBe(text);
	});
});
