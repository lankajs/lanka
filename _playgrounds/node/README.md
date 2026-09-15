# @lanka-playgrounds/node

Atlas with no screen: a service that starts the framework, watches one ViewModel
through `subscribe`, and gives every request its own instance.

Read [`../README.md`](../README.md) first — it says what these applications are
and, more importantly, what they are not.

## What only this one shows

Every other application here proves lanka works inside a renderer.
[`../vanilla`](../vanilla) proves there does not have to be one. This proves
there does not have to be a DOM either, which is the half a worker, a queue
consumer, a CLI and a server care about.

Its suite runs under `environment: "node"` with no jsdom anywhere, so a line that
quietly reached for `document` would fail rather than find one. Two of its scenes
read this package's own sources and manifest and assert exactly that.

## Two lifetimes, and getting them backwards is the bug

**The process has one.** It starts the framework once, builds one ViewModel and
watches it. That is this service's own view of the world — a cache, a dashboard's
source — and one per process is right for it.

**A request has its own.** `/missions` answers for a CALLER, so it runs inside
`runLankaRequest` with that caller's headers and touches no ViewModel at all. Two
overlapping requests never share a bus, a locator cache or a session.

A ViewModel read inside a request would be one user's state answered to another.
A request scope around the watcher would be a scope that ends while its
subscription is still running.

## What this playground found

The runtime resolver is installed once per process and never removed, so before
this package existed the FIRST `runLankaRequest` in a process turned every later
ambient call into a failure — for the life of the process, with a message about
request scopes that named nothing the caller had done. A server that only serves
requests never notices; a service that also holds something of its own notices
immediately, and so does any test suite for one.

`lankaServerRuntimeResolver` now defers outside every scope to what the call
would have resolved to had no resolver been installed. Inside a scope nothing
changed, which is where the isolation lives.

## The two wires, and only one is free here

`WebSocket` is a node global, so the socket plugin connects with no shim.
`EventSource` is not — node has it behind `--experimental-eventsource` — and the
SSE transport asks whether the class exists and stays quiet when it does not. So
this service starts with one wire open rather than throwing at boot over a
capability it may not need. A deployment that wants server-sent events installs a
polyfill on `globalThis` before start-up, or runs node with the flag.

## Running it

```bash
pnpm --filter @lanka-playgrounds/_server start   # the API, on 4380
pnpm --filter @lanka-playgrounds/node start      # the service, on 4396
curl http://127.0.0.1:4396/missions
```
