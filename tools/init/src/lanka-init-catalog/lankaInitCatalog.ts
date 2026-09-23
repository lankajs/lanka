import type { ILankaInitAnswer } from "../_interfaces/ILankaInitAnswer";
import type { ILankaInitTemplate } from "../_interfaces/ILankaInitTemplate";

/**
 * Everywhere, for an answer that constrains nothing.
 *
 * A dev tool has no runtime in the sense a module does — `@lankajs/tool-eslint`
 * does not run in the application at all — so it is offered to every template.
 * Saying that with the same three words the framework uses keeps one vocabulary
 * rather than inventing a fourth value meaning "not applicable".
 */
const ANYWHERE = ["browser", "node", "native"] as const;

/**
 * Frozen all the way down.
 *
 * `Object.freeze` is SHALLOW and `as const` is erased at build, so the outer call
 * alone would leave every `packages` array a global that anybody importing this
 * package can push to — and the plan, the install and the printed list would all
 * quietly obey on their next run. `lankaDiContract` learned this the expensive
 * way and its header says so; this is the same lesson applied before it costs
 * anything. The spec asserts that a nested array is frozen.
 */
const frozen = <T>(value: T): T => {
	if (Array.isArray(value)) for (const one of value as unknown[]) frozen(one);
	else if (typeof value === "object" && value !== null) {
		for (const one of Object.values(value)) frozen(one);
	}

	return Object.freeze(value);
};

/**
 * Every project shape this command knows how to wire.
 *
 * Eleven rows, and what they differ in is the BUILD: which bundler adapter
 * `@lankajs/tool-di` publishes for them, which config file it goes in, and which
 * screen file the binding gets. Everything above that — the gateway, the
 * ViewModel, the scenario, the host — is the same five files whichever row this
 * is, which is why a twelfth template is an entry here rather than an edit
 * inside four functions.
 */
const TEMPLATES: readonly ILankaInitTemplate[] = [
	{
		id: "react-spa",
		title: "React, built by Vite",
		gist: "A single-page application: one bundle, one browser, no server rendering.",
		runtime: ["browser"],
		framework: "react",
		build: "vite",
		vitePlugin: { importLine: 'import react from "@vitejs/plugin-react";', call: "react()" },
		packages: ["@lankajs/react", "react", "react-dom"],
		devPackages: ["vite", "@vitejs/plugin-react"],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "none",
			extras: ["eslint", "testing", "devtools"],
		},
		notes: [
			"The vite plugin is not optional: the framework imports `@lanka_di/Gateways` at module level, and a build without the alias fails on the first of them.",
		],
	},
	{
		id: "vue-spa",
		title: "Vue, built by Vite",
		gist: "A single-page application in single-file components.",
		runtime: ["browser"],
		framework: "vue",
		build: "vite",
		vitePlugin: { importLine: 'import vue from "@vitejs/plugin-vue";', call: "vue()" },
		packages: ["@lankajs/vue", "vue"],
		devPackages: ["vite", "@vitejs/plugin-vue"],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "none",
			extras: ["eslint", "testing", "devtools"],
		},
		notes: ["`useLankaVM` answers a `ShallowRef`, which is Vue's own idea of reactivity."],
	},
	{
		id: "svelte-spa",
		title: "Svelte, built by Vite",
		gist: "A single-page application in compiled components, read with runes.",
		runtime: ["browser"],
		framework: "svelte",
		build: "vite",
		vitePlugin: {
			importLine: 'import { svelte } from "@sveltejs/vite-plugin-svelte";',
			call: "svelte()",
		},
		packages: ["@lankajs/svelte", "svelte"],
		devPackages: ["vite", "@sveltejs/vite-plugin-svelte"],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "none",
			extras: ["eslint", "testing", "devtools"],
		},
		notes: [
			"`useLankaVM` answers an object whose properties are getters, which is what a rune reads.",
		],
	},
	{
		id: "solid-spa",
		title: "Solid, built by Vite",
		gist: "A single-page application in compiled JSX, with fine-grained reactivity.",
		runtime: ["browser"],
		framework: "solid",
		build: "vite",
		vitePlugin: { importLine: 'import solid from "vite-plugin-solid";', call: "solid()" },
		packages: ["@lankajs/solid", "solid-js"],
		devPackages: ["vite", "vite-plugin-solid"],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "none",
			extras: ["eslint", "testing", "devtools"],
		},
		notes: ["`useLankaVM` answers an `Accessor`, so a screen reads `state().todos`."],
	},
	{
		id: "angular-spa",
		title: "Angular, built by Vite",
		gist: "A zoneless application whose change detection reads signals.",
		runtime: ["browser"],
		framework: "angular",
		build: "vite",
		vitePlugin: {
			importLine: 'import angular from "@analogjs/vite-plugin-angular";',
			call: "angular()",
		},
		packages: ["@lankajs/angular", "@angular/core", "@angular/common", "rxjs"],
		devPackages: ["vite", "@analogjs/vite-plugin-angular"],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "none",
			extras: ["eslint", "testing"],
		},
		notes: [
			"Vite and not the Angular CLI: the alias is installed by a Vite plugin, and the CLI's own pipeline would need a different one.",
			"`useLankaVM` answers a `Signal`, which is exactly what zoneless change detection reads.",
		],
	},
	{
		id: "next-app",
		title: "Next, App Router",
		gist: "Server rendering and client components, with one framework instance per request.",
		runtime: ["browser", "node"],
		framework: "react",
		build: "next",
		packages: ["@lankajs/react", "@lankajs/host", "next", "react", "react-dom"],
		devPackages: [],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "none",
			extras: ["eslint", "testing"],
		},
		notes: [
			"Both bundlers are wired, because Next uses two: turbopack runs `next dev` and webpack may still run the production build. A project that wired one has an alias in development and none in CI.",
			"`startLanka` is the BROWSER half. Anything rendered on the server runs inside `runLankaRequest` from `@lankajs/host`, or one process serves every user from one instance.",
		],
	},
	{
		id: "nuxt-app",
		title: "Nuxt",
		gist: "Nitro on the server, Vue in the browser, one framework instance per request.",
		runtime: ["browser", "node"],
		framework: "vue",
		build: "nuxt",
		packages: ["@lankajs/vue", "@lankajs/host", "vue"],
		devPackages: ["nuxt"],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "none",
			extras: ["eslint", "testing"],
		},
		notes: [
			"The plugin goes in `vite.plugins`, because Nuxt's build IS Vite — the same plugin the single-page application uses.",
			"`startLanka` is the browser half; a server route runs inside `runLankaRequest` from `@lankajs/host`.",
		],
	},
	{
		id: "sveltekit-app",
		title: "SvelteKit",
		gist: "A load per request, Svelte in the browser, one framework instance per request.",
		runtime: ["browser", "node"],
		framework: "svelte",
		build: "sveltekit",
		vitePlugin: {
			importLine: 'import { sveltekit } from "@sveltejs/kit/vite";',
			call: "sveltekit()",
		},
		packages: ["@lankajs/svelte", "@lankajs/host", "svelte"],
		devPackages: ["@sveltejs/kit", "@sveltejs/vite-plugin-svelte", "vite"],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "none",
			extras: ["eslint", "testing"],
		},
		notes: [
			"The alias plugin sits BESIDE Kit's own: a server build without it fails exactly as a browser build does.",
			"A `load` runs inside `runLankaRequest` from `@lankajs/host`.",
		],
	},
	{
		id: "expo-native",
		title: "Expo, on a device",
		gist: "React Native through Metro, where there is no DOM and no plugin array.",
		runtime: ["native"],
		framework: "react",
		build: "metro",
		packages: ["@lankajs/react", "react", "react-native", "expo"],
		devPackages: [],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "mmkv",
			extras: ["eslint", "testing"],
		},
		notes: [
			"Metro has no plugin array, so the integration is a FUNCTION of the config rather than an entry in one.",
			"Storage is a real choice here rather than an extra: a device has no `localStorage`, so an adapter is the only way to remember anything.",
		],
	},
	{
		id: "vanilla-spa",
		title: "No UI framework at all",
		gist: "The browser, `document` and nothing else: a ViewModel read through `subscribe`.",
		runtime: ["browser"],
		framework: null,
		build: "vite",
		packages: [],
		devPackages: ["vite"],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "none",
			extras: ["eslint", "testing"],
		},
		notes: [
			"No binding package: a ViewModel is a store, and `getState()` plus `subscribe()` is the whole of reading one.",
		],
	},
	{
		id: "node-service",
		title: "No screen at all",
		gist: "A service, a worker or a queue consumer: node, no DOM, no renderer.",
		runtime: ["node"],
		framework: null,
		build: "none",
		packages: [],
		devPackages: ["tsx"],
		defaults: {
			validator: "zod",
			transport: "http",
			storage: "none",
			extras: ["eslint", "testing"],
		},
		notes: [
			"No bundler, so nothing scaffolds the barrels on a build and nothing installs the alias: the `paths` mapping in `tsconfig.json` is what resolves them, and `tsx` reads it.",
			"Work done FOR A CALLER belongs inside `runLankaRequest` from `@lankajs/host`. One instance per process is right for what the process owns and wrong for what a request owns.",
		],
	},
];

/** One schema library, or none. All of them bind one port: `ILankaValidator`. */
const VALIDATORS: readonly ILankaInitAnswer[] = [
	{
		id: "none",
		title: "None",
		gist: "A response is trusted as it arrives. Add one the day a server surprises you.",
		packages: [],
		devPackages: [],
		runtime: ANYWHERE,
	},
	{
		id: "zod",
		title: "zod",
		gist: "The one most projects already have, and the default here for that reason.",
		packages: ["@lankajs/zod", "zod"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/validators/zod/GUIDE.md",
	},
	{
		id: "valibot",
		title: "valibot",
		gist: "The same job at a fraction of the bundle, if the bundle is what you count.",
		packages: ["@lankajs/valibot", "valibot"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/validators/valibot/GUIDE.md",
	},
	{
		id: "arktype",
		title: "arktype",
		gist: "Schemas written as types, for a team that thinks in TypeScript's own syntax.",
		packages: ["@lankajs/arktype", "arktype"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/validators/arktype/GUIDE.md",
	},
	{
		id: "yup",
		title: "yup",
		gist: "For an application that already has yup schemas and is not rewriting them.",
		packages: ["@lankajs/yup", "yup"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/validators/yup/GUIDE.md",
	},
	{
		id: "typebox",
		title: "TypeBox",
		gist: "JSON Schema as the source, when the same schema has to reach a server too.",
		packages: ["@lankajs/typebox", "typebox"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/validators/typebox/GUIDE.md",
	},
	{
		id: "effect",
		title: "Effect Schema",
		gist: "For a codebase already on Effect, whose schemas are there anyway.",
		packages: ["@lankajs/effect", "effect"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/validators/effect/GUIDE.md",
	},
];

/** What the requests are made of, and the policy wrapped around them. */
const TRANSPORTS: readonly ILankaInitAnswer[] = [
	{
		id: "none",
		title: "None",
		gist: "`fetch` with no policy over it. Retry, refresh and idempotency are yours.",
		packages: [],
		devPackages: [],
		runtime: ANYWHERE,
	},
	{
		id: "http",
		title: "REST over HTTP",
		gist: "Retry, auth refresh, the CSRF header and idempotency keys, as middleware.",
		packages: ["@lankajs/plugin-http"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "plugins/http/GUIDE.md",
	},
	{
		id: "graphql",
		title: "GraphQL",
		gist: "A 200 carrying an `errors` array becomes a domain failure instead of a success.",
		packages: ["@lankajs/plugin-graphql"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "plugins/graphql/GUIDE.md",
	},
	{
		id: "grpc",
		title: "gRPC-Web",
		gist: "A status in a trailer, read as the same failure every other call raises.",
		packages: ["@lankajs/plugin-grpc"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "plugins/grpc/GUIDE.md",
	},
];

/** What survives a reload, and the engine it survives in. */
const STORAGES: readonly ILankaInitAnswer[] = [
	{
		id: "none",
		title: "None",
		gist: "Nothing is remembered between visits.",
		packages: [],
		devPackages: [],
		runtime: ANYWHERE,
	},
	{
		id: "web",
		title: "Browser storage, with encryption",
		gist: "`localStorage` and the cache behind one port, plus a WebCrypto-encrypted twin.",
		packages: ["@lankajs/storage"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/storage/GUIDE.md",
	},
	{
		id: "unstorage",
		title: "unstorage",
		gist: "Twenty drivers behind the port: a file, Redis, a KV namespace, a browser.",
		packages: ["@lankajs/unstorage", "unstorage"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/storage-adapters/unstorage/GUIDE.md",
	},
	{
		id: "mmkv",
		title: "MMKV",
		gist: "The fast synchronous one on a device, and what a device usually wants.",
		packages: ["@lankajs/mmkv", "react-native-mmkv"],
		devPackages: [],
		runtime: ["native"],
		guide: "modules/storage-adapters/mmkv/GUIDE.md",
	},
	{
		id: "async-storage",
		title: "AsyncStorage",
		gist: "React Native's own, for a project that already has it.",
		packages: [
			"@lankajs/react-native-async-storage",
			"@react-native-async-storage/async-storage",
		],
		devPackages: [],
		runtime: ["native"],
		guide: "modules/storage-adapters/react-native-async-storage/GUIDE.md",
	},
	{
		id: "secure-store",
		title: "Expo SecureStore",
		gist: "The keychain, for the few values that belong in one.",
		packages: ["@lankajs/secure-store", "expo-secure-store"],
		devPackages: [],
		runtime: ["native"],
		guide: "modules/storage-adapters/secure-store/GUIDE.md",
	},
];

/**
 * Everything else, taken any number at a time.
 *
 * In the order a project usually wants them: the two that pay for themselves on
 * the first day, then what a screen needs, then what a server-rendered or
 * offline application needs.
 */
const EXTRAS: readonly ILankaInitAnswer[] = [
	{
		id: "eslint",
		title: "The boundary rules",
		gist: "Imports go one way, checked rather than agreed. Writes `eslint.config.mjs`.",
		packages: [],
		devPackages: ["@lankajs/tool-eslint", "eslint"],
		runtime: ANYWHERE,
		guide: "tools/eslint/GUIDE.md",
	},
	{
		id: "testing",
		title: "The test kit",
		gist: "A host, a fake transport and a reset between tests. Writes `vitest.config.ts`.",
		packages: [],
		devPackages: ["@lankajs/tool-testing", "vitest"],
		runtime: ANYWHERE,
		guide: "tools/testing/GUIDE.md",
	},
	{
		id: "skills",
		title: "Agent skills",
		gist: "`lanka-skills sync` copies each installed package's skill into the project.",
		packages: [],
		devPackages: ["@lankajs/tool-skills"],
		runtime: ANYWHERE,
		guide: "tools/skills/GUIDE.md",
	},
	{
		id: "devtools",
		title: "The inspector",
		gist: "What crossed the bus, what was on the wire, and what stopped an event.",
		packages: ["@lankajs/plugin-devtools"],
		devPackages: [],
		runtime: ["browser"],
		guide: "plugins/devtools/GUIDE.md",
	},
	{
		id: "prefetch",
		title: "Prefetch",
		gist: "A chunk and its data warmed before the click, and never during a request.",
		packages: ["@lankajs/plugin-prefetch"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "plugins/prefetch/GUIDE.md",
	},
	{
		id: "sse",
		title: "Server-sent events",
		gist: "A stream that reconnects, and a scenario triggered by what arrives on it.",
		packages: ["@lankajs/plugin-sse"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "plugins/sse/GUIDE.md",
	},
	{
		id: "websocket",
		title: "WebSocket",
		gist: "The same, both ways, with the backoff and the resubscription written.",
		packages: ["@lankajs/plugin-websocket"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "plugins/websocket/GUIDE.md",
	},
	{
		id: "bootstrap-steps",
		title: "Start-up steps",
		gist: "A start-up that is a pipeline with a decision at the end, not a script.",
		packages: ["@lankajs/plugin-bootstrap-steps"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "plugins/bootstrap-steps/GUIDE.md",
	},
	{
		id: "async",
		title: "Async primitives",
		gist: "Which response may be trusted, and how many requests a burst really sends.",
		packages: ["@lankajs/async"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/async/GUIDE.md",
	},
	{
		id: "collection",
		title: "Collections",
		gist: "Filter, sort and page one list, answering the SAME array when nothing moved.",
		packages: ["@lankajs/collection"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/collection/GUIDE.md",
	},
	{
		id: "optimistic",
		title: "Optimistic actions",
		gist: "A change shown before the server agrees, and rolled back when it does not.",
		packages: ["@lankajs/optimistic"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/optimistic/GUIDE.md",
	},
	{
		id: "browser",
		title: "Browser facts",
		gist: "Online, visibility, the viewport and the back button, as things to subscribe to.",
		packages: ["@lankajs/browser"],
		devPackages: [],
		runtime: ["browser"],
		guide: "modules/browser/GUIDE.md",
	},
	{
		id: "blob-cache",
		title: "Blob cache",
		gist: "Images and files kept across reloads, with the object URLs revoked for you.",
		packages: ["@lankajs/blob-cache"],
		devPackages: [],
		runtime: ["browser"],
		guide: "modules/blob-cache/GUIDE.md",
	},
	{
		id: "host",
		title: "Living inside a host framework",
		gist: "An instance per unit of server work, and server data as a ViewModel's first state.",
		packages: ["@lankajs/host"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/host/GUIDE.md",
	},
	{
		id: "tanstack-query",
		title: "TanStack Query as the read cache",
		gist: "For a project whose cache is already TanStack Query, behind the framework's port.",
		packages: ["@lankajs/tanstack-query", "@tanstack/query-core"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/query/tanstack/GUIDE.md",
	},
	{
		id: "nanostores-query",
		title: "Nanostores Query as the read cache",
		gist: "The same port over the smaller one.",
		packages: ["@lankajs/nanostores-query", "@nanostores/query", "nanostores"],
		devPackages: [],
		runtime: ANYWHERE,
		guide: "modules/query/nanostores/GUIDE.md",
	},
];

/**
 * Every question this command asks, and every answer it accepts.
 *
 * ONE frozen object rather than five exported tables, and the argument is
 * `lankaDiContract`'s: the parts mean something only together. A sixth axis is
 * then a key on an object that is already published — additive, and invisible in
 * the facade's list of names — where a sixth table would be a facade name that
 * can never be removed, and a fifth import line for a consumer who only asked
 * what this tool offers.
 *
 * The cost, stated because `skills/forms/SKILL.md` states it: a frozen object is
 * ONE binding, so taking `templates` retains the whole catalog. In a node command
 * that is worth nothing to anybody, which is exactly when it is the right shape.
 *
 * **The CONTENT is a promise too, not only the shape.** An entry may be added,
 * and may be superseded by a better one beside it; an `id` is never removed,
 * because somewhere a script types it. `tools/init/SKILL.md` carries that rule.
 */
export const lankaInitCatalog = frozen({
	templates: TEMPLATES,
	validators: VALIDATORS,
	transports: TRANSPORTS,
	storages: STORAGES,
	extras: EXTRAS,
});
