/**
 * Installs the built packages into a temporary project and imports from them.
 *
 * ## Why this instead of checking files
 *
 * "The build works" is unfalsifiable until someone installs the result. Checking
 * that `dist/index.js` exists proves a file exists and says nothing about what a
 * consumer will experience.
 *
 * What actually breaks fails here:
 *
 * - **a missing or wrong `.d.ts`** — the consumer gets an untyped package and
 *   learns about it from their `tsc`, not ours;
 * - **an unresolvable subpath** — `exports` promises `lanka/gateway` and nothing
 *   is there: node answers `ERR_PACKAGE_PATH_NOT_EXPORTED`, and this is the only
 *   place we can hear it first;
 * - **an entry node cannot read** — `@lankajs/tool-di` most of all: node loads it
 *   while reading `vite.config.ts`, not the bundler, and no vitest run checks it.
 *
 * ## Tarballs, not folder links
 *
 * `npm install ../packages/core` symlinks the folder and picks up files a
 * published package will not contain. A tarball is assembled from `files` — what
 * actually ships. A `dist` forgotten in `files` shows up no other way: locally
 * everything is in place.
 *
 * Run: node scripts/verify-build.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { PACKAGES as REGISTERED, pkgDir } from "./registry.mjs";
import { clientBoundary, entryFiles } from "./check-runtime.mjs";

const ROOT = process.cwd();

/**
 * What gets imported from the build and which symbol must arrive.
 *
 * A symbol rather than a bare import: a module that imported and exported
 * nothing is also a failure, just a quieter one.
 */
const CHECKS = [
	{ specifier: "lanka", symbol: "createLanka" },
	{ specifier: "lanka/gateway", symbol: "ALankaGateway" },
	{ specifier: "lanka/role", symbol: "defineLankaRole" },
	{ specifier: "lanka/scenario", symbol: "lankaEventBus" },
	{ specifier: "lanka/viewmodel", symbol: "createLankaVM" },
	{ specifier: "@lankajs/tool-di/vite", symbol: "lankaDiVite" },
	// The config-time adapters, which node reads while a framework's config file
	// is evaluated — `next.config.js`, `metro.config.js`. No vitest run loads
	// them the way node will.
	{ specifier: "@lankajs/tool-di/turbopack", symbol: "lankaDiTurbopack" },
	{ specifier: "@lankajs/tool-di/metro", symbol: "lankaDiMetro" },
	{ specifier: "@lankajs/host", symbol: "hydrateLankaVM" },
	{ specifier: "@lankajs/host/server", symbol: "runLankaRequest" },
	{ specifier: "@lankajs/storage", symbol: "LankaStorage" },
	{ specifier: "lanka/validation", symbol: "lankaStandardValidator" },
	{ specifier: "@lankajs/zod", symbol: "lankaZodValidator" },
	{ specifier: "@lankajs/valibot", symbol: "lankaValibotValidator" },
	{ specifier: "@lankajs/async", symbol: "createLankaBurstCoalescer" },
	{ specifier: "@lankajs/optimistic", symbol: "LankaOptimisticActions" },
	{ specifier: "@lankajs/blob-cache", symbol: "LankaBlobCachePolicy" },
	{ specifier: "@lankajs/collection", symbol: "createLankaCollectionView" },
	{ specifier: "@lankajs/browser", symbol: "createLankaReleaseGuard" },
	{ specifier: "@lankajs/plugin-prefetch/router", symbol: "lankaRouterChunkSource" },
	{ specifier: "@lankajs/plugin-http", symbol: "lankaHttp" },
	{ specifier: "@lankajs/plugin-sse", symbol: "lankaSse" },
	{ specifier: "@lankajs/plugin-prefetch", symbol: "lankaPrefetch" },
	{ specifier: "@lankajs/plugin-bootstrap-steps", symbol: "lankaBootstrapSteps" },
	{ specifier: "@lankajs/plugin-devtools", symbol: "lankaDevtools" },
	{ specifier: "@lankajs/tool-eslint", symbol: "lankaBoundaries" },
	// The one package a consumer runs BEFORE they have a project — `npx
	// @lankajs/tool-init` — so its tarball is the first thing anybody opens, and
	// it is also the only one that imports another package of this repository at
	// runtime. A tarball whose `@lankajs/tool-di` import does not resolve fails on
	// the first line of somebody's first five minutes.
	{ specifier: "@lankajs/tool-init", symbol: "runLankaInitCli" },
	// The shelf, one entry each. Five packages publishing ONE name is the thing a
	// consumer is promised, and a tarball where that name is missing from one of
	// them is the promise broken in the only place it matters.
	{ specifier: "@lankajs/react", symbol: "useLankaVM" },
	{ specifier: "@lankajs/vue", symbol: "useLankaVM" },
	{ specifier: "@lankajs/svelte", symbol: "useLankaVM" },
	{ specifier: "@lankajs/solid", symbol: "useLankaVM" },
	{ specifier: "@lankajs/angular", symbol: "useLankaVM" },
];

/**
 * Packages whose tarballs are installed into the temporary project.
 *
 * Derived from the registry rather than listed here. The list WAS written by
 * hand, and by the time anybody looked it was missing two packages — which is
 * the failure this file exists to prevent, happening to the file itself: a
 * package nobody installs is a package whose tarball is never opened.
 *
 * `CHECKS` stays static on purpose. It is the partner that keeps this honest:
 * deriving both would mean the check agrees with itself and proves nothing.
 */
const PACKAGES = REGISTERED.map(pkgDir);

/**
 * On Windows the `npm` executable is `npm.cmd`, which `execFileSync` cannot find
 * without `shell`: `spawnSync npm ENOENT` on a machine that has npm installed.
 */
const run = (cmd, args, cwd) =>
	execFileSync(cmd, args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		shell: process.platform === "win32",
	});

function fail(message) {
	console.error(`BUILD VERIFICATION FAILED\n\n${message}\n`);
	process.exit(1);
}

// ── 0. build what will be verified ───────────────────────────────────────────

/*
 * The build runs HERE rather than being assumed done.
 *
 * Reading whatever `dist` happens to hold reports success on a stale directory:
 * a package with a new export would ship without it while the probe verified the
 * previous build. A check that cannot fail reports success.
 */
console.log("building packages…");
run(
	"pnpm",
	[
		"-r",
		"--filter",
		"./core",
		"--filter",
		"./modules/*",
		"--filter",
		"./plugins/*",
		"--filter",
		"./tools/*",
		"build",
	],
	ROOT,
);

// ── 1. dist present for every package ────────────────────────────────────────

for (const dir of PACKAGES) {
	const manifest = JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8"));
	const published = manifest.publishConfig;
	if (!published?.exports) {
		fail(
			`${dir}/package.json declares no publishConfig.exports.\n` +
				`Without it npm receives a map pointing at sources, and the consumer has ` +
				`neither TypeScript nor a bundler willing to read them.`,
		);
	}
	for (const target of Object.values(published.exports)) {
		const file = typeof target === "string" ? target : target.default;
		if (!existsSync(join(ROOT, dir, file))) {
			fail(
				`${dir}: publishConfig.exports promises ${file}, which does not exist. Build the packages.`,
			);
		}
	}
}

// ── 1a. the client directive survives the build ──────────────────────────────

/**
 * Entries whose BUILT file must still start with the client directive.
 *
 * DERIVED from the sources, not listed. It named `core/dist/viewmodel/index.js`
 * until the hook left core, and then checked a file that no longer had — or
 * needed — the directive. A list that has to be remembered goes stale in exactly
 * the direction nobody notices: the entry most in need of the check is the one
 * somebody has just added.
 *
 * `check-runtime.mjs` proves the SOURCE says it; only this proves the bundler
 * kept it. esbuild preserves a leading directive today, and the day a tsup
 * upgrade stops doing so, every consumer's Next build breaks on an import that
 * looks innocent — the failure this check exists to catch first.
 */
const clientEntries = () =>
	REGISTERED.flatMap((pkg) =>
		entryFiles(pkgDir(pkg))
			.filter((entry) => clientBoundary(entry).declares)
			.map((entry) => entry.replace("/src/", "/dist/").replace(/\.tsx?$/, ".js")),
	);

const declaredClient = clientEntries();

// A check over a list that can be empty is a check that reports success. At
// least one entry here carries the directive — the React binding's barrel — and
// if that stops being true this says so rather than passing over nothing.
if (declaredClient.length === 0) {
	fail("no published entry carries the client directive, so the build check saw nothing.");
}

for (const file of declaredClient) {
	const built = join(ROOT, file);
	if (!existsSync(built))
		fail(`${file} is not built, so the client directive cannot be checked.`);
	if (!readFileSync(built, "utf8").trimStart().startsWith('"use client";')) {
		fail(
			`${file} lost its "use client" directive in the build.\n` +
				`The source barrel carries it; the bundler dropped it. A React Server ` +
				`Component importing this entry now fails in the consumer's build.`,
		);
	}
}

// ── 2. tarballs into a temporary project ─────────────────────────────────────

const temp = mkdtempSync(join(tmpdir(), "lanka-verify-"));
const tarballs = [];

try {
	for (const dir of PACKAGES) {
		// `pnpm pack`, not `npm pack`: only it expands `workspace:^` into a real
		// version and applies `publishConfig`. `npm pack` writes a literal
		// `workspace:^` into the tarball and installation fails with
		// EUNSUPPORTEDPROTOCOL — at the consumer's, not ours.
		const out = run("pnpm", ["pack", "--pack-destination", temp], join(ROOT, dir));
		const file = out.trim().split(/\r?\n/).pop();
		const manifest = JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8"));
		tarballs.push({ name: manifest.name, file: resolve(temp, file) });
	}

	writeFileSync(
		join(temp, "package.json"),
		JSON.stringify(
			{
				name: "lanka-build-probe",
				private: true,
				type: "module",
				// The name comes from the package manifest, not from the file name:
				// inferring it works until the first package whose name does not fit
				// the pattern, and then fails silently by installing the wrong one.
				//
				// Peer dependencies are installed explicitly: the probe project is a
				// CONSUMER, and a consumer must bring them. Without them the probe
				// fails with ERR_MODULE_NOT_FOUND, which is correct — it proves the
				// built code actually executes rather than merely resolving.
				dependencies: {
					...Object.fromEntries(
						tarballs.map(({ name, file }) => [
							name,
							`file:${file.split(sep).join("/")}`,
						]),
					),
					react: "^19.2.0",
					zod: "^4.3.6",
					valibot: "^1.1.0",
					zustand: "^5.0.10",
					// One per member of the bindings shelf. A binding's built entry
					// IMPORTS its framework — that is what makes it a binding — so a probe
					// without them proves the tarball resolves and nothing about whether
					// it runs. `/vue` failed exactly that way the day it landed.
					vue: "^3.5.0",
					svelte: "^5.7.0",
					"solid-js": "^1.9.0",
					"@angular/core": "^20.0.0",
					rxjs: "^7.8.0",
				},
			},
			null,
			2,
		),
	);

	run("npm", ["install", "--no-audit", "--no-fund", "--legacy-peer-deps"], temp);

	// ── 2a. the probe becomes a real consumer: it publishes `.lanka_di` ───────

	/*
	 * Everything above proves a symbol can be imported. None of it proves the one
	 * thing the framework asks of an application: that `@lanka_di/*` is ITS
	 * barrel and not ours.
	 *
	 * It was not, and nothing said so. `@lanka_di/*` was bundled rather than left
	 * external, so `dist` shipped `tools/testing/_fixtures/.lanka_di/` — four
	 * empty modules — and an installed `lanka` answered `Gateway "X" not found`
	 * for every gateway an application owns, with the consumer's alias pointing
	 * at a barrel nothing read. Every import above still passed: importing
	 * `lankaGateways` works perfectly against an empty registry.
	 *
	 * So this section RESOLVES. The barrels are written into the probe's
	 * `node_modules` by hand rather than installed, because npm refuses a package
	 * name with a capital letter and the barrel names are PascalCase — node's
	 * resolver does not care, and what a bundler alias produces is exactly this
	 * directory.
	 */
	const DI_BARRELS = {
		Contract: "export const lankaDiContractVersion = 1;\n",
		Host: 'import { createLankaHost } from "lanka";\nexport const lankaHost = createLankaHost();\n',
		Gateways:
			'import { ALankaGateway } from "lanka/gateway";\n' +
			"export class ProbeGateway extends ALankaGateway {\n" +
			'\tconstructor() {\n\t\tsuper({ basePath: "/probe" });\n\t}\n' +
			"}\n",
		/*
		 * A REAL scenario and a REAL shared store, and this is where 2.0.0 got out.
		 *
		 * These two barrels said `export {}` while `Gateways` and `Singletons` carried
		 * a class, and the difference was invisible until it was the whole bug: a
		 * consumer's class in a barrel imports BACK into this package — a scenario
		 * extends `ALankaScenario`, a store extends `ALankaSharedStore` — and
		 * surviving that cycle is what the published layout has to prove. An empty
		 * barrel has no cycle to fail, so it proved the resolution and nothing else.
		 *
		 * 2.0.0 shipped with `LankaScenarioBootstrap` and `ALankaScenario` in one
		 * chunk. Every import of a chunk is hoisted above its body, so the consumer's
		 * `Scenarios` barrel evaluated first and every application on lanka died on
		 * `Class extends value undefined is not a constructor or null` before its
		 * first screen. Nothing in this repository could see it: the playgrounds and
		 * every suite resolve `src`, and this file is the only place a chunk is ever
		 * loaded — and its `Scenarios` barrel was empty.
		 */
		Scenarios:
			'import { ALankaScenario } from "lanka/scenario";\n' +
			"export class ProbeScenario extends ALankaScenario {\n" +
			'\tname = "ProbeScenario";\n' +
			'\teventType = "probe";\n' +
			"}\n",
		SharedStores:
			'import { ALankaSharedStore } from "lanka/viewmodel";\n' +
			"export class ProbeSharedStore extends ALankaSharedStore {\n" +
			"\tconstructor() {\n\t\tsuper(() => ({ probed: true }));\n\t}\n" +
			"}\n",
		Singletons:
			'import { ALankaSingleton } from "lanka/locator";\n' +
			"export class ProbeSingleton extends ALankaSingleton {}\n",
	};

	for (const [name, source] of Object.entries(DI_BARRELS)) {
		const dir = join(temp, "node_modules", "@lanka_di", name);
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ name: `@lanka_di/${name}`, type: "module", main: "index.js" }),
		);
		writeFileSync(join(dir, "index.js"), source);
	}

	// The namespace is named after the SPECIFIER, not the symbol.
	//
	// It was the symbol until `modules/bindings/` existed, and five packages
	// publishing one name — `useLankaVM`, deliberately, so a consumer moving a
	// screen reads one guide — collided into
	// `Identifier 'm_useLankaVM' has already been declared`. The probe was
	// assuming a property of the surface that the shelf is built to break.
	const binding = (specifier, index) =>
		`m${String(index)}_${specifier.replace(/[^A-Za-z0-9]/g, "_")}`;

	const probe = CHECKS.map(({ specifier, symbol }, index) => {
		const name = binding(specifier, index);

		return (
			`import * as ${name} from ${JSON.stringify(specifier)};\n` +
			`if (typeof ${name}.${symbol} === "undefined") {\n` +
			`\tconsole.error(${JSON.stringify(`${specifier} does not export ${symbol}`)});\n` +
			`\tprocess.exit(1);\n}`
		);
	}).join("\n");

	writeFileSync(join(temp, "probe.mjs"), `${probe}\nconsole.log("OK");\n`);
	const result = run("node", ["probe.mjs"], temp);
	if (!result.includes("OK")) fail(`The probe did not finish:\n${result}`);

	// ── 3. the barrels actually reach the locators ───────────────────────────

	writeFileSync(
		join(temp, "locator-probe.mjs"),
		[
			'import { createLanka } from "lanka";',
			'import { lankaGateways, lankaScenarios, lankaSharedStores, lankaSingletons } from "lanka/locator";',
			'import { lankaHost } from "@lanka_di/Host";',
			'import { ProbeGateway } from "@lanka_di/Gateways";',
			'import { ProbeSingleton } from "@lanka_di/Singletons";',
			'import { ProbeScenario } from "@lanka_di/Scenarios";',
			'import { ProbeSharedStore } from "@lanka_di/SharedStores";',
			"",
			"createLanka({ host: lankaHost });",
			"",
			"if (!(lankaGateways.probeGateway instanceof ProbeGateway)) {",
			'\tconsole.error("lankaGateways did not resolve the consumer\'s own barrel");',
			"\tprocess.exit(1);",
			"}",
			"if (!(lankaSingletons.probeSingleton instanceof ProbeSingleton)) {",
			'\tconsole.error("lankaSingletons did not resolve the consumer\'s own barrel");',
			"\tprocess.exit(1);",
			"}",
			"if (!(lankaScenarios.probeScenario instanceof ProbeScenario)) {",
			'\tconsole.error("lankaScenarios did not resolve the consumer\'s own barrel");',
			"\tprocess.exit(1);",
			"}",
			"if (!(lankaSharedStores.probeSharedStore instanceof ProbeSharedStore)) {",
			'\tconsole.error("lankaSharedStores did not resolve the consumer\'s own barrel");',
			"\tprocess.exit(1);",
			"}",
			'console.log("OK");',
			"",
		].join("\n"),
	);
	const resolved = run("node", ["locator-probe.mjs"], temp);
	if (!resolved.includes("OK")) fail(`The locator probe did not finish:\n${resolved}`);

	console.log(
		`imports verified: ${CHECKS.length} · locators resolved against the consumer's barrels · packages: ${PACKAGES.length}`,
	);
} catch (error) {
	fail(String(error.stderr || error.message || error));
} finally {
	rmSync(temp, { recursive: true, force: true });
}
