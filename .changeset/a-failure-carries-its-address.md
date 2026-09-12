---
"lanka": minor
"@lankajs/plugin-http": minor
---

A failure carries the address of the input it belongs to

`issues` flattens the path into the text — `items.1.qty: only 2 left` — which is
a banner's shape and useless to a form, which has a place per input and must find
it. `plugin-http`'s `lankaMessageFromFieldErrors` already said so in its own
comment: showing them all is a form's job. The canon reached the form's edge and
stopped there.

**`ILankaFieldError` is the carrier, and the path is SEGMENTS.** React Hook Form
spells `items.1.qty`, TanStack Form spells `items[1].qty`, and neither survives a
round trip through a string — a message may hold a colon, a key may hold a dot.
An EMPTY path is the value as a whole, which is the form's root and not an input
named `""`. `code` is what an application translates by.

`LankaError.fields` and `LankaValidationError`'s third parameter are ADDITIVE;
`issues` is untouched. `readLankaFieldErrors` answers one frozen empty list
rather than `undefined`, so a ViewModel writes no branch for "no fields".

**`@lankajs/plugin-http` reads the other half of a 422.**
`lankaFieldsFromErrorMap` turns `{ errors: { "items.1.qty": ["only 2 left"] } }`
into addressed failures and `extractFieldErrors` puts them on `LankaError.fields`.
Not variants of one reader: a 422 usually deserves both answers at once — a
banner and a place per input.

All three extractors are hardened for the same reason: one that throws now
answers nothing rather than replacing the server's words with the failure of the
failure report.
