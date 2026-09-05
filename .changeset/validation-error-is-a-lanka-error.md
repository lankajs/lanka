---
"lanka": patch
---

`LankaValidationError` is a `LankaError` of kind `schema`. The validation port's failure extended `Error` directly, so `LankaError.is` — and everything built on it: the HTTP policy's error middleware, an application branching on `kind` — never saw a refused body, while the request layer's own "200 that was not JSON" was a `schema` failure. `name` stays `LankaValidationError`, `status` stays 422, `errors` is still the message list; the described issues are also on `issues`.
