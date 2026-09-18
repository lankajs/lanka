import { render } from "solid-js/web";
import { AtlasApp } from "./App/AtlasApp";
import { startAtlasSolid } from "./startAtlasSolid";

/**
 * The executable entry, and the only file here that reads the environment.
 *
 * Three lines, like every other application's entry in this folder — which is
 * the point of them all being three lines: what differs between the hosts is
 * above this file, not in it.
 */
const app = await startAtlasSolid({
	apiBaseUrl: import.meta.env.VITE_ATLAS_API ?? "http://127.0.0.1:4380/api",
	isDevelopment: import.meta.env.DEV,
});

const root = document.getElementById("root");

if (root) render(() => <AtlasApp app={app} />, root);
