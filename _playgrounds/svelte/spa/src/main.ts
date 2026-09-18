import { mount } from "svelte";
import AtlasApp from "./App/AtlasApp.svelte";
import { startAtlasSvelte } from "./startAtlasSvelte";

/**
 * The executable entry, and the only file here that reads the environment.
 *
 * Three lines, like every other application's entry in this folder — which is
 * the point of them all being three lines: what differs between the hosts is
 * above this file, not in it.
 *
 * `mount` and not `new AtlasApp(...)`: Svelte 5 components are no longer classes,
 * and the constructor call every Svelte 4 tutorial still shows throws here.
 */
const app = await startAtlasSvelte({
	apiBaseUrl: import.meta.env.VITE_ATLAS_API ?? "http://127.0.0.1:4380/api",
	isDevelopment: import.meta.env.DEV,
});

const root = document.getElementById("root");

if (root) mount(AtlasApp, { target: root, props: { app } });
