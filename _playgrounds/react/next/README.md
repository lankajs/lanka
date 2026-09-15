# @lanka-playgrounds/next

Atlas inside Next: an instance per request, data as a prop, and a form that owns
its own inputs.

## The two server calls, and the difference between them

| Route            | Call              | Why                                                            |
| ---------------- | ----------------- | -------------------------------------------------------------- |
| `/missions`      | `runLankaRequest` | a user is waiting, and their identity has to travel             |
| `/missions/[id]` | `runLankaStatic`  | prerendered and revalidated: the output is shared by everybody  |

`runLankaStatic` REFUSES identity — in the types and again at runtime. A cookie
forwarded during a build bakes one reader's data into a file served to everyone;
the build succeeds, and the page looks right to whoever ran it.

The `[id]` page therefore reads no headers at all. A page that asked for them
would be dynamic whatever `revalidate` said, and the two together would be a
contradiction a reader has to resolve.

## Where the form's values live

Not in the ViewModel. A ViewModel is a store created at module level — one per
PROCESS, which on a server is one shared by every request — and `hydrateLankaVM`
applies once per store. An empty form survives that; one pre-filled with
somebody's mission would hand the next visitor theirs.

So the inputs are `useState` in the component, the ViewModel keeps the SERVER's
version, and the two meet in `submit`.

## `app/` holds entries, `src/` holds decisions

Every file under `app/` is named by Next rather than by this application, and
delegates immediately. Everything it delegates to is an ordinary module a test
can import without a router — which is why this package's suite renders no
`page.tsx`.

## Running it

```bash
pnpm build                                      # once: next.config.mjs reads tool-di's dist
pnpm --filter @lanka-playgrounds/_server start
pnpm --filter @lanka-playgrounds/next dev       # http://localhost:4392
```
