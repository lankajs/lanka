# @lankajs/host — user guide

lanka is never your whole application. It lives inside Next, React Router,
TanStack Start, Astro or Expo, and that framework already owns routing,
rendering and — usually — a cache. This package is the two places where the two
have to meet.

## You will learn

- who owns what, so the two frameworks do not answer the same question twice
- which call belongs to which rendering mode: SSR, RSC, SSG, ISR, streaming, CSR
- how a gateway runs on your host's server without two users sharing one instance
- how what the server fetched becomes the screen's first state, with no second
  request from the browser
- what stays client-only, and why the boundary is not a limitation to work around

## When to reach for this

Install it the moment your host framework renders anything on a server. A
browser-only application — Vite, CRA, a single-page build behind any CDN — needs
none of it: `startLanka` in the browser is the whole story there.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must be.
> The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../ARCHITECTURE.md) for what is checked and what is merely
> advice.

## Install

```bash
npm install @lankajs/host
```

Two entries, and the split is not cosmetic:

```ts
import { hydrateLankaVM } from "@lankajs/host"; // browser
import { runLankaRequest, runLankaStatic } from "@lankajs/host/server"; // node
```

`@lankajs/host/server` imports `node:async_hooks`. Importing it from a client
component puts a node builtin in your browser bundle — so it lives behind its own
subpath, and the `check:runtime` gate in this repository keeps it there.

## Who owns what

The division is not a matter of taste. It follows from what each layer is made
of.

| lanka owns                                                | Your host framework owns                                    | How they meet                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| gateways: endpoints, tagged failures, validated bodies     | routing, layouts, navigation                                 | a loader or server component calls a gateway inside `runLankaRequest`          |
| retry, auth refresh, CSRF, deadlines (`@lankajs/plugin-http`) | SSR, streaming, hydration of the HTML                        | the plugins install per scope, so a server render has the same policy as a tab |
| the state a screen reads (ViewModels), and scenarios       | which components are client components                       | the VM is used in a client component; server data arrives as a prop           |
| coordination between screens (the event bus)                | bundling, environment variables, asset hashing               | `@lankajs/tool-di` gives the build one alias and checks it                       |
| nothing about caching                                      | the request cache, `revalidate`, `revalidateTag`, stale windows | a gateway returns data; the host decides what to remember and when to ask again |
| nothing about rendering                                     | the renderer, `<Suspense>`, error boundaries                  | a gateway's failure is a tagged `LankaError` your boundary can read           |

**The rule behind the table: a capability your host already has is not a feature
here — it is a second answer to one question**, and your application ends up
owning the disagreement. What lanka adds is the layer no host ships: one typed,
validating, middleware-wrapped way to talk to your API, identical on both sides
of the network.

## Which call, for which mode

| Rendering mode                                                    | Call                                | Why                                          |
| ----------------------------------------------------------------- | ----------------------------------- | -------------------------------------------- |
| SSR, React Server Components, loaders, server functions, actions   | `runLankaRequest({ headers })`       | a user is waiting, and identity must travel   |
| streamed SSR: each `<Suspense>` chunk                              | `runLankaRequest` around the await   | the scope spans the async work, not the render |
| SSG: `generateStaticParams`, a prerendered route, a static export  | `runLankaStatic`                     | nobody is identified; the output is shared    |
| ISR: timed revalidation and on-demand `revalidateTag`              | `runLankaStatic`                     | same: it is a rebuild, not a visit            |
| client navigation, CSR, anything in the browser                    | nothing — the instance from `startLanka` | the browser has one instance already      |

The two server calls are the same machinery and differ in exactly one way:
`runLankaRequest` forwards the caller's `cookie` and `authorization`, and
`runLankaStatic` refuses them — in the types, and again at runtime. A cookie
forwarded during a build bakes one reader's data into a file served to everybody,
and the build succeeds, and the page looks right to whoever ran it.

## What crosses into the API call, and how to change it

`cookie` and `authorization` cross by default. Nothing else does: `host`,
`content-length` and `accept-encoding` describe the browser's connection to your
host framework, not your framework's connection to the API, and forwarding them
produces requests that are wrong in ways that take an afternoon to find.

When your API wants another one — a tenant, a trace, a scheme of its own — name
the whole list:

```ts
runLankaRequest(
	{ apiBaseUrl, headers: await headers(), forward: ["cookie", "x-tenant"] },
	() => lankaGateways.reportGateway.monthly(),
);
```

`forward` REPLACES the default rather than adding to it, so the list you write is
the list that travels — there is nothing to remember about what was already
there. A gateway that sets a header itself always wins: whoever wrote that call
knew something this does not.

## Next.js — App Router

```ts
// app/posts/page.tsx — a server component
import { headers } from "next/headers";
import { runLankaRequest } from "@lankajs/host/server";
import { lankaGateways } from "lanka/locator";
import { PostList } from "./PostList";

export default async function PostsPage() {
	const posts = await runLankaRequest(
		{ apiBaseUrl: process.env.API_URL, headers: await headers() },
		() => lankaGateways.postGateway.published(),
	);

	return <PostList initial={{ posts }} />;
}
```

```tsx
// app/posts/PostList.tsx — the client half
"use client";

import { hydrateLankaVM } from "@lankajs/host";
import { usePostsVM } from "@/view-models/usePostsVM";

export const PostList = ({ initial }) => {
	hydrateLankaVM(usePostsVM, initial); // before the first read
	const vm = usePostsVM();

	return <ul>{vm.posts.map(…)}</ul>;
};
```

Static and revalidated routes take the other call:

```ts
export async function generateStaticParams() {
	return runLankaStatic({ apiBaseUrl: process.env.API_URL }, async () => {
		const posts = await lankaGateways.postGateway.published();
		return posts.map((post) => ({ slug: post.slug }));
	});
}

export const revalidate = 3600; // the host's setting, not ours
```

The build side needs the `@lanka_di` alias in both halves of `next.config.js` —
Turbopack for `next dev`, webpack for a webpack production build. See
[@lankajs/tool-di](../../tools/di/GUIDE.md).

## React Router v7 (framework mode) and Remix

```ts
export async function loader({ request, params }: Route.LoaderArgs) {
	return runLankaRequest(
		{ apiBaseUrl: process.env.API_URL, headers: request.headers },
		() => lankaGateways.postGateway.bySlug(params.slug),
	);
}

export default function Post({ loaderData }: Route.ComponentProps) {
	hydrateLankaVM(usePostVM, { post: loaderData });
	const vm = usePostVM();
	…
}
```

`request.headers` is a `Headers` object and is read directly. Prerendering
(`prerender` in the config) uses `runLankaStatic`.

## TanStack Start

```ts
const getPost = createServerFn({ method: "GET" })
	.validator((slug: string) => slug)
	.handler(({ data: slug }) =>
		runLankaRequest({ apiBaseUrl: process.env.API_URL, headers: getHeaders() }, () =>
			lankaGateways.postGateway.bySlug(slug),
		),
	);
```

The router's loader keeps its own caching; the gateway just answers.

## Astro

An Astro island is a client component and needs nothing from this package unless
the `.astro` page itself fetches:

```astro
---
import { runLankaRequest } from "@lankajs/host/server";
const posts = await runLankaRequest({ headers: Astro.request.headers }, () =>
	lankaGateways.postGateway.published(),
);
---
<PostList initial={{ posts }} client:load />
```

## Expo and React Native

Nothing from `/server` — there is no server. `hydrateLankaVM` is available and
occasionally useful (a screen starting from a cached payload), but the ordinary
Expo application starts lanka once in the browser sense and never leaves the
client. The build side is `@lankajs/tool-di/metro`.

## What stays client-only, and why

**ViewModels.** A ViewModel is a zustand store created at module level and read
through React hooks. One module means one store per PROCESS — which in a browser
is one per tab and on a server is one shared by every user connected to it. There
is no flag that fixes that; a store per request would take away the one thing a
VM is for, which is that a screen reaches it in one line.

So the handoff is data, not state:

1. the server fetches through a gateway, inside a scope;
2. the page hands the result to the browser as an ordinary prop;
3. `hydrateLankaVM` makes it the ViewModel's first state, once.

That is also why `hydrateLankaVM` lives in this package's browser entry rather
than in core: core's ViewModel layer knows nothing about servers, and this is the
one call that exists because a server was involved.

## Hydration is the first paint, and nothing after it

`hydrateLankaVM` applies once per store. A later call does nothing — not a throw,
because React renders a component twice in StrictMode and again on every
re-render, and a throw would turn correct code into a crash you only see in
development. In development a later call carrying DIFFERENT data warns, because
that one is a real mistake: usually a navigation expecting fresh server data to
land in a store that already has some. **Change hydrated state with an action.**

## Common mistakes

**Calling a gateway on the server without a scope.** The ambient facades have no
instance to resolve to and say so by name. That failure is the feature: the
alternative was reading whichever instance the process created last, which is
another user's.

**Forgetting the headers.** The page renders signed out, then flips signed in
when the browser fetches with the cookie it always had. Nothing errors.

**Using `runLankaRequest` at build time.** It works, which is the problem: if you
pass headers there, one reader's session is baked into a shared file. Use
`runLankaStatic`, which cannot.

**Reaching for a ViewModel inside a scope.** It resolves — module state always
does — and it is shared with every other request in the process.

**Adding a second cache.** A `Map` around a gateway "just for SSR" disagrees with
your host's cache on the first mutation, and the disagreement is yours to debug.

**Importing `@lankajs/host/server` from a client component.** Your bundler tries to
resolve `node:async_hooks` for the browser. Keep the two entries apart; that is
what they are for.

## Recap

- One instance per unit of server work, and never one per process.
- `runLankaRequest` for a waiting user and their identity; `runLankaStatic` for
  output shared by everybody.
- Gateways travel to the server. ViewModels do not, and the handoff is a prop.
- `hydrateLankaVM` is the first paint only.
- Routing, rendering, revalidation and bundling stay your host's — lanka does not
  offer a second one of any of them.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · The build alias:
[../../tools/di/GUIDE.md](../../tools/di/GUIDE.md)
