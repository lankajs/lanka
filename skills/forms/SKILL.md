# Forms

Which shape a published thing takes — class, factory, object, function — and why
that is not a matter of taste.

`skills/surface/SKILL.md` owns what is published and what is promised about it.
`skills/parity/SKILL.md` owns the two STYLES everything is offered in. This skill
owns the one question underneath both: given what a consumer does with a thing,
what shape does it arrive in.

## The one rule

**The form follows what the consumer does with it, never what was convenient to
write.**

A framework that answers this question differently in six places has not made a
decision six times. It has made none, and the reader pays for that on every
import: they cannot predict whether the next thing is `new`, a call, or a
property.

## The table

| The consumer…                                              | Form                                             | Named                                  | Why this form                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| calls it without holding an instance — one per application | a class, plus its default instance               | `LankaLogger` + `lankaLogger`          | what node does with `Console` and `console`: the ambient one is ready, a second one is possible                             |
| creates one per something of their own                     | factory `createLanka…`                           | `createLankaPolling`                   | state lives in a closure; no `this`, no `new`, and a test needs no ceremony                                                 |
| writes an implementation of                                | see `skills/parity` — a class base AND a factory | `ALankaGateway` + `createLankaGateway` | a role is written many times per application; both styles must reach it                                                     |
| catches by type                                            | class                                            | `LankaError`                           | `instanceof` needs a prototype. This is the only reason a class is the answer by itself                                     |
| hands to the framework                                     | function `lanka…`                                | `lankaHttp`                            | the ecosystem's plugin shape: `react()`, `tsconfigPaths()`, `pinia()`                                                       |
| takes ready-made                                           | frozen object                                    | `lankaFilterMatchers`                  | a value, not a factory — which is why it is not called                                                                      |
| performs on plain values                                   | function, verb first                             | `compareLankaValues`                   | reads as a sentence, and tree-shakes for free                                                                               |
| wants one import per package                               | nothing new — `import * as lankaCollection`      | —                                      | a namespace import reads as `object.method` and still tree-shakes; a hand-written namespace object would retain the package |

Eight rows. Nothing is left to judgement, and every row states the reason rather
than the preference.

**Form is not style.** This table says what a thing IS; how a consumer reaches it
— by `new`, by a call, or by a member on a namespace — is
`skills/parity/SKILL.md`, and the answer there is always "both". A class in this
table never means "only for class-style users".

## The trade-offs, so the table can be argued with

| Form                              | Gains                                                                                               | Costs                                                                                     | Reach for it when                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| plain function                    | tree-shakes per name; nothing to construct; trivial to test                                         | no state; no place to hang related operations                                             | the answer depends only on the arguments              |
| factory `createLanka…`            | state hidden in a closure; no `this`; returns an interface, so the implementation stays replaceable | cannot be extended further except by wrapping; no `instanceof`                            | a consumer holds one per subject                      |
| class                             | `extends`, `instanceof`, a name in a stack trace; the natural home for a template method            | a subclass sees `protected`, which is a promise (structure §7); heavier to fake in a test | inheritance or type-catching is the point             |
| abstract class `ALanka…`          | states a contract AND supplies the parts around it                                                  | every abstract member added later breaks every subclass                                   | the framework defines a role a consumer implements    |
| frozen object                     | reads as `object.method`; no construction; patching is an error rather than a silent global change  | one binding, so a consumer taking one member takes them all                               | a published table of values                           |
| default instance beside its class | the ambient call site everyone wants, plus a second instance when needed                            | two names for one subject, which must be documented together                              | one per application, and the second one is imaginable |
| static-only class                 | none that a module does not give                                                                    | banned — §1                                                                               | never                                                 |

---

## 1. Ambient things are objects, never static-only classes

A class whose every member is `static` is a namespace wearing a class's clothes.
It cannot be instantiated, it has no polymorphism, and to a bundler it is ONE
binding: importing it for a single method retains all of it.

That is the smaller argument. The larger one:

**A static class invites inheritance it cannot honour.** `protected static`
members are visible to a subclass, so a subclass appears — and now a namespace
has a hierarchy, its state is shared between the two, and neither can be reset
without the other. This repository had exactly that pair, and it is why
`skills/structure/SKILL.md` rule 7 carries one exception.

| Instead of                                                  | Write                                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `class LankaStorage { static getLocal() {} }`               | `class LankaStorage { getLocal() {} }` plus `export const lankaStorage = new LankaStorage(defaults)` |
| `class X { protected static handler }` shared by a subclass | two objects over one internal implementation                                                         |

An ambient is the DEFAULT INSTANCE of an ordinary class, exported beside it —
what node does with `console` and `Console`. That is what lets a consumer build a
second one, which a static class could never do; `skills/parity/SKILL.md` §2
carries the shape.

Its name is camelCase, because the case is the only signal a reader has that this
is the instance and not the class. A namespace object that gathers a package's
operations — where there is no instance to hold — is `Object.freeze`d, for the
reason in §4.

### 1a. The one shape that looks static and is not

A class with a `private constructor` and a `static create()` is NOT this
anti-pattern when the construction is asynchronous: `LankaEncryptor` needs
WebCrypto before an instance can exist, and a constructor cannot await. The
class holds instance state and there is exactly one way to obtain it.

The static factory is a free `createLankaEncryptor()` for that reason, and the
class stays a class with a public constructor for a caller holding its own key.

---

## 2. A class is the answer to four questions

1. **Is it caught by type?** `LankaError`, `LankaValidationError`. `instanceof`
   needs a prototype and nothing else provides one.
2. **Is it a role's class-style base?** `ALankaGateway`, `ALankaScenario` — see
   `skills/parity/SKILL.md`. The `A` prefix is the contract, and its `protected`
   members are promises (`skills/structure/SKILL.md` rule 7).
3. **Is subclassing an existing implementation the documented way to extend it?**
   `LankaFetchJsonRequest` says so in its header: "a fourth kind is a subclass
   with one method". Where the invitation is not written, it does not exist.
4. **Is it something a consumer holds or writes one of?** Then it has a class
   AND a factory, because every published thing is reachable in both styles
   (`skills/parity/SKILL.md`). The class is the implementation; the factory is
   built over it.

Anything else — a pure operation, a ready-made value — has no instance to hold,
and its object-oriented form is a member on a namespace rather than a class.

---

## 3. `createLanka…` and `lanka…` are not interchangeable

| Prefix         | Returns                                     | Example                      |
| -------------- | ------------------------------------------- | ---------------------------- |
| `createLanka…` | a NEW object with state, one per call       | `createLankaCollectionView`  |
| `lanka…`       | a plugin for `use()`, or a ready-made value | `lankaHttp`, `lankaTestHost` |

Both are functions; they differ in what the result IS. A plugin keeps the bare
form because the whole ecosystem writes plugins that way and a consumer types it
inside `use(...)`, where `createLankaHttpPlugin(...)` reads as noise.

An operation over values is neither: it is named verb-first —
`compareLankaValues`, `buildLankaQueryParams` — because it reads as a sentence at
the call site.

---

## 4. Frozen means frozen

A published table and a package namespace are `Object.freeze`d. Not for safety
theatre: a consumer who patches `lankaFilterMatchers.contains` changes behaviour
for every list in the application including the framework's own, and the failure
appears in a package nobody edited. Freezing turns it into an error at the line
that did it.

An ambient INSTANCE is not frozen — it is an object with methods and its own
state, and freezing it would only stop the framework from configuring it.

Extending is by copy — `{ ...lankaFilterMatchers, myOperator }` — which is what
the collection playground does.

---

## 5. What the machine checks

`scripts/check-forms.mjs`:

| Tag                      | Fails when                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `static-only-class`      | every member of a class is `static`                                                                                                                   |
| `class-without-reason`   | a facade barrel exports a class that is neither `A`-prefixed nor extends `Error`, and is not listed in `SUBCLASSABLE` with the header that invites it |
| `namespace-not-frozen`   | a package namespace or a published table is not `Object.freeze`d                                                                                      |
| `ambient-in-pascal-case` | a default instance is named like its class                                                                                                            |
| `admission-unused`       | `SUBCLASSABLE` names a class no facade publishes, so the entry exempts nothing                                                                        |

Each entry in `SUBCLASSABLE` names the file whose header carries the invitation.
A list without that is an opt-out, and an opt-out is a rule reporting success.

---

## 6. Where each form is the community's answer too

A framework whose forms surprise its audience pays for that on every file. These
are the shapes the ecosystem already uses for the same jobs:

| This framework                                   | The same shape elsewhere                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `lankaLogger` beside `LankaLogger`               | node's `console` beside `Console`                                                 |
| `createLankaVM`, `createLankaCollectionView`     | `create` in zustand, `configureStore` in Redux Toolkit, `createStore` in effector |
| `lankaHttp({ ... })` inside `use()`              | `react()` and `tsconfigPaths()` in a vite config; `pinia()` in Vue                |
| `ALankaGateway` with `protected` hooks           | `Readable` with `_read`; `EventEmitter` for subclassing                           |
| `defineLankaRole`, `defineLankaPrefetchResource` | `defineStore` in Pinia, `defineConfig` everywhere                                 |
| `import * as lankaCollection`                    | how `date-fns` and node's own modules are read                                    |
| `LankaError`                                     | every library that expects `instanceof`                                           |

The one place this framework is deliberately stricter is the static-only class:
common in code that came from Java, absent from the libraries above, and banned
here for the reason in §1.

---

## 7. Anti-patterns

| Pattern                                           | Why it fails                                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A class because "we might need state later"       | the factory can hold state too, and the class cannot be un-published                            |
| A static class to group functions                 | that is a module; the file already groups them, and `import * as` reads it as an object         |
| `create*` returning a value rather than an object | the name promises a thing to hold                                                               |
| An ambient object that is not frozen              | one patch changes every consumer of the framework, in a package nobody edited                   |
| A class exported so a test can `instanceof` it    | the test is asserting on the shape of an implementation, which is the thing a factory is hiding |
