/*
 * From BUILT OUTPUT, by path, and only inside this repository.
 *
 * A consumer writes `@lankajs/tool-di/metro`. Here the workspace link points at
 * TypeScript SOURCE and this file is loaded by node, which will not compile it.
 * `pnpm build` before `expo start` — `playgrounds/README.md` says so out loud.
 */
const { getDefaultConfig } = require("expo/metro-config");
const { lankaDiMetro } = require("../../../tools/di/dist/metro.js");

/**
 * Metro has no plugin array, so the integration is a function of the config —
 * the way everything else in this ecosystem is.
 *
 * It MERGES into `resolver.extraNodeModules` rather than replacing it, which is
 * what lets it compose with whatever else a project has already written there.
 *
 * `watchFolders` is the monorepo half: this application resolves the framework
 * from workspace links that point outside its own folder, and Metro watches only
 * the project root unless it is told otherwise.
 */
const path = require("node:path");

const workspace = path.resolve(__dirname, "../..");
const config = lankaDiMetro(getDefaultConfig(__dirname), { scaffold: !process.env.CI });

config.watchFolders = [workspace];
config.resolver.nodeModulesPaths = [
	path.resolve(__dirname, "node_modules"),
	path.resolve(workspace, "node_modules"),
];

module.exports = config;
