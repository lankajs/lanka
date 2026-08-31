# @lankajs/storage

**▸ module** · Storage and encryption

> Three adapters behind one port, WebCrypto encryption, encrypted zustand persistence.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `LankaWebStorageAdapter` — synchronous
- `LankaCacheStorageAdapter`, `LankaIndexedDbAdapter` — asynchronous, same port
- `LankaEncryptor` + `WebCryptoSupport` — engine capability detection
- `LankaEncryptedStorage`, `LankaEncryptedStateStorage` — zustand persistence
- `LankaIdRegistry` — a stored string ↔ short id mapping with persistence hooks
- `stringBigIntCodec` — reversible string-to-number encoding, stateless

## Registry, not hasher

`LankaIdRegistry` does not hash: the id comes from a counter and is STORED, not
computed. Without the stored mapping the number means nothing — which is why the
registry has persistence and a hash could not.

Reversible string-to-number encoding is a separate, stateless unit (`stringBigIntCodec`).

## The only tie to core

`LankaLogger`, for transaction diagnostics, kept deliberately: a private console writer
would mean two log formats in one app. No core CONFIG is needed — the encryption secret
and the legacy plaintext keys come from the app, so storage works before the framework
is bootstrapped.

---

Repository map: [../../README.md](../../README.md)
