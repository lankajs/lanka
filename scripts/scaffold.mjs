/**
 * Generates every package's manifest and documentation from `registry.mjs`.
 *
 * Idempotent, and overwrites only ITS OWN files — `package.json`,
 * `tsconfig.json`, `tsup.config.ts`, `README.md` and the per-package copy of
 * `LICENSE`. Never touches sources.
 *
 * A script rather than eighteen pairs of hands because what a README states —
 * kind, environments, extension point, contents — must agree with `package.json`.
 * Here there is no second copy to disagree: one copy, derived.
 *
 * Run: node scripts/scaffold.mjs
 */

import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { KINDS, ORIGIN, PACKAGES, pkgName, pkgDir } from "./registry.mjs";
import { generateLlmsIndex } from "./llms.mjs";
import { currentVersion, generateSkillPackaging } from "./skills.mjs";

const ROOT = process.cwd();

/**
 * The environments, as a consumer reads them.
 *
 * "browser, node, native" is the declaration; "everywhere" is what all three
 * mean, and a reader deciding whether a package works in their server loader
 * should not have to notice that the list is complete.
 */
const RUNTIME_LABEL = (runtime = []) =>
	runtime.length === 3
		? "the browser, node and React Native — everywhere"
		: runtime
				.map(
					(env) =>
						({ browser: "the browser", node: "node", native: "React Native" })[env],
				)
				.join(" and ");

const w = (rel, text) => {
	const full = join(ROOT, rel);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, text, "utf8");
};

const CORE_SUBSYSTEMS = PACKAGES.find((p) => p.kind === "core").subsystems;

/**
 * Source file for an entry: for core an entry is a subsystem folder with a
 * barrel; for everything else it is a file at the root of `src/`.
 */
function srcPath(p, entry) {
	// A tier's barrel lives in the bucket it publishes, marked as a bucket is:
	// `lanka/internal` is `src/_internal/index.ts`. The marker is a structure
	// rule and the path is a publishing decision, and neither has to move for
	// the other.
	if (tierNames(p).includes(entry)) return `_${entry}/index.ts`;

	const declared = declaredEntry(p, entry);
	if (declared) return declared.file;

	return p.kind === "core" ? `${entry}/index.ts` : `${entry}.ts`;
}

/**
 * A package's public entries: root plus subsystems (core) or declared `entries`.
 *
 * One list feeds three places — the `exports` map, the `publishConfig.exports`
 * map and the build config. They cannot diverge: all three derive from it.
 */
function entryNames(p) {
	const facade = p.kind === "core" ? CORE_SUBSYSTEMS : (p.entries ?? []);
	return [...facade.map((e) => (typeof e === "string" ? e : e.name)), ...tierNames(p)];
}

/**
 * An entry whose subpath and file differ.
 *
 * Written as `{ name, file }` when the two cannot be the same: a subpath a
 * consumer types (`/router`) over a unit that lives in its own folder with its
 * test, which is what the structure canon asks of anything tested.
 */
function declaredEntry(p, entry) {
	return (p.entries ?? []).find((e) => typeof e === "object" && e.name === entry);
}

/**
 * The non-facade tiers a package publishes.
 *
 * They are entries like any other, so the `exports` map, the published map and
 * the bundler's entry list all derive from one place. What differs is the
 * promise, and that is written in the import path a consumer types.
 */
function tierNames(p) {
	return p.tiers ?? [];
}

// ── package.json ────────────────────────────────────────────────────────────

function manifest(p) {
	const name = pkgName(p);
	const dir = pkgDir(p);

	// A subsystem is exported through its BARREL, not a per-file pattern.
	//
	// `"./gateway/*": "./src/gateway/*.ts"` would make EVERY file of the
	// subsystem public, so moving a file inside it becomes a breaking change and
	// the consumer's import reads
	// `lanka/gateway/request/LankaFetchJsonRequest/LankaFetchJsonRequest`.
	//
	// With a barrel, public is exactly what it lists. Checked by
	// `core/src/publicSurface.test.ts`.
	const entries = entryNames(p);

	// Development reads SOURCES, publishing reads `dist`.
	//
	// Two maps with different consumers, not duplication. Inside the monorepo a
	// neighbour is compiled by the importer's bundler, and requiring a build
	// before every test run would charge for it on every change. An npm consumer
	// may have neither TypeScript nor a bundler.
	//
	// pnpm substitutes `publishConfig` FOR the main fields when packing, so only
	// the second map ships. Checked by `scripts/verify-build.mjs`, which installs
	// a real tarball into a temporary project.
	const exportsMap = {
		".": "./src/index.ts",
		...Object.fromEntries(entries.map((e) => [`./${e}`, `./src/${srcPath(p, e)}`])),
	};

	// `dist` paths mirror `src`: the bundler keeps the structure relative to the
	// common entry root. Core entries are folders with barrels, hence
	// `./dist/gateway/index.js` rather than `./dist/gateway.js`. Both paths derive
	// from one `srcPath`, so the map cannot disagree with what was built.
	const distPath = (entry) => srcPath(p, entry).replace(/.ts$/, "");
	const publishedExports = {
		".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
		...Object.fromEntries(
			entries.map((e) => [
				`./${e}`,
				{
					types: `./dist/${distPath(e)}.d.ts`,
					default: `./dist/${distPath(e)}.js`,
				},
			]),
		),
	};

	const json = {
		name,
		// The version is the ONE field this script does not own: changesets writes
		// it, and the scaffolder keeps whatever is there.
		//
		// It used to be pinned to "0.0.0" — true while nothing was published, and a
		// release blocker the moment something was: `changeset version` writes
		// 1.0.0, the next scaffold run rewrites it back, and `check:drift` — which
		// CI runs FIRST, before the publish — fails on a tag that was correct.
		version: currentVersion(dir),
		type: "module",
		description: `${KINDS[p.kind].label}: ${p.gist}`,
		// License and repository are mandatory for a published package: without
		// them npm shows neither sources nor terms, and the consumer learns the
		// licence after the fact.
		license: "MIT",
		repository: {
			type: "git",
			url: `git+${ORIGIN.repository}.git`,
			directory: pkgDir(p),
		},
		homepage: `${ORIGIN.repository}/tree/main/${pkgDir(p)}#readme`,
		main: "./src/index.ts",
		types: "./src/index.ts",
		exports: exportsMap,
		// Honestly `false`: no framework module does work on import. The one that
		// could, `ALankaScenario`, fills its pool in the CONSTRUCTOR, and
		// `LankaScenarioBootstrap` constructs them by an explicit call.
		sideEffects: false,
		// `skills` ships the consumer skill INSIDE the tarball, which is the only
		// way a skill can be the one for the version actually installed. The plugin
		// manifest beside it does not ship: it is how git users install the same
		// folder, and npm has no use for it.
		files: ["dist", "LICENSE", "README.md", "skills"],
		publishConfig: {
			main: "./dist/index.js",
			types: "./dist/index.d.ts",
			exports: publishedExports,
		},
		scripts: {
			build: "tsup",
			// The playground is linted too. It is the file a consumer copies from,
			// and an example that breaks the rules the package publishes teaches
			// them wrong faster than the README teaches them right.
			lint: "eslint src _playground --max-warnings=0",
			...(p.hasTests
				? {
						test: "vitest run",
						// The coverage thresholds are a ratchet, and a ratchet nothing
						// turns is a number in a file. `pnpm check` runs THIS rather than
						// `test`, so the two never disagree about what passed.
						"test:coverage": "vitest run --coverage",
						"test:watch": "vitest",
						// Benches are not part of `test`: they take a fifth of a second each
						// and answer a different question. `scripts/bench.mjs` calls this.
						bench: "vitest bench --run",
					}
				: {}),
			typecheck: "tsc -p tsconfig.json --noEmit",
		},
		...(p.deps && Object.keys(p.deps).length ? { dependencies: p.deps } : {}),
		...(p.devDeps && Object.keys(p.devDeps).length ? { devDependencies: p.devDeps } : {}),
		...(p.peer && Object.keys(p.peer).length ? { peerDependencies: p.peer } : {}),
		// A peer nobody is required to install. Declared for its TYPES, or for one
		// of several bundlers a package supports: without this, every consumer
		// answers a warning about a tool they deliberately do not use.
		...(p.peerOptional?.length
			? {
					peerDependenciesMeta: Object.fromEntries(
						p.peerOptional.map((name) => [name, { optional: true }]),
					),
				}
			: {}),
	};

	// A command a consumer types. Declared in the registry as the SOURCE path, and
	// rewritten to `dist` for the published manifest by the same rule as `exports`:
	// a bin pointing into `src` works in the monorepo and is a broken command in
	// every installed copy.
	if (p.bin) {
		json.bin = Object.fromEntries(
			Object.entries(p.bin).map(([command, entry]) => [command, `./src/${entry}.ts`]),
		);
		json.publishConfig.bin = Object.fromEntries(
			Object.entries(p.bin).map(([command, entry]) => [command, `./dist/${entry}.js`]),
		);
	}

	// A plugin MUST declare a peer dependency on core — that is the machine-checked
	// difference between a plugin and a module. A module depends on core normally
	// or not at all; a plugin is always a peer, because it plugs into THE SAME core
	// instance the consumer created.
	if (p.kind === "plugin") {
		json.peerDependencies = { lanka: "workspace:^", ...(p.peer ?? {}) };
		// …and SIMULTANEOUSLY a normal dev dependency. A peer is not installed by
		// itself: it tells the consumer "bring your own", and a plugin cannot be
		// developed or tested without core. Without this line `import "lanka"` does
		// not resolve in the plugin's own test — it builds, but nothing can verify it.
		json.devDependencies = { lanka: "workspace:^", ...(json.devDependencies ?? {}) };
	}

	w(`${dir}/package.json`, JSON.stringify(json, null, "\t") + "\n");
}

// ── tsconfig.json ───────────────────────────────────────────────────────────

function tsconfig(p) {
	const dir = pkgDir(p);
	const depth = dir.split("/").length;
	const up = "../".repeat(depth);

	// `@lanka_di/*` is repeated here although the base config has it: the bundler's
	// dts step builds its OWN program rooted at the package directory, and `paths`
	// declared one level up never reach it — the types build fails with "Cannot
	// find module @lanka_di/Gateways" while the package's own `tsc` passes. The
	// path is relative to THIS file, which makes it independent of who reads it.
	const needsDiAlias = p.kind === "core";
	const json = {
		extends: `${up}tsconfig.base.json`,
		// No `rootDir`. Under `noEmit` it adds nothing but FORBIDS a file from a
		// neighbouring package entering the program — which is legal while packages
		// are consumed from source: a core spec imports the host stub from
		// @lankajs/tool-testing, the locator imports the barrel fixture.
		compilerOptions: {
			noEmit: true,
			...(needsDiAlias
				? { paths: { "@lanka_di/*": [`${up}tools/testing/_fixtures/.lanka_di/*`] } }
				: {}),
		},
		include: [
			"src/**/*",
			// Every package has one, and a playground outside the program is a
			// miniature application nothing type-checks: it would keep compiling
			// against a signature the package no longer has.
			"_playground/**/*",
			...(p.slug === "testing" ? ["_fixtures/**/*"] : []),
			"vitest.config.ts",
			"tsup.config.ts",
		],
	};
	w(`${dir}/tsconfig.json`, JSON.stringify(json, null, "\t") + "\n");
}

// ── tsup.config.ts ──────────────────────────────────────────────────────────

function tsupConfig(p) {
	const dir = pkgDir(p);
	const entries = ["src/index.ts", ...entryNames(p).map((e) => `src/${srcPath(p, e)}`)];
	const lines = [
		'import { defineConfig } from "tsup";',
		"",
		"/**",
		" * Package build: ESM plus `.d.ts`, one file per entry in `exports`.",
		" *",
		" * Built by a BUNDLER rather than `tsc` for one reason: `tsc` emits relative",
		" * specifiers as written — without extensions — and node in ESM mode cannot",
		" * resolve them. The choice was between rewriting every import in the sources",
		" * and a bundler that does it.",
		" *",
		" * `splitting` is on: there are many entries, and without it shared code would",
		" * be copied into each, so a consumer taking two subsystems would pay for the",
		" * core twice.",
		" *",
		" * `@lanka_di/*` is EXTERNAL, and that line is the whole reason a published",
		" * package can be wired to anything. Those specifiers are the consumer's",
		" * barrels; this repository resolves them to `tools/testing/_fixtures/.lanka_di/`",
		" * so its own suite has something to read. Bundled, that fixture SHIPS — and it",
		" * is empty, so an installed `lanka` resolves every gateway, scenario and",
		" * singleton against `{}` and throws `not found` for all of them, while the",
		" * consumer's `@lanka_di` alias has nothing left to attach to. Left external,",
		" * the import survives into `dist` and into the `.d.ts`, and the consumer's",
		" * bundler alias and `tsconfig` paths answer it — which is what the inversion",
		" * was for. Declared for every package, not just `core`: a specifier nothing",
		" * imports costs nothing to externalise, and a per-package list is a second",
		" * list to keep in step.",
		" *",
		" * GENERATED from `scripts/registry.mjs`. Edit the registry.",
		" */",
		"export default defineConfig({",
		"	entry: [",
		...entries.map((e) => `		${JSON.stringify(e)},`),
		"	],",
		'	format: ["esm"],',
		"	dts: true,",
		"	splitting: true,",
		"	clean: true,",
		"	sourcemap: true,",
		'	target: "es2022",',
		"	external: [/^@lanka_di\\//],",
		"});",
		"",
	];
	w(`${dir}/tsup.config.ts`, lines.join(String.fromCharCode(10)));
}

// ── README.md ───────────────────────────────────────────────────────────────

function readme(p) {
	const kind = KINDS[p.kind];
	const name = pkgName(p);
	const dir = pkgDir(p);
	const L = [];

	L.push(`# ${name}`, "");
	L.push(`**${kind.badge} ${kind.label}** · ${p.title}`, "");
	L.push(`> ${p.gist}`, "");
	L.push(kind.rule, "");

	// Where the package runs, from the declaration `check-runtime.mjs` holds it
	// to. Generated rather than written, because the answer a consumer needs is
	// the one the gate enforces — not the one a README remembered.
	// An entry with an environment of its own is named, because a package-level
	// "everywhere" beside a node-only subpath is the sentence a consumer would
	// have been better off not reading.
	const narrowed = (p.entries ?? []).filter(
		(entry) => typeof entry === "object" && entry.runtime,
	);
	L.push(
		`**Runs in:** ${RUNTIME_LABEL(p.runtime)}` +
			narrowed
				.map((entry) => ` · \`${name}/${entry.name}\`: ${RUNTIME_LABEL(entry.runtime)}`)
				.join("") +
			".",
		"",
	);

	// This file answers "what is this, and why is it shaped this way". The other
	// two questions have their own owners, and the link is generated so a package
	// cannot end up without one.
	L.push(
		"**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. " +
			"**How to change it:** [SKILL.md](./SKILL.md).",
		"",
	);

	if (p.socket) {
		L.push("## Extension point", "", "Plugs into:", "", "```", p.socket, "```", "");
	}
	if (p.extensionPoints) {
		L.push("## Extension points core declares", "");
		L.push("| Point | What it gives | Available |", "| --- | --- | --- |");
		for (const [pt, what, have] of p.extensionPoints)
			L.push(`| \`${pt}\` | ${what} | ${have} |`);
		L.push(
			"",
			"The list is closed on purpose. Each point is a public contract for the lifetime of a",
			"major version, so anything that can be a module must be a module.",
			"",
		);
	}
	if (p.subsystems) {
		L.push("## Subsystems", "");
		L.push(
			"Flat, with no intermediate `Layers/`: **folder = subpath in `exports` = line in this list.**",
			"",
			"Each subsystem is exported through its BARREL (`index.ts`), so public is exactly what the",
			"barrel lists, moving a file inside a subsystem is not a breaking change, and a consumer's",
			"import reads `lanka/gateway`.",
			"",
			"`internal/` is not in the map — that is what may be refactored without a major. Hence the",
			"rule: a primitive a neighbouring package needs has two honest exits, becoming public here",
			"or moving to the neighbour. `src/publicSurface.test.ts` checks the map, the barrels and",
			"the seal on `internal`, and catches a subsystem added as a folder and forgotten in",
			"`exports`.",
			"",
		);
		for (const s of p.subsystems) L.push(`- \`src/${s}/\``);
		L.push("- `src/internal/` — **not exported.** Refactored without a major.", "");

		L.push(
			"## Instance",
			"",
			"```ts",
			"const lanka = createLanka({ host, flags });",
			"await lanka.bootstrap({ services });",
			"```",
			"",
			"The instance owns all framework state: the bus, the scenario registries, four locator",
			"caches, the config and the in-flight request counter. Module-level state made three",
			"things impossible, none of which looked like a bug: two apps in one process shared a",
			"bus, SSR reused state between different users' requests, and test isolation rested on a",
			"global `beforeEach` reaching into internal registries.",
			"",
			"**Ambient facades** — `lankaEventBus.dispatch`, `lankaSingletons.foo`, `getLankaFlags()`,",
			"`lankaHttpInFlight` — resolve THE ONE active instance (`internal/activeRuntime.ts`).",
			"They exist for callers that cannot hold an instance: a user-extended `ALankaScenario`,",
			"the static `LankaScenarioBootstrap`, a module package with no instance in scope.",
			"Isolation belongs to the instance holder; a facade cannot offer it.",
			"",
			"One thing stays at module level deliberately: `ALankaScenario` collects constructed",
			"scenarios into a static pool. That is not runtime state but a REGISTRY OF DEFINITIONS —",
			"the classes come from one `@lanka_di/Scenarios` barrel and both instances must see the",
			"same list. Splitting it would be divergence, not isolation.",
			"",
		);

		L.push(
			"## Failure",
			"",
			"`LankaError` carries a TAGGED kind: `network` · `timeout` · `aborted` · `http` · `schema` ·",
			"`domain`. Six rather than one, because each demands something different of the interface:",
			"a network failure invites a retry, an aborted request is not shown at all (the user left),",
			"a schema break is reported as a break rather than as the user's fault.",
			"",
			"The kind is assigned where the failure is born: in `ALankaRequest.execute`, the single",
			"point every request passes through.",
			"",
			"Parsing a particular response body format is NOT here: which JSON the backend sends is",
			"policy, and policy lives in `@lankajs/plugin-http`.",
			"",
			"## Host contract",
			"",
			"```ts",
			"interface ILankaHost {",
			"	apiBaseUrl: string;",
			"	httpErrorMessage(status: number): string;",
			"	networkErrorMessage(): string;",
			"	timeoutErrorMessage(): string;",
			"}",
			"```",
			"",
			"All required, and that is the choice: a forgotten field is a compile error in the one",
			"place it can be passed, rather than a wrong-language string in the interface or an",
			"`undefined` inside a request URL. `ALankaGateway.endpoint()` prefixes with `apiBaseUrl`.",
			"",
		);

		L.push(
			"### Request middleware shape",
			"",
			"**Request middleware is a WRAPPER, not a set of hooks.** The `(ctx, next) => …` shape,",
			"because retry cannot be expressed with `onRequest`/`onResponse`/`onError`: `onError` can",
			"replace an error but cannot run the request again — and retry plus auth refresh are the",
			"two main abilities of a request-policy plugin. Registered first wraps the rest.",
			"",
			"The objection to `next()` that holds for the event bus does not carry over: there a",
			"middleware that skips `next` SILENCES the event, here it returns a value instead of a",
			"request, and the caller sees it.",
			"",
			"**Cancellation and timeout.** `execute` takes `signal` and `timeoutMs`; the default",
			"timeout is per instance. The framework combines the caller's signal and its own timer",
			"into ONE signal and still distinguishes who aborted: a timed-out request yields `timeout`",
			"and is shown, a caller-aborted one yields `aborted` and stays silent. `AbortSignal` does",
			"not distinguish them — it has one `abort` for everyone.",
			"",
		);

		L.push(
			"## Response body validation",
			"",
			"The port accepts ANY schema implementing Standard Schema: zod 4, valibot, arktype. An",
			"abstraction typed by its single implementation is not an abstraction; the proof is a",
			"second implementation passing the same assertions, and it is in the tests.",
			"",
			"There are no adapter classes: a schema describes itself. The app chooses the library —",
			"`@lankajs/zod`, `@lankajs/valibot`, or neither, working with schemas directly.",
			"",
			"An async schema is rejected LOUDLY. Standard Schema allows `validate` to return a",
			'promise, a synchronous port cannot await it, and answering "fine" would let unvalidated',
			"data through — a check that cannot fail reporting success.",
			"",
		);

		L.push(
			"## Lifetime",
			"",
			"`lanka.createScope()` gives a lifetime shorter than the application's: an object created",
			"in a scope goes away with it.",
			"",
			"A scope takes only ITS OWN objects. One that took others' would be more dangerous than no",
			"scopes at all: closing a screen would break the app. Resolving from a closed scope is",
			"rejected loudly — it is almost always a reference that outlived its screen.",
			"",
			"A lazy ViewModel has `dispose()` for the same reason: it subscribes to scenarios on first",
			"use, and without explicit disposal the subscription outlives the screen that created it.",
			"",
			"## Access-tracking blind spot",
			"",
			"A consumer re-renders only for keys it READ through the proxy. An action computing a",
			"value via `get()` reads state past the proxy — so a component whose only link to a key",
			"goes through such a getter never re-renders: the screen freezes and there is no error.",
			"",
			'It cannot be fixed in the view: destructuring "for the side effect" reads as dead code and',
			"the next refactor or lint autofix removes it. The fix is",
			"`enableAccessTrackingOptimization: false`, and so that nobody has to remember it, in",
			"development the mismatch announces itself: the framework sees that a key changed, that no",
			"re-render will follow, and that the component reads that key through a getter — and warns",
			"with the ViewModel and key names.",
			"",
			"The trap stays silent on healthy code: not reading what you do not need is the work",
			"tracking exists for.",
			"",
		);

		L.push(
			"## Event bus",
			"",
			"**Buffering on request only.** Buffer depth is the maximum of what the event declares",
			"(`registerEvent({ replay: N })`) and what subscribers ask for; when the last asker",
			"unsubscribes the buffer is cleared. Buffering every payload unconditionally holds",
			"personal data in memory with no consumer at all.",
			"",
			'**`replay` counts values:** `false | "last" | N`, where `true` means "last".',
			"",
			"**`subscribe` returns an unsubscribe.** It removes EXACTLY that subscription: by callback,",
			"two subscriptions of one function are indistinguishable.",
			"",
			"**Delivery iterates a COPY of the subscriber list.** A subscriber may unsubscribe inside",
			"its own handler, and unsubscribing splices the same array, so iterating the original",
			"skipped a neighbour silently. The deliberate side effect: subscribing during delivery",
			"waits for the next event.",
			"",
			"**`registerEvent` merges metadata** instead of recreating state; recreating dropped every",
			"subscriber silently.",
			"",
			'**Middleware returns a decision** — `"pass"` or `{ stop: reason }`. A `next()`-based shape',
			"means not calling it makes the event vanish SILENTLY: a mechanism that exists for",
			"observability would be its own blind spot. A stop is written to the event log and is",
			"visible to the inspector. An exception in middleware is treated the same way.",
			"",
		);
	}
	if (p.contains) {
		L.push("## Contents", "");
		for (const c of p.contains) L.push(`- ${c}`);
		L.push("");
	}
	if (p.notes) {
		// Package prose lives in the REGISTRY, not here: a generator that knows a
		// specific package by name becomes a second place holding the truth about it.
		L.push(...p.notes, "");
	}
	L.push(
		"---",
		"",
		`Repository map: [${"../".repeat(dir.split("/").length)}README.md](${"../".repeat(dir.split("/").length)}README.md)`,
		"",
	);

	w(`${dir}/README.md`, L.join("\n"));
}

// ── empty packages: so `src` exists in git ──────────────────────────────────

// The placeholder is written when sources are ACTUALLY absent. A package without
// a single `.ts` fails typecheck ("No inputs were found"), so emptiness would
// break the run rather than simply do nothing.
function placeholder(p) {
	const dir = pkgDir(p);
	const srcDir = join(ROOT, dir, "src");
	const hasSources =
		existsSync(srcDir) &&
		readdirSync(srcDir).some((f) => f.endsWith(".ts") && f !== "index.ts");
	if (hasSources || existsSync(join(srcDir, "index.ts"))) return;
	w(
		`${dir}/src/index.ts`,
		[
			`/**`,
			` * ${pkgName(p)} — ${p.title}.`,
			` *`,
			` * Empty so far. An empty export rather than a missing file: the package must`,
			` * resolve and build from day one, or the first attempt to wire it hits a`,
			` * resolution error instead of an honest "nothing here yet".`,
			` */`,
			`export {};`,
			``,
		].join("\n"),
	);
	w(`${dir}/src/.gitkeep`, "");
}

// ── LICENSE ─────────────────────────────────────────────────────────────────

/**
 * The root licence, copied into every package.
 *
 * A copy per package rather than the root file alone, because npm packs only
 * what sits inside the package directory: a tarball would otherwise declare
 * `"license": "MIT"` and carry no terms, and the consumer would learn them from
 * a link. The MIT text itself requires the notice to travel with the software.
 *
 * Copied rather than written here, so the legal text has ONE author and the
 * nineteen copies cannot drift from it.
 */
function license(p) {
	w(`${pkgDir(p)}/LICENSE`, readFileSync(join(ROOT, "LICENSE"), "utf8"));
}

// ── root README ─────────────────────────────────────────────────────────────

function rootReadme() {
	const L = [];
	L.push("# lanka", "");
	L.push(
		"A layered React application framework: **lankaGateways → ViewModels → Views**, scenarios",
		"over an event bus, and a locator for dependency resolution.",
		"",
		"*Lanka* is a link in a chain: the thing that means something only through what it",
		"connects. That is the job description — a frame, not a building. It has no opinion about",
		"routing or styling, and it ships no components.",
		"",
	);

	L.push("## One rule", "");
	L.push(
		"Imports go ONE way. A ViewModel may reach a gateway; a gateway does not know ViewModels",
		"exist. Not a convention — it is checked, and a violation names the file and the line.",
		"",
	);

	L.push("## Telling one from another", "");
	L.push(
		"The first question when reading this repository is what a package IS. The answer is",
		"visible twice: in the top-level folder and in the npm name. Either alone would be too",
		"little — a file tree shows no names, a dependency list shows no folders.",
		"",
	);
	L.push(
		"| | Folder | npm name | Core dependency | How it is wired |",
		"| --- | --- | --- | --- | --- |",
	);
	L.push("| ◆ **core** | `core/` | `lanka` | — | `createLanka()` |");
	L.push("| ▸ **module** | `modules/<name>/` | `@lankajs/<name>` | normal or none | `import` |");
	L.push(
		"| ⬡ **plugin** | `plugins/<name>/` | `@lankajs/plugin-<name>` | **always `peerDependencies`** | `lanka.use(...)` |",
	);
	L.push(
		"| ⚒ **tool** | `tools/<name>/` | `@lankajs/tool-<name>` | normal or none | build / lint / test config |",
	);
	L.push("");

	L.push(
		"The module/plugin distinction is not about size or importance but about **who calls whom**:",
		"",
		"- **A module** is called by the app: `app → module`. Core does not know it exists. Remove",
		"  a module and core works the same.",
		"- **A plugin** is called by core: `app → core → plugin`. For that, core must declare an",
		"  extension point and support it forever. Remove a plugin and core works, without the",
		"  advertised ability.",
		"",
		"One test question: **does core need a hook for this to work?** No — module. Yes — plugin.",
		"Hence the rule that matters most here: **if a thing can be a module, it must be a module**,",
		"because every extension point is a promise for the lifetime of a major version.",
		"",
		"### Why a plugin uses a peer dependency",
		"",
		"A plugin plugs into THE SAME core instance the consumer created. A normal dependency would",
		"give it its own copy of core — its own active instance, bus and locators; the plugin would",
		"work and the app would not see the result.",
		"",
		"The range is always `workspace:^`, and that is not style. pnpm substitutes it on pack as",
		"`^0.1.0`, a range. `workspace:*` would become an EXACT version, and the plugin would demand",
		"exactly the core version it was built against: any core update would break installation. Verified by reading the",
		"tarball (`scripts/verify-build.mjs`), not the source manifest, and rejected by",
		"`scripts/check-publishable.mjs`.",
		"",
	);

	for (const kind of ["core", "module", "plugin", "tool"]) {
		const k = KINDS[kind];
		const list = PACKAGES.filter((p) => p.kind === kind);
		L.push(`## ${k.badge} ${k.label[0].toUpperCase()}${k.label.slice(1)}`, "");
		L.push("| Package | What |", "| --- | --- |");
		for (const p of list) {
			L.push(`| [\`${pkgName(p)}\`](./${pkgDir(p)}) | ${p.title} |`);
		}
		L.push("");
	}

	L.push("## Core layout", "");
	L.push(
		"Flat by subsystem, with no intermediate `Layers/`. The property this buys: **folder =",
		"subpath in `exports` = line in the core map.** Three lists that used to be reconciled by",
		"hand became one.",
		"",
		"```",
		"core/src/",
		...CORE_SUBSYSTEMS.map((s) => `├── ${s}/`),
		"├── _extend/         published as \`lanka/extend\`",
		"└── _internal/       published as \`lanka/internal\`",
		"```",
		"",
	);

	L.push("## What is promised", "");
	L.push(
		"Everything is reachable. Only what is named is promised, and the tier is written in",
		"the import path:",
		"",
		"| Import | Holds | Breaks in |",
		"| --- | --- | --- |",
		"| \`lanka\`, \`lanka/gateway\`, … | the facade a normal application uses | a major — and a name here is never removed |",
		"| \`lanka/extend\` | mechanism: registries, wiring, what a devtool or a competing implementation needs | a minor |",
		"| \`lanka/internal\` | primitives, shared between packages | any release |",
		"",
		"Reaching past the facade is therefore possible, deliberate, and visible in review —",
		"rather than impossible, which only makes people fork the framework.",
		"",
		"Every promise is written down: [\`api/\`](./api) holds one report per package, and",
		"\`pnpm check:api\` fails when a barrel and its report disagree. How a version may",
		"change, and why a superseded name keeps working instead of being deleted, are",
		"[\`skills/surface/SKILL.md\`](./skills/surface/SKILL.md).",
		"",
	);

	L.push("## Where to start", "");
	L.push(
		"- **[`core/GUIDE.md`](./core/GUIDE.md)** — the framework, taught in order. One line",
		"  starts an application; the rest is what to reach for and when.",
		"- **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — how applications on lanka are usually",
		"  organised, with every recommendation labelled `Checked`, `Recommended` or `Taste`,",
		"  so a reader always knows whether they are looking at a rule or an opinion.",
		"- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — working on the framework itself.",
		"",
	);

	L.push("## Three documents per package", "");
	L.push(
		"Every package answers three different questions in three files, so none of them",
		"has to guess who its reader is:",
		"",
		"| File | Answers | Written for |",
		"| --- | --- | --- |",
		"| `README.md` | what this is, and why it is shaped this way | anyone deciding whether to install it |",
		"| `GUIDE.md` | how to use it, with examples | somebody building an application |",
		"| `SKILL.md` | what may not change, and what to run before finishing | somebody changing the package |",
		"",
		"A repository-wide rule lives in [`skills/`](./skills) instead, identically for all",
		"nineteen packages. A rule true of one package only lives in that package's",
		"`SKILL.md`.",
		"",
	);

	L.push("## Skills for your coding agent", "");
	L.push(
		"Every package ships a skill: what it is for, the shapes to write, and the",
		"refusals — the things that look like a missing feature and are the feature. Two",
		"ways to install one, and they are not equivalent:",
		"",
		"```bash",
		"# Claude Code, from this repository",
		`/plugin marketplace add ${ORIGIN.marketplace}`,
		"/plugin install lanka-storage@lankajs",
		"",
		"# or from the packages you already installed — the skill for THAT version",
		"npx lanka-skills sync",
		"```",
		"",
		"Prefer the second where it works. A skill installed from git describes the main",
		"branch; a skill installed from your `node_modules` describes the code you are",
		"actually running.",
		"",
		"Start with `lanka-packages`, which routes to the rest by problem.",
		"",
	);

	L.push("## Generated files", "");
	L.push(
		"Package manifests, tsconfigs, READMEs and `llms.txt` are generated from",
		"[`scripts/registry.mjs`](./scripts/registry.mjs). Edit the registry, never the",
		"output — `pnpm check:drift` fails when the two disagree.",
		"",
	);

	w("README.md", L.join("\n"));
}

// ── run ─────────────────────────────────────────────────────────────────────

for (const p of PACKAGES) {
	manifest(p);
	tsconfig(p);
	tsupConfig(p);
	readme(p);
	placeholder(p);
	license(p);
}
rootReadme();
// The repository addressed to a model: an index of flat markdown at stable paths.
generateLlmsIndex();

const skills = generateSkillPackaging();
if (skills.missingGuides.length > 0) {
	console.error(
		`no GUIDE.md to package as a skill reference:\n  ${skills.missingGuides.join("\n  ")}`,
	);
	process.exit(1);
}

console.log(
	`generated for ${PACKAGES.length} packages + root README, and ${skills.packages} consumer skills`,
);
