/**
 * @lankajs/unstorage — twenty-odd drivers behind the framework's storage port.
 *
 * ## When to install it
 *
 * When the engine is not one of the other three. unstorage mounts a filesystem,
 * a Redis, a Cloudflare KV, a Vercel KV, a Netlify blob store, a Mongo, an SQL
 * table, a Capacitor preference store or the browser's own — and an application
 * whose engine this repository has never heard of writes a driver and keeps the
 * port.
 *
 * It is also the only member of its family that runs on a server, which is what
 * lets work done inside `@lankajs/host/server` persist anything at all. The other
 * three are native modules.
 *
 * ## Two things it does that the library does not
 *
 * **Raw in, raw out.** unstorage's `getItem` deserialises: a stored `"null"`
 * comes back as `null` and a stored `"{}"` as an object. Clause 1 of the port
 * says a value returns byte for byte, so this adapter uses `getItemRaw` and
 * `setItemRaw` — one character in the method name, and the whole difference
 * between a string store and a document store.
 *
 * **Keys as written.** unstorage's keys are paths, so it normalises separators —
 * `a/b` is answered as `a:b`, a backslash is dropped, `a::b` collapses. Clause 11
 * says a key comes back as it was given, so those three characters are escaped
 * on the way in and decoded on the way out. Everything else, including dots,
 * spaces and underscores, passes through untouched.
 *
 * ## What this package is not
 *
 * It is not unstorage: the engine is handed in, with whatever driver the
 * application mounted. Unlike its three siblings, unstorage runs in node — so
 * this package's playground drives the REAL library, and the shape declared in
 * `ILankaUnstorageEngine` is held to account by a compiler rather than by a
 * double.
 */

export { LankaUnstorageAdapter } from "./lanka-unstorage-adapter/LankaUnstorageAdapter";
export { createLankaUnstorageAdapter } from "./_factories/create-lanka-unstorage-adapter/createLankaUnstorageAdapter";
export type { ILankaUnstorageEngine } from "./_interfaces/ILankaUnstorageEngine";
