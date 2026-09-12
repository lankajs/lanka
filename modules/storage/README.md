# @lankajs/storage

**▸ module** · Storage and encryption

> Two adapters behind the port, a blob store beside them, WebCrypto encryption, encrypted zustand persistence.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `LankaWebStorageAdapter` — `ILankaStorageAdapter`, both halves
- `LankaCacheStorageAdapter` — the same port, asynchronous only
- `LankaIndexedDbAdapter` — a different port: `Blob`s for `@lankajs/blob-cache`
- `LankaEncryptor` + `WebCryptoSupport` — engine capability detection
- `LankaEncryptedStorage`, `LankaEncryptedStateStorage` — zustand persistence
- `LankaIdRegistry` — a stored string ↔ short id mapping with persistence hooks
- `stringBigIntCodec` — reversible string-to-number encoding, stateless

## Registry, not hasher

`LankaIdRegistry` does not hash: the id comes from a counter and is STORED, not
computed. Without the stored mapping the number means nothing — which is why the
registry has persistence and a hash could not.

Reversible string-to-number encoding is a separate, stateless unit (`stringBigIntCodec`).

## Which engines were measured, and which were not taken

`modules/storage-adapters/` holds one package per engine an application installs —
MMKV, AsyncStorage, the keychain, unstorage and its twenty drivers. The adapters HERE
are the ones over what a browser already provides, which is why they are not on that
shelf: the ticket onto it is a peer dependency, and there is nothing to install to get
`localStorage`.

Measured on 2026-09-12 and not taken, so the next reader does not ask again:

| Candidate | Why not |
| --- | --- |
| `expo-sqlite`, `op-sqlite` | a database rather than a key-value store; key-value over SQL is a two-column table, and whoever wants it writes an unstorage driver |
| `idb-keyval`, `localforage` | a second answer to what `LankaIndexedDbAdapter` already answers |
| `node:fs`, `node:sqlite` | covered by unstorage drivers, which is where `@lankajs/host/server` looks |

## The two ties to core

`LankaLogger`, for transaction diagnostics, kept deliberately: a private console writer
would mean two log formats in one app.

And the PORT. `ILankaStorageAdapter` is declared in `lanka/storage` and re-exported here —
an adapter is written against either import and they are the same type. It sits in core so
that `@lankajs/tool-testing`, which depends on `lanka` and nothing else, can hold the
conformance suite every adapter in `modules/storage-adapters/` is measured by.

No core CONFIG is needed either way — the encryption secret and the legacy plaintext keys
come from the app, so storage works before the framework is bootstrapped.

---

Repository map: [../../README.md](../../README.md)
