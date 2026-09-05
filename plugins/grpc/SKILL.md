# Maintaining `@lankajs/plugin-grpc`

gRPC-Web framing, trailers and status codes, with the message codec left to
whoever generated the message types.

## Boundary

- A **plugin**: core calls it — but only for STREAMS. `lanka` is a **peer
  dependency**, always `workspace:^`.
- Unary calls need no `use()` and no plugin. That asymmetry is the design: an
  application making only unary calls imports the gateway base and registers
  nothing.
- The bridge, the "from outside" marker and the plugin's own lifetime are
  [`lanka/stream`](../../core/src/stream/index.ts)'s. Re-exported here for
  one-import convenience, and never forked.
- **No protobuf dependency, ever.** See invariant 1.

## Invariants

1. **The package does not know protobuf.** A codec belongs to whatever generated
   the message types, and shipping a runtime for one of them would pick the
   consumer's code generator for them while adding a dependency for everyone who
   chose differently. `ILankaGrpcCodec` is two functions.
   `createLankaGrpcJsonCodec` is shipped and is NOT the default: a gRPC server
   speaks protobuf unless somebody configured it otherwise.

2. **Sixteen status codes map to five kinds, and the mapping is a decision.**
   `CANCELLED` → `aborted` (the user left; nothing is shown),
   `DEADLINE_EXCEEDED` → `timeout`, `UNAVAILABLE` → `network`, `UNIMPLEMENTED`
   and `INTERNAL` → `http`, everything else non-zero → `domain`. Getting one
   wrong shows a user an error for leaving a screen, or offers a retry of
   something that will never work.

3. **`code` carries the status NAME.** `error.code === "PERMISSION_DENIED"` is a
   line somebody can read; `error.code === "7"` is a line somebody has to look
   up. An unnamed code becomes `GRPC_<n>` rather than being dropped.

4. **The status is read from the trailers AND from the headers, trailers
   first.** A call refused before any message is a trailers-only response with no
   body to find it in, and a reader that knew one of the two would report a
   schema failure for an ordinary permission denial.

5. **Status `0` with no message is `kind: "schema"`.** Answering empty bytes
   would hand the codec something it decodes into defaults, and a screen would
   render zeroes as data.

6. **The frame reader keeps what is not yet a whole frame.** Bytes arrive in
   chunks the network chose: a five-byte header can be split across two reads and
   a message across ten. A reader that assumed whole frames works in every test
   and drops messages under load.

7. **An ended stream enters the reconnect ladder.** A server that closes the
   stream — cleanly or with a failing status — is no longer delivering, and a
   stream that ended and stayed ended is a screen quietly permanently stale.

8. **A failing status on a stream is REPORTED, not thrown.** Nobody is awaiting
   a stream: a throw becomes an unhandled rejection and the reason reaches no log
   the application controls.

9. **Mock mode short-circuits in the gateway, and the docblock says so.** A mock
   answers a RESPONSE and a codec encodes REQUESTS, so there is nothing to
   decode. This is the one place where the mock path and the real path diverge,
   and it must stay written down: a mock cannot catch a codec that decodes
   wrongly.

10. **`x-grpc-web` and the content type are merged into a caller's headers,
    never replaced.** Dropped, the server answers `415` about a request it never
    tried to route.

11. **A method's `path` is written as the server declares it.** Assembling it
    from a package, a service and a method name would be three fields to get
    wrong; one string copied from the `.proto` is checkable by eye.

## Tests and coverage

Beside each unit, plus the `_playground/` scene: a desk that calls over gRPC-Web
and watches a server stream, with both gateway styles, both bridge styles, and a
message deliberately split across two chunks.

Coverage is a ratchet: statements 99, branches 92, functions 96, lines 99.

What to pin: every row of the status mapping, a status in the headers, a split
frame, a stream that ends re-opening, and a call that could not be made at all
entering the ladder rather than leaving an unhandled rejection.

## Before you finish

```bash
pnpm --filter @lankajs/plugin-grpc test
pnpm --filter @lankajs/plugin-grpc test:coverage
node scripts/check-parity.mjs        # the gateway: class and factory
node scripts/check-publishable.mjs   # the peer range
pnpm check
```

## Traps

**Adding `protobuf-es` "just for the default codec".** See invariant 1.

**Making the JSON codec the default.** It fails as a decoding error inside a
server that speaks protobuf, which is every gRPC server unless configured
otherwise.

**Assuming each stream chunk holds whole frames.** See invariant 6 — the failure
never reproduces on a fast local network.

**Throwing from the stream's status reader.** See invariant 8.

**Copying the bridge or the marker out of `lanka/stream`.** Two copies of the
marker are two chances to get it wrong once, and its failure is silent.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
