/**
 * The two questions about documentation that `check-docs` does not ask: does a
 * path it names exist, and does a relative link land. An agent follows both as
 * instructions, and neither fails anywhere else — the reader just ends up
 * somewhere that is not there.
 *
 * Left out of both, and why each:
 * - a CHANGELOG is the changesets copied by `changeset version`: history,
 *   describing trees that no longer exist, by design;
 * - `.changeset/` describes what a CONSUMER will see, in a consumer's terms.
 */
import { docHygiene, docPaths } from "@specwarden/docs";

const EXCEPT = ["**/CHANGELOG.md", ".changeset"];

export const checks = [
	docPaths({
		except: EXCEPT,
		/**
		 * Each deliberately absent, so named here rather than left to fail:
		 */
		illustrative: [
			// CONTRIBUTING says to restore it from history when releases move back to CI.
			".github/workflows/release.yml",
			// The deprecation ledger arrives WITH the first deprecation, and not before.
			"api/deprecations.md",
			// The folder-naming table's worked examples, in skills/structure.
			"create-lanka-vm/createLankaVM.ts",
			"x/X.ts",
			"x/x/X.ts",
			// Files in a CONSUMER's repository — what `lanka init` writes, and where
			// the DI contract's barrels land.
			".lanka/Gateways.ts",
			"src/Core/Configs/appHost.ts",
			"src/Gateways/TodoGateway/TodoGateway.ts",
		],
		corpus: {
			atLeast: 300,
			why: "the repository has hundreds of markdown files — fewer read means the pathspec stopped matching.",
		},
		rule: {
			id: "a-documented-path-resolves",
			statement:
				"a path named in this repository's documentation exists — an agent follows it as an instruction",
			owner: "skills/documentation/SKILL.md",
		},
	}),

	docHygiene({
		except: EXCEPT,
		corpus: {
			atLeast: 300,
			why: "the repository has hundreds of markdown files — fewer read means the pathspec stopped matching.",
		},
		rule: {
			id: "a-documented-link-lands",
			statement:
				"a relative link in this repository's documentation lands, and a table row stays short enough to read",
			owner: "skills/documentation/SKILL.md",
		},
	}),
];
