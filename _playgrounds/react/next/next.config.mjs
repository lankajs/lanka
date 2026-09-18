/*
 * Imported from BUILT OUTPUT, by path, and only inside this repository.
 *
 * A consumer writes `@lankajs/tool-di/turbopack` and installs a package whose
 * `exports` already point at `dist`. Here the workspace link points at
 * TypeScript SOURCE, and this file is loaded by node — which will not compile
 * TypeScript and wants a file extension on every relative import. The built
 * output is the same module a consumer gets.
 *
 * The consequence is a prerequisite rather than a surprise: `pnpm build` before
 * `next dev`, which `playgrounds/README.md` says out loud.
 */
import { lankaDiTurbopack } from "../../../tools/di/dist/turbopack.js";
import { lankaDiWebpack } from "../../../tools/di/dist/webpack.js";

const scaffold = !process.env.CI;

/**
 * Both halves, in one file, because Next uses two bundlers.
 *
 * Turbopack runs `next dev` and webpack may still run the production build, so a
 * project that wired only one has an alias in development and none in CI — which
 * fails as "module not found" for `@lanka_di/Gateways` at the least convenient
 * moment.
 *
 * `transpilePackages` is the other half of living in a monorepo: the framework
 * and the application are resolved from SOURCE here, and Next does not compile
 * TypeScript inside `node_modules` unless it is told which packages to compile.
 * A published consumer needs none of this — they install built output.
 *
 * @type {import("next").NextConfig}
 */
export default {
	turbopack: { ...lankaDiTurbopack({ scaffold }) },
	webpack: (config) => {
		config.plugins.push(lankaDiWebpack({ scaffold }));
		return config;
	},
	transpilePackages: [
		"lanka",
		"@lanka-playgrounds/_shared",
		"@lankajs/host",
		"@lankajs/unstorage",
		"@lankajs/any-schema",
		"@lankajs/arktype",
		"@lankajs/async",
		"@lankajs/collection",
		"@lankajs/effect",
		"@lankajs/optimistic",
		"@lankajs/plugin-bootstrap-steps",
		"@lankajs/plugin-graphql",
		"@lankajs/plugin-grpc",
		"@lankajs/plugin-http",
		"@lankajs/typebox",
		"@lankajs/valibot",
		"@lankajs/yup",
		"@lankajs/zod",
	],
};
