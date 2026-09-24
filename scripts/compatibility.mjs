/**
 * Generates `COMPATIBILITY.md` — which package runs where, with what, and under
 * which constraints.
 *
 * ## Derived, not described
 *
 * "Does this work in Node?", "does this need React?", "can two micro-frontends
 * both load it?" are questions a consumer asks before installing, and forty
 * packages answered them in forty different places. Every per-package fact in
 * the document is READ here rather than written: where a package runs from the
 * registry (which `check-runtime.mjs` holds to the sources), its UI framework
 * and peers from the registry, its relation to `lanka` and its client boundary
 * from the generated manifest and the entry files, and whether it touches the
 * page's global object from its sources. A table written by hand would be a
 * second truth free to drift; this one cannot, because `check:drift` regenerates
 * it and fails on a difference.
 *
 * The cross-cutting rules — server rendering, bundlers, instances — are one line
 * each with a link to the document that owns and argues them. This file indexes
 * them; it does not restate them.
 *
 * Run: node scripts/scaffold.mjs (this is called from there)
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PACKAGES, pkgDir, pkgName } from "./registry.mjs";
import { CLIENT_DIRECTIVE, FRAMEWORK_PACKAGES } from "./check-runtime.mjs";

const ROOT = process.cwd();

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const manifestOf = (p) => JSON.parse(read(`${pkgDir(p)}/package.json`));

/** The three environments, in the order the table shows them. */
const ENVIRONMENTS = [
	{ id: "browser", label: "Browser" },
	{ id: "node", label: "Node" },
	{ id: "native", label: "React Native" },
];

const FRAMEWORK_LABELS = {
	react: "React",
	vue: "Vue",
	svelte: "Svelte",
	solid: "Solid",
	angular: "Angular",
};

/** Subpaths whose environments differ from their package's. */
export const entriesThatDiffer = (p) =>
	(p.entries ?? [])
		.filter((entry) => typeof entry === "object" && entry.runtime)
		.map((entry) => ({ subpath: `./${entry.name}`, runtimes: entry.runtime }));

/**
 * How a package reaches `lanka`: IS it, takes it as a peer, depends on it, or
 * never loads it. Read from the generated manifest, which is what npm installs.
 */
export const lankaRelation = (p) => {
	if (p.kind === "core") return "is lanka";
	const manifest = manifestOf(p);
	if (manifest.peerDependencies?.lanka) return "peer";
	if (manifest.dependencies?.lanka) return "dependency";
	return "none";
};

/** The UI framework a package binds, with the range it declares, or null. */
export const frameworkOf = (p) => {
	if (!p.framework) return null;
	const names = FRAMEWORK_PACKAGES[p.framework].map((pkg) => pkg.name);
	const peer = Object.entries(p.peer ?? {}).find(
		([name]) => names.includes(name) || names.some((prefix) => name.startsWith(`${prefix}/`)),
	);
	return { label: FRAMEWORK_LABELS[p.framework], peer: peer ? `${peer[0]} ${peer[1]}` : "" };
};

/** Third-party packages a consumer installs beside this one, required and optional. */
export const peersOf = (p) => {
	const optional = new Set(p.peerOptional ?? []);
	const all = Object.entries(p.peer ?? {});
	return {
		required: all
			.filter(([name]) => !optional.has(name))
			.map(([name, range]) => `${name} ${range}`),
		optional: all
			.filter(([name]) => optional.has(name))
			.map(([name, range]) => `${name} ${range}`),
	};
};

/** Subpaths that carry `"use client"`, read from the entry files themselves. */
export const clientEntries = (p) => {
	const exports = manifestOf(p).exports ?? {};
	return Object.entries(exports)
		.filter(([, file]) =>
			read(`${pkgDir(p)}/${file.replace(/^\.\//, "")}`)
				.trimStart()
				.startsWith(CLIENT_DIRECTIVE),
		)
		.map(([subpath]) => subpath);
};

const sourceFiles = (dir) =>
	// Sorted: `readdirSync` promises no order and ext4 keeps none — `listed` in
	// llms.mjs records the CI drift that taught it.
	readdirSync(join(ROOT, dir), { withFileTypes: true })
		.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
		.flatMap((entry) => {
			const rel = `${dir}/${entry.name}`;
			if (entry.isDirectory()) return sourceFiles(rel);
			return /\.tsx?$/.test(entry.name) && !/\.(test|bench)\.tsx?$/.test(entry.name)
				? [rel]
				: [];
		});

/**
 * Source files that write to the page's global object.
 *
 * What matters on a page with two applications, or two copies of lanka: state
 * kept there is shared by everything on the page, where state kept in a module
 * belongs to one copy. Matched on the cast every such file makes to index the
 * global object.
 */
export const pageGlobalsOf = (p) =>
	sourceFiles(`${pkgDir(p)}/src`).filter((file) =>
		/globalThis as (?:unknown as )?Record</.test(read(file)),
	);

const tick = (on) => (on ? "✓" : "—");

const link = (p) => `[\`${pkgName(p)}\`](./${pkgDir(p)}/GUIDE.md)`;

const kindOf = (p) => (p.family ? `${p.kind} · ${p.family}${p.hub ? " (hub)" : ""}` : p.kind);

const notesOf = (p) => {
	const notes = [];
	for (const { subpath, runtimes } of entriesThatDiffer(p)) {
		notes.push(`\`${subpath}\`: ${runtimes.join(", ")} only`);
	}
	for (const subpath of clientEntries(p)) notes.push(`\`"use client"\` on \`${subpath}\``);
	for (const file of pageGlobalsOf(p)) {
		notes.push(`page global: [${file.split("/").pop()}](./${file})`);
	}
	return notes.join("; ");
};

const installsOf = (p) => {
	const { required, optional } = peersOf(p);
	const cells = [...required.map((peer) => `\`${peer}\``)];
	if (optional.length > 0)
		cells.push(`optional: ${optional.map((peer) => `\`${peer}\``).join(", ")}`);
	return cells.join(", ") || "—";
};

const tableRow = (p) => {
	const framework = frameworkOf(p);
	return [
		link(p),
		kindOf(p),
		...ENVIRONMENTS.map(({ id }) => tick((p.runtime ?? []).includes(id))),
		framework ? framework.label : "none",
		installsOf(p),
		lankaRelation(p),
		notesOf(p) || "—",
	];
};

const row = (cells) => `| ${cells.join(" | ")} |`;

const names = (packages) => packages.map((p) => `\`${pkgName(p)}\``).join(", ") || "—";

/** `1 runs`, `8 run`: the verb agrees with the count it follows. */
const count = (n, one, many) => `${String(n)} ${n === 1 ? one : many}`;

/** How a combination of environments reads in a sentence. */
const labelOf = (ids) => {
	if (ids.length === ENVIRONMENTS.length) return "everywhere — browser, Node and React Native";
	const labels = ids.map((id) => ENVIRONMENTS.find((env) => env.id === id).label);
	return ids.length === 1 ? `in ${labels[0]} only` : `in ${labels.join(" and ")}`;
};

/**
 * Packages grouped by the combination of environments they declare — the
 * combinations that EXIST, broadest first, rather than a list written once and
 * silent about the next combination somebody declares.
 */
export const runtimeGroups = () => {
	const groups = new Map();

	for (const p of PACKAGES) {
		const ids = ENVIRONMENTS.map((env) => env.id).filter((id) =>
			(p.runtime ?? []).includes(id),
		);
		const key = ids.join("+");
		if (!groups.has(key)) groups.set(key, { ids, label: labelOf(ids), packages: [] });
		groups.get(key).packages.push(p);
	}

	return [...groups.values()].sort(
		(a, b) =>
			b.ids.length - a.ids.length ||
			ENVIRONMENTS.findIndex((env) => env.id === a.ids[0]) -
				ENVIRONMENTS.findIndex((env) => env.id === b.ids[0]),
	);
};

/** The whole document, as a string. */
export const renderCompatibility = () => {
	const L = [];
	const bindings = PACKAGES.filter((p) => p.framework);
	const loadsLanka = PACKAGES.filter((p) => lankaRelation(p) !== "none");
	const plugins = PACKAGES.filter((p) => p.kind === "plugin");
	const withPageGlobals = PACKAGES.filter((p) => pageGlobalsOf(p).length > 0);
	const di = PACKAGES.find((p) => p.slug === "di" && p.kind === "tool");
	const adapters = (di?.entries ?? [])
		.map((entry) => (typeof entry === "string" ? entry : entry.name))
		.filter((name) => name !== "cli");

	L.push(
		"<!-- Generated by scripts/compatibility.mjs from scripts/registry.mjs, the package",
		"     manifests and their sources. Edit those, then run node scripts/scaffold.mjs. -->",
		"",
		"# Compatibility",
		"",
		`Which of lanka's ${String(PACKAGES.length)} packages runs where, with which UI framework, what you install`,
		"beside it, and what holds when a page carries several applications or several copies of the",
		"framework.",
		"",
		"Every per-package fact below is derived, not written: where a package runs comes from the",
		"registry, which `scripts/check-runtime.mjs` holds to the sources; the UI framework and peers from",
		"the registry; the relation to `lanka` and the client boundary from the published manifest and",
		"the entry files; the page globals from the sources. `check:drift` regenerates this file and",
		"fails if it differs, so it cannot describe a package that no longer exists.",
		"",
	);

	L.push("## At a glance", "");
	L.push(
		...runtimeGroups().map(
			({ label, packages }) => `- **${count(packages.length, "runs", "run")}** ${label}.`,
		),
		`- **${String(PACKAGES.length - bindings.length)} need no UI framework.** The other ${String(bindings.length)} are the bindings, one per framework.`,
		`- **${String(loadsLanka.length)} load \`lanka\`** and therefore need the \`@lanka_di\` alias your bundler provides; the rest stand alone.`,
		"",
	);

	L.push("## Every package", "");
	L.push(
		"`lanka` column: how the package reaches the framework — `peer` is installed once by you and shared,",
		"`dependency` comes with the package, `none` never loads it. Notes list entries whose environments",
		"differ from their package's, entries behind `\"use client\"`, and files that write to the page's",
		"global object.",
		"",
	);
	L.push(
		row([
			"Package",
			"Kind",
			...ENVIRONMENTS.map(({ label }) => label),
			"UI framework",
			"You also install",
			"`lanka`",
			"Notes",
		]),
		row(["---", "---", ...ENVIRONMENTS.map(() => ":---:"), "---", "---", "---", "---"]),
		...PACKAGES.map((p) => row(tableRow(p))),
		"",
	);

	L.push("## Where each package runs", "");
	L.push(
		...runtimeGroups().map(({ label, packages }) => {
			const tools = packages.every((p) => p.kind === "tool");
			const aside = tools
				? " — they run at build, lint or test time and are never bundled into an application"
				: "";
			return `- **${label[0].toUpperCase()}${label.slice(1)}:** ${names(packages)}${aside}.`;
		}),
		"",
	);
	const differing = PACKAGES.flatMap((p) =>
		entriesThatDiffer(p).map(
			({ subpath, runtimes }) =>
				`\`${pkgName(p)}${subpath.slice(1)}\` (${runtimes.join(", ")})`,
		),
	);
	if (differing.length > 0) {
		L.push(
			`A package can be two halves, and then the SUBPATH is what you pick: ${differing.join(", ")}. What`,
			"`check-runtime` reads is each entry's own import graph; a guarded global (`typeof EventSource`) is a",
			"capability, not a requirement. The rules: [`skills/hosts/SKILL.md`](./skills/hosts/SKILL.md) §1–3.",
			"",
		);
	}

	L.push("## UI frameworks and bindings", "");
	L.push(
		`Core imports no UI library. A screen reads a ViewModel through the binding for its framework, and`,
		"nothing else depends on one:",
		"",
		row(["Binding", "Framework", "Runs in", "Client boundary", "Testing entry needs"]),
		row(["---", "---", "---", "---", "---"]),
		...bindings.map((p) => {
			const framework = frameworkOf(p);
			return row([
				link(p),
				`${framework.label} (\`${framework.peer}\`)`,
				(p.runtime ?? [])
					.map((id) => ENVIRONMENTS.find((e) => e.id === id).label)
					.join(", "),
				clientEntries(p)
					.map((subpath) => `\`"use client"\` on \`${subpath}\``)
					.join(", ") || "—",
				peersOf(p)
					.optional.map((peer) => `\`${peer}\``)
					.join(", ") || "—",
			]);
		}),
		"",
		"- **Install one binding per framework you render.** Several on one page are supported —",
		'  [ARCHITECTURE.md, "Several frameworks in one application"](./ARCHITECTURE.md#several-frameworks-in-one-application).',
		"- **React Native** is served by the React binding; the React-Native-only packages are storage engines.",
		'- **Only the React binding draws a client boundary.** `"use client"` is how React Server Components',
		"  ask a library which modules may run in the browser; no other framework's host asks it of a module.",
		"",
	);

	L.push("## Server rendering", "");
	L.push(
		`- **Keep out of server-only code** — a loader, a route handler, a server component — every package not declared for Node: ${names(PACKAGES.filter((p) => !(p.runtime ?? []).includes("node") && p.kind !== "tool"))}. A declaration is what an entry may touch, and these may touch the DOM or a device.`,
		"- **The bindings are declared for Node** because every host that renders a component on the server",
		"  runs them there — the HOST playgrounds do, and `check-playgrounds` holds each binding's declaration",
		'  to them. A React Server Component still may not import one: that is what `"use client"` is for,',
		"  and what a binding may do inside a server render is [`skills/hosts/SKILL.md`](./skills/hosts/SKILL.md) §5.",
		"- **One framework instance per request.** On a server the process is shared by every user; the",
		"  request scope comes from [`@lankajs/host`](./modules/host/GUIDE.md)'s `/server` entry, and core fails",
		"  loudly on a call made outside it rather than hand over the last request's instance.",
		"- **Gateways travel to the server; ViewModels stay in the client** unless resolved per scope with",
		"  `resolveLankaVM` — a module-level ViewModel is one per PROCESS on a server.",
		'  [ARCHITECTURE.md, "Inside another framework"](./ARCHITECTURE.md#inside-another-framework).',
		"",
	);

	L.push("## Bundlers", "");
	L.push(
		`- **Every package that loads \`lanka\` needs the \`@lanka_di\` alias** — ${String(loadsLanka.length)} of ${String(PACKAGES.length)}. The framework reads your`,
		"  application's barrels through it, and a published package leaves the specifier for your bundler",
		"  to answer.",
		`- **[\`@lankajs/tool-di\`](./tools/di/GUIDE.md) wires it** with an adapter for ${adapters.map((name) => `\`${name}\``).join(", ")} —`,
		"  React Native takes `metro` — and any other bundler with the three lines of `lankaDiSetup`:",
		'  [`tools/di/GUIDE.md`, "Any other bundler"](./tools/di/GUIDE.md#any-other-bundler).',
		"- **Separately built modules** — micro-frontends, two teams' pipelines — keep `lanka` external in",
		"  every build and let the page provide one copy. Proved with Vite, webpack and Rspack side by",
		"  side in [`_playgrounds/micro-frontends`](./_playgrounds/micro-frontends), where Rspack is",
		"  wired by tool-di's webpack adapter unchanged.",
		"",
	);

	L.push("## Instances, copies and micro-frontends", "");
	L.push(
		`- **Plugins install per instance** with \`lanka.use(...)\`: ${names(plugins)}. Two instances each carry`,
		"  their own; one instance refuses the same plugin twice.",
		"- **Ambient calls reach ONE active instance** — `lankaGateways.*`, a scenario's `trigger`. Two",
		"  instances of one copy share that pointer; two copies each have their own.",
		"- **One copy of `lanka` on the page shares everything** — bus, scenarios, stores, ViewModels. Two",
		"  copies share nothing, warn in development, and are joined only by",
		"  [`@lankajs/plugin-relay`](./plugins/relay/GUIDE.md), on a browser page — and, with its",
		"  `transport`, across tabs, iframes and workers.",
		"- **A module that leaves the page takes its ViewModels with it** when it resolves them in a scope:",
		'  [`core/GUIDE.md`, "Scopes"](./core/GUIDE.md#scopes).',
		`- **Page-wide state** — files that write to the page's global object, shared by every application and`,
		`  every copy on the page: ${withPageGlobals
			.map(
				(p) =>
					`${link(p)} (${pageGlobalsOf(p)
						.map((file) => `[${file.split("/").pop()}](./${file})`)
						.join(", ")})`,
			)
			.join(", ")}. Everything else keeps its state in the`,
		"  instance or the module that holds it.",
		"",
	);

	L.push("## Families: pick one", "");
	const families = [...new Set(PACKAGES.map((p) => p.family).filter(Boolean))];
	for (const family of families) {
		const members = PACKAGES.filter((p) => p.family === family);
		L.push(
			`- **${family}** — ${members.map((p) => `\`${pkgName(p)}\`${p.hub ? " (hub)" : ""}`).join(", ")}.`,
		);
	}
	L.push(
		"",
		"Members of one family bind one port and pass one conformance suite, so an application installs",
		"the one that matches its library — one validator, one query cache, one storage engine per device —",
		"and one binding per UI framework it renders.",
		"",
	);

	return L.join("\n");
};

/** Writes the document. Called by the scaffolder, like every other generated file. */
export const generateCompatibility = () => {
	writeFileSync(join(ROOT, "COMPATIBILITY.md"), renderCompatibility(), "utf8");
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	generateCompatibility();
	console.log("COMPATIBILITY.md written");
}
