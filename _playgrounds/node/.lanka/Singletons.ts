/**
 * The singletons this application publishes to `lanka` — next door.
 *
 * This file holds no export of its own, and that is the layout rather than an
 * omission: the singletons live in `.lanka_di/Singletons.ts`, and the framework
 * reads them through the line below because `@lanka_di/Singletons` resolves
 * HERE. It is the file `@lankajs/tool-di` writes for a barrel that lives in the
 * other directory, kept by hand in this application so the split is visible to
 * a reader rather than only to a build.
 */
export * from "../.lanka_di/Singletons";
