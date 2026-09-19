import { setLankaStorageSecret } from "@lankajs/storage";
import { createApp } from "vue";
import AtlasApp from "./App/AtlasApp.vue";
import { startAtlasVue } from "./startAtlasVue";

/*
 * The secret comes FIRST, before anything can read or write.
 *
 * `@lankajs/storage` has no default and refuses loudly without one, because a
 * shipped fallback secret is the absence of encryption disguised as its
 * presence. What it buys is worth saying plainly: it is baked into the build, so
 * it is obfuscation rather than protection against a script running on this page
 * — what it does is keep personal data out of `localStorage` as plain text.
 *
 * A real application reads this from its build and would never find it in source
 * control. These are demonstrations whose personal data is the string "Ada", and
 * the value below is named so that nobody mistakes it for a pattern to copy.
 */
setLankaStorageSecret("atlas-playground-not-a-real-secret");

/**
 * The executable entry, and the only file here that reads the environment.
 *
 * Three lines, like every other application's entry in this folder — which is
 * the point of them all being three lines: what differs between the hosts is
 * above this file, not in it.
 */
const app = await startAtlasVue({
	apiBaseUrl: import.meta.env.VITE_ATLAS_API ?? "http://127.0.0.1:4380/api",
	isDevelopment: import.meta.env.DEV,
});

createApp(AtlasApp, { app }).mount("#root");
