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
import { dirname, join, resolve, sep } from "node:path";
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
	// The subpath the 2.0 migration sends every React consumer to: `renderWithLanka`
	// left `@lankajs/tool-testing` for here, so a consumer who changed only the
	// import learns whether this entry resolves from THEIR install, and nothing in
	// this repository would have told them first — every suite here reaches the
	// source by its relative path.
	{ specifier: "@lankajs/react/testing", symbol: "renderWithLanka" },
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
/*
 * The set built is the set PACKED, derived from the one list.
 *
 * It was four path globs, and `./modules/*` is one level deep: it selected the
 * seven modules at the top of `modules/` and none of the eighteen below them —
 * the whole `bindings/` shelf, every validator, `query/tanstack`. Their tarballs
 * were packed from whatever `dist` a previous run or a contributor's last build
 * happened to leave, which is the stale-directory failure section 0 exists to
 * prevent, happening to section 0.
 *
 * It reported success the entire time, and worse than that: pointed at a
 * deliberately broken `toLankaReactVM`, section 4 below passed, because the
 * source it was meant to be proving was never compiled into the tarball it read.
 */
console.log("building packages…");
run("pnpm", ["-r", ...PACKAGES.flatMap((dir) => ["--filter", `./${dir}`]), "build"], ROOT);

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

// ── 1b. no entry a consumer's own class imports reads a consumer barrel ──────

/**
 * The four entries whose names a barrel's CONTENTS import, and what they may not
 * reach.
 *
 * A gateway class extends `ALankaGateway` from `lanka/gateway`, a scenario
 * extends `ALankaScenario` from `lanka/scenario`, a shared store extends
 * `ALankaSharedStore` from `lanka/viewmodel`, a singleton extends
 * `ALankaSingleton` from `lanka/locator`. Every one of those classes is
 * published in a barrel that the framework READS — so if the entry it imports
 * also reaches the module doing the reading, the entry is inside a cycle whose
 * evaluation order it does not control.
 *
 * ## Why this is not covered by the probe below
 *
 * Node resolves that cycle correctly: a re-export of an already-initialised
 * binding is initialised, whichever order the chunks were imported in. So the
 * runtime probe passes and the trap is still set — the tarball of 2.0.1 had
 * `lanka/scenario` reaching `@lanka_di/Scenarios` through two chunks and node did
 * not care. Vitest's module runner did: a test whose first lanka import was
 * `lanka/scenario` got an undefined base class, because esbuild had put the
 * barrel-reading chunk ahead of the base class's in that entry, and the order
 * inside an entry is not ours to choose.
 *
 * What IS ours is whether the entry reaches a reader at all. It does not, and
 * this is what keeps it so: the invariant is ONE READER PER BARREL, in
 * `locator/`, which nothing a barrel exports imports from. `scripts/registry.mjs`
 * carries the reasoning under `barrelReaders`.
 *
 * `lanka` itself is deliberately absent from the list: the root entry re-exports
 * `createLanka`, which constructs all four locators, so it reaches every barrel
 * by design. A consumer's Host barrel imports it and nothing imports the Host
 * barrel back.
 */
const CYCLE_FREE_ENTRIES = [
	"core/dist/gateway/index.js",
	"core/dist/locator/index.js",
	"core/dist/scenario/index.js",
	"core/dist/viewmodel/index.js",
];

/** Everything a built file pulls in, transitively, by relative specifier. */
const reachableFrom = (entry) => {
	const seen = new Set();
	const stack = [entry];

	while (stack.length > 0) {
		const file = stack.pop();
		if (seen.has(file) || !existsSync(file)) continue;
		seen.add(file);

		for (const match of readFileSync(file, "utf8").matchAll(/from "(\.[^"]+)"/g)) {
			stack.push(resolve(dirname(file), match[1]));
		}
	}

	return seen;
};

for (const entry of CYCLE_FREE_ENTRIES) {
	const built = join(ROOT, entry);
	if (!existsSync(built)) fail(`${entry} is not built, so its import graph cannot be read.`);

	const readers = [...reachableFrom(built)].filter((file) =>
		/from "@lanka_di\//.test(readFileSync(file, "utf8")),
	);

	if (readers.length > 0) {
		fail(
			`${entry} reaches a module that reads a consumer barrel:\n` +
				readers.map((file) => `  ${file.slice(ROOT.length + 1)}`).join("\n") +
				`\n\nA consumer's own class imports this entry and is published in the barrel ` +
				`that module reads, so the entry is inside a cycle whose chunk order the ` +
				`build decides. Move the read to the locator — see \`barrelReaders\` in ` +
				`scripts/registry.mjs.`,
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
					// A renderer, because section 4 RENDERS. `react` alone proves that
					// a hook can be imported and never that one can run, and the
					// migration this repository asks React consumers to perform is
					// about call sites inside a render.
					"react-dom": "^19.2.0",
					// `@lankajs/react/testing` imports it: an OPTIONAL peer, so npm
					// does not bring it and a probe without it fails to resolve the
					// entry rather than verifying it.
					//
					// `/dom` beside it for the same reason one level down — it is
					// `@testing-library/react`'s own peer, and `--legacy-peer-deps`
					// installs no peers at all. A consumer's package manager resolves
					// it for them; this project has to say so.
					"@testing-library/react": "^16.3.0",
					"@testing-library/dom": "^10.4.1",
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

	// ── 4. the 1.x React spelling still works from the tarballs ──────────────

	/*
	 * The migration 2.0 asks of every React consumer, performed against the built
	 * packages.
	 *
	 * Until 2.0 a ViewModel WAS a hook. The port took the call signature away from
	 * core — correctly — and `toLankaReactVM` in `@lankajs/react` is what hands it
	 * back, so a consumer wraps once and changes no call site. That promise is
	 * asserted thirty-odd times in this repository and every one of those runs
	 * resolves `src`.
	 *
	 * Which is the same blind spot that shipped 2.0.0. The wrapper reaches ACROSS
	 * packages — `toLankaReactVM` closes over a ViewModel built by `lanka`, and its
	 * Proxy forwards every member of it — so what it depends on is two tarballs
	 * agreeing about one object, and the only place two tarballs meet is here. A
	 * consumer whose `getState` came back undefined would be the first to know.
	 *
	 * It RENDERS rather than only calling, because the call signature is the whole
	 * point and a hook outside a render is not one. `renderToStaticMarkup` rather
	 * than a DOM: it takes `useSyncExternalStore`'s server-snapshot path, which is
	 * what a consumer on Next reaches before any other, and it needs no jsdom in a
	 * probe whose job is to stay a plain `node` process.
	 */
	writeFileSync(
		join(temp, "react-migration-probe.mjs"),
		[
			'import { createElement } from "react";',
			'import { renderToStaticMarkup } from "react-dom/server";',
			'import { createLankaVM } from "lanka/viewmodel";',
			'import { createLankaVM as createReactLankaVM, toLankaReactVM } from "@lankajs/react";',
			"",
			"const fail = (message) => {",
			"\tconsole.error(message);",
			"\tprocess.exit(1);",
			"};",
			"",
			"// The two lines the 2.0 changeset asks a 1.x consumer to write, verbatim.",
			"const todosVM = createLankaVM({",
			'\tname: "ProbeTodosVM",',
			"\tstates: { todos: [], unread: 0 },",
			"\tcreateActions: ({ get, set }) => ({",
			'\t\tload: () => set({ todos: ["probed"] }),',
			"\t\ttouchUnread: () => set({ unread: get().unread + 1 }),",
			"\t}),",
			"});",
			"const useTodosVM = toLankaReactVM(todosVM);",
			"",
			"// What a loader does with it, outside any component — unchanged since 1.x.",
			'if (typeof useTodosVM !== "function") fail("the wrapped ViewModel is not callable");',
			'if (!("getState" in useTodosVM)) fail("`in` does not answer for the ViewModel");',
			// The two traps are asked separately because they fail separately: `has`
			// reads the ViewModel while `get` reads the function, and a wrapper with
			// only the first answers `"getState" in useTodosVM` with true and
			// `useTodosVM.getState` with undefined.
			'if (typeof useTodosVM.getState !== "function") fail("the wrapper did not forward getState");',
			"useTodosVM.getState().load();",
			'if (useTodosVM.getState().todos[0] !== "probed") fail("an action did not reach the store");',
			'if (useTodosVM.name !== "ProbeTodosVM") fail("the ViewModel name did not survive the wrapper");',
			"",
			"// And what a screen does: both call shapes, inside a real React render.",
			'const Todos = () => createElement("p", null, useTodosVM().todos.join(","));',
			'const Count = () => createElement("p", null, String(useTodosVM((state) => state.todos.length)));',
			"",
			"const list = renderToStaticMarkup(createElement(Todos));",
			'if (list !== "<p>probed</p>") fail(`the 1.x call shape rendered ${list}`);',
			"",
			"const count = renderToStaticMarkup(createElement(Count));",
			'if (count !== "<p>1</p>") fail(`the selector call shape rendered ${count}`);',
			"",
			"// The portable spelling reads the SAME object, which is what makes the",
			"// wrapper a spelling rather than a second store.",
			"if (useTodosVM.getState() !== todosVM.getState()) {",
			'\tfail("the callable and the ViewModel answered different states");',
			"}",
			"",
			// The declaration in ONE line, which is the same promise reaching across
			// the same two tarballs by a second route: the binding's factory calls
			// core's factory AND `createLankaCallableVM` from `lanka/extend`, so a
			// mismatch between the built packages breaks it where nothing local can
			// see. A consumer's very first line would be the first to know.
			"const useOneLineVM = createReactLankaVM({",
			'\tname: "ProbeOneLineVM",',
			"\tstates: { todos: [] },",
			'\tcreateActions: ({ set }) => ({ load: () => set({ todos: ["probed"] }) }),',
			"});",
			"",
			'if (typeof useOneLineVM !== "function") fail("the declared ViewModel is not callable");',
			'if (useOneLineVM.name !== "ProbeOneLineVM") fail("the declared ViewModel lost its name");',
			"useOneLineVM.getState().load();",
			"",
			'const oneLine = renderToStaticMarkup(createElement(() => createElement("p", null, useOneLineVM().todos.join(","))));',
			'if (oneLine !== "<p>probed</p>") fail(`the one-line declaration rendered ${oneLine}`);',
			"",
			'console.log("OK");',
			"",
		].join("\n"),
	);
	const rendered = run("node", ["react-migration-probe.mjs"], temp);
	if (!rendered.includes("OK")) fail(`The React migration probe did not finish:\n${rendered}`);

	// ── 5. every binding's one-line declaration, from the tarballs ───────────

	/*
	 * The same promise as section 4, for the four members a renderer cannot reach
	 * here.
	 *
	 * All five bindings publish core's six ViewModel factories under core's own
	 * names, and each one reaches ACROSS packages twice: to core's factory and to
	 * `createLankaCallableVM` in `lanka/extend`. Section 4 proves that for React
	 * by rendering, and rendering is exactly what the other four cannot do in a
	 * plain `node` process — so without this they were released on unit tests that
	 * all resolve `src`, and a bundling or interop regression in one binding's
	 * dist would have been a consumer's discovery.
	 *
	 * What is asserted is the DECLARATION, which is framework-free by
	 * construction: the factory runs at module level and only the CALL needs a
	 * component, an owner or an injection context. That makes Angular the sharpest
	 * case and the reason this is worth its own section — `toLankaSignals` asserts
	 * an injection context the moment it is called, so a binding that pre-applied
	 * it instead of `useLankaVM` would throw on IMPORT, from the built tarball,
	 * for every consumer at once.
	 */
	const DECLARING_BINDINGS = [
		["@lankajs/vue", "Vue"],
		["@lankajs/svelte", "Svelte"],
		["@lankajs/solid", "Solid"],
		["@lankajs/angular", "Angular"],
	];

	writeFileSync(
		join(temp, "declaration-probe.mjs"),
		[
			...DECLARING_BINDINGS.map(
				([specifier], index) =>
					`import { createLankaVM as declare${index} } from "${specifier}";`,
			),
			"",
			"const fail = (message) => {",
			"\tconsole.error(message);",
			"\tprocess.exit(1);",
			"};",
			"",
			`const vendors = ${JSON.stringify(DECLARING_BINDINGS.map(([, vendor]) => vendor))};`,
			`const declarers = [${DECLARING_BINDINGS.map((_, index) => `declare${index}`).join(", ")}];`,
			"",
			"declarers.forEach((declare, at) => {",
			"\tconst vendor = vendors[at];",
			"",
			"\t// At MODULE level, with no component, owner or injection context in",
			"\t// sight — which is where a consumer writes it and where Angular would",
			"\t// throw if the wrong read had been pre-applied.",
			"\tconst useOneLineVM = declare({",
			"\t\tname: `Probe${vendor}VM`,",
			"\t\tstates: { todos: [] },",
			'\t\tcreateActions: ({ set }) => ({ load: () => set({ todos: ["probed"] }) }),',
			"\t});",
			"",
			'\tif (typeof useOneLineVM !== "function") fail(`${vendor}: the declaration is not callable`);',
			"\tif (useOneLineVM.name !== `Probe${vendor}VM`) {",
			"\t\tfail(`${vendor}: the ViewModel name did not survive the declaration`);",
			"\t}",
			// The two traps fail separately: `has` reads the ViewModel while `get`
			// reads the function, and a wrapper with only the first answers the `in`
			// with true and the read with undefined.
			'\tif (!("getState" in useOneLineVM)) {',
			'\t\tfail(`${vendor}: the "in" operator does not answer for the ViewModel`);',
			"\t}",
			'\tif (typeof useOneLineVM.getState !== "function") fail(`${vendor}: getState was not forwarded`);',
			"",
			"\tuseOneLineVM.getState().load();",
			"",
			'\tif (useOneLineVM.getState().todos[0] !== "probed") {',
			"\t\tfail(`${vendor}: an action did not reach the store`);",
			"\t}",
			"});",
			"",
			'console.log("OK");',
			"",
		].join("\n"),
	);
	const declared = run("node", ["declaration-probe.mjs"], temp);
	if (!declared.includes("OK")) fail(`The declaration probe did not finish:\n${declared}`);

	console.log(
		`imports verified: ${CHECKS.length} · locators resolved against the consumer's barrels · ` +
			`the 1.x React spelling and the one-line declaration rendered from the tarballs · ` +
			`all five bindings declared from theirs · packages: ${PACKAGES.length}`,
	);
} catch (error) {
	fail(String(error.stderr || error.message || error));
} finally {
	rmSync(temp, { recursive: true, force: true });
}
