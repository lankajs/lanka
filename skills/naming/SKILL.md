# Naming

One style for the whole repository: folders, files, symbols, parameters, config
keys. Most of it is machine-checked by `scripts/check-naming.mjs`.

**The property everything below serves:** a name must say what a thing is, where
it came from and how to use it, without reading the implementation.

---

## 1. Language

English everywhere — identifiers, comments, docs, developer-facing error
messages. See `skills/documentation/SKILL.md`.

The framework produces no end-user text: the host supplies it
(`httpErrorMessage`, `networkErrorMessage`, `timeoutErrorMessage`).

---

## 2. Folders

**kebab-case, always.** `shared-store/`, `api-error-handler/`, `event-bus/`.

Mixed case in a tree makes paths unguessable: `locator/Interfaces/` next to
`locator/internal/` forces you to remember which is which.

Three kinds of folder, and no others:

| Kind          | Contents                                             | Example                          |
| ------------- | ---------------------------------------------------- | -------------------------------- |
| **subsystem** | a complete part of a package with its own barrel     | `core/src/gateway/`              |
| **subject**   | one class or factory with its companions             | `gateway/request/fetch-request/` |
| **by shape**  | small same-kind declarations: `interfaces/`, `types/` | `gateway/interfaces/`            |

A subject folder appears when the main file gains neighbours: tests, private
helpers, fixtures. A lone file lives directly in the subsystem — a folder around
one file groups nothing.

`interfaces/` and `types/` are the only legal grouping by shape, and they exist
because "one type per file" needs somewhere to put the files.

**Forbidden:** `utils/`, `helpers/`, `common/`, `shared/`, `misc/`, `lib/`. Such
a folder has no subject, so everything without a home lands there.

---

## 3. Files

**A file is named after its main export, in that export's own case.**

| Main export                | File name                                |
| -------------------------- | ---------------------------------------- |
| class `lankaEventBus`      | `lankaEventBus.ts`                       |
| function `createLankaVM`   | `createLankaVM.ts`                       |
| interface `ILankaHost`     | `ILankaHost.ts`                          |
| type `TLankaLogMessage`    | `TLankaLogMessage.ts`                    |
| constant `LANKA_DI_ALIAS`  | lives with its subject, no file of its own |

A file holding several small related exports is named after the group, camelCase
and plural: `errorBodyExtractors.ts`, `lankaTestFakes.ts`. The group must have a
subject — "error body extractors", not "error stuff".

**Forbidden names:** `utils.ts`, `helpers.ts`, `shared.ts`, `common.ts`,
`misc.ts`, `types.ts` (as a dumping ground), `constants.ts`.

### Tests

`<file>.test.ts` beside the subject. A split suite is
`<file>.<aspect>.test.ts`, aspect in camelCase and meaningful:
`LankaSseTransport.reconnect.test.ts`, never `.part2.test.ts`.

A test file is named after its SUBJECT: `createLankaBootstrapPipeline.test.ts`,
not `pipeline.test.ts`.

---

## 4. Symbols

### The one place `js` appears, and why it is only there

The npm scope is `@lankajs/*`. Nothing else is: the framework is `lanka`, the
unscoped core package is `lanka`, every symbol is `lanka…`, and the CLI binary is
`lanka-skills`. The scope carries three extra letters because an npm scope must
equal the name of an npm organisation and `lanka` was not available there —
a registry's constraint, not a decision about what this framework is called.

So when a name is being chosen, `js` is never part of it. Reach for `@lankajs`
only where a package name is literally being written, and let
`scripts/registry.mjs` write those.

### Prefixes

| Prefix         | For                                            | Example                      |
| -------------- | ---------------------------------------------- | ---------------------------- |
| `ALanka…`      | abstract class — an extension point            | `ALankaGateway`              |
| `Lanka…`       | class                                          | `lankaEventBus`              |
| `ILanka…`      | interface: a port or a config shape            | `ILankaHost`                 |
| `TLanka…`      | type alias                                     | `TLankaRequestMiddleware`    |
| `createLanka…` | factory for an object WITH STATE               | `createLankaScope`           |
| `lanka…`       | a plugin, and anything wired by a call         | `lankaHttp`, `lankaDi`       |
| unbranded      | a pure function over plain values              | `isRecord`, `stringToBigInt` |

**The brand goes on anything the consumer holds, extends, configures or
registers.** Two reasons, the second the stronger: a reader of an unfamiliar
file can see where `ALankaGateway` came from, and the framework does not squat
popular names — `Logger`, `EventBus`, `Storage`, `Singletons` — which are
exactly the names an app wants for its own things. One case was not
hypothetical: a class `Storage` collided with the browser GLOBAL, and inside its
own adapter the type `Storage` meant both.

**A pure function carries no brand** — one that holds no state, registers
nothing and is not meant to be extended. `isLankaRecord` would lie: it checks an
ordinary record. A collision there is resolved at the import site
(`import { isRecord as … }`), which is not available for a class that gets
EXTENDED.

The test question: **does this thing hold state, register itself, or get
extended?** Yes — brand it. No — a verb that says what it does.

### Forbidden suffixes

`Service`, `Manager`, `Util`, `Helper`, `Handler` (as the only word), `Impl`,
`Data`, `Info`.

They say nothing: `OptimisticActionService` differs from `OptimisticActions`
only in length. A class is named after WHAT IT IS (`LankaIdRegistry`,
`LankaChunkPreload`).

The exception is a suffix that names a role in a known pair: `…Store`,
`…Policy`, `…Registry`, `…Locator`, `…Transport`, `…Middleware`, `…Bridge`,
`…Collector`. Each names a kind of thing, not its importance.

The ban holds for EVERY declaration, not only exports: class, interface, type,
function, variable, config key. A config key is surface too — everyone writing
their own locator types it.

`Data` and `Info` are banned for NAMES OF THINGS, not for values: `TUserInfo` is
a type that said nothing about itself, while `deviceInfo` is a variable holding
device information and there is no other word for it. The checker tells them
apart by the leading capital.

### Abbreviations

`VM` instead of `ViewModel` in factory and type names: `createLankaVM`,
`ILankaScenarioVM`, `TLazyLankaVM`. That name is written in every screen file.

No other abbreviations. `cfg`, `req`, `res`, `ctx` are forbidden in PUBLIC
names; inside a function `ctx` is fine when no second context is nearby.

---

## 5. Parameters, fields and config

### Units belong in the name

| Quantity | Suffix                     | Example                         |
| -------- | -------------------------- | ------------------------------- |
| time     | `…Ms`                      | `timeoutMs`, `ttlMs`, `gapMs`   |
| size     | `…Bytes`                   | `maxEntryBytes`                 |
| count    | `max…`, `…Count`, `…Limit` | `maxConcurrent`, `hydrateLimit` |
| fraction | `…Ratio`                   | `evictionRatio`                 |

A number without a unit in its name invites passing seconds where milliseconds
are expected, and learning about it from behaviour.

### Case

**Config keys are camelCase, always**, including default objects:
`LANKA_BLOB_CACHE_CONFIG.maxTotalBytes`, not `MAX_TOTAL_BYTES`. A config key is
a field the consumer overrides; UPPER_SNAKE pretends it is a constant.

`UPPER_SNAKE` stays for genuinely immutable values nobody overrides:
`LANKA_DI_DIRNAME`, `LANKA_UNSAFE_METHODS`, `LANKA_DI_CONTRACT_VERSION`.

### Booleans

- **config** — an adjective or noun: `enabled`, `optional`, `withCredentials`;
- **predicate** (method, variable, state field) — `is…` / `has…` / `can…` /
  `should…`: `isSupported()`, `hasStarted`, `isDisposed()`.

Config answers "how should it be", a predicate answers "what is it now".

### Callbacks

| Shape          | When                                                     | Example                    |
| -------------- | -------------------------------------------------------- | -------------------------- |
| `on<Event>`    | notification; nobody needs the result                    | `onFailure`, `onReconnect` |
| `<verb>`       | provides a value the work cannot proceed without         | `refresh`, `generateKey`   |
| `resolve<X>`   | computes a value for a specific case, else a default     | `resolveMs`                |
| `create<X>`    | creates a new object per call                            | `createContext`            |

`report` is an exception: the diagnostic sink is called that in every package,
and `onReport` would promise an event where there is only printing.

### Role, not type

A name states the role in this code: `transport`, `host`, `scenario`,
`resource`. `data`, `item`, `value`, `obj`, `params` are forbidden in public
signatures — except when the value really is ANY and has no role
(`isRecord(value)`).

---

## 6. What the machine checks

`scripts/check-naming.mjs`, part of `pnpm check`:

1. folders are kebab-case or one lowercase word;
2. forbidden folder and file names (`utils`, `helpers`, `shared`, `common`,
   `misc`, `lib`);
3. a file is named after its main export;
4. interfaces start with `I`, types with `T`, abstract classes with `A`;
5. every barrel export carries the brand, except those listed BY NAME;
6. config keys are not UPPER_SNAKE;
7. numeric time fields end in `Ms`;
8. no tracked path has an upper-case folder segment.

Rule 5's barrel list is derived from each `package.json`'s `exports`, so it
covers every subpath entry (`lanka/scenario`, `lanka/viewmodel`, `lanka/logger`)
and not only package roots.

Rule 8 asks GIT, not the filesystem: Windows is case-insensitive, so a rename
from `Interfaces/` to `interfaces/` can look done on disk while the index keeps
the old name — and on a case-sensitive filesystem the import does not resolve.

A rule nothing is built from and nothing fails on diverges from the code
silently. Here every rule is either checked or named as an exception in the
script itself.

---

## 7. Exceptions, by name

| Name                                             | Why unbranded                                  |
| ------------------------------------------------ | ---------------------------------------------- |
| `isRecord`, `getStringField`                     | inspect ordinary values, not framework things  |
| `generateUuid`                                   | a uuid does not belong to the framework        |
| `stringToBigInt`, `bigIntToString`               | a pure codec over primitives                   |
| `safeFireAndForget`                              | a technique, not a framework thing             |
| `createObjectUrlSafely`, `revokeObjectUrlSafely` | wrappers over a browser API                    |

The list is deliberately short. It grows only together with the reason recorded
here: "except utilities" is not machine-checkable, because what counts as a
utility is decided differently by everyone, while a list of names grows visibly
in a diff.
