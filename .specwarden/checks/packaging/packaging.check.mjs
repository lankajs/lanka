/**
 * What reaches npm. Two checks, because they read two different things: the
 * manifests as written, and the tarballs as installed. The window to unpublish
 * is 72 hours and there is no second one.
 */
import { commandCheck } from "specwarden";

export const checks = [
	commandCheck({
		id: "publishable",
		title: "every package is fit to publish: name, version, licence, repository, private cleared",
		tier: "fast",
		cmd: "node scripts/check-publishable.mjs",
		paths: ["scripts/check-publishable.mjs"],
		expect: /fit to publish: [1-9]\d*/,
		timeoutSec: 120,
		rule: {
			id: "every-package-is-publishable",
			statement:
				"every package's manifest is one npm accepts and a consumer can trace back here",
			owner: "CONTRIBUTING.md",
		},
	}),

	/**
	 * The only check that reads `dist`. `dist/index.js exists` proves a file
	 * exists; this installs the tarballs into a temporary consumer and imports
	 * from them. It builds, so it runs alone.
	 */
	commandCheck({
		id: "build",
		title: "every built tarball installs, resolves and reaches the consumer's barrels",
		tier: "heavy",
		cmd: "pnpm run verify:build",
		paths: ["scripts/verify-build.mjs"],
		expect: /imports verified: [1-9]\d*.*packages: [1-9]\d*/,
		exclusive: true,
		timeoutSec: 1800,
		rule: {
			id: "an-installed-tarball-works",
			statement:
				"an installed tarball resolves, executes and reaches the consumer's barrels, and the set built is the set packed",
			owner: "skills/gates/SKILL.md",
		},
	}),
];
