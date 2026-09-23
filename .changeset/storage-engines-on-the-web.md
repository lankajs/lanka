---
"@lankajs/mmkv": patch
"@lankajs/react-native-async-storage": patch
---

`@lankajs/mmkv` and `@lankajs/react-native-async-storage` are declared for the
browser as well as React Native.

Both engines ship a web build — MMKV over `localStorage`, AsyncStorage 3 over
IndexedDB — which Expo web and react-native-web pick by their `.web` resolution,
and neither adapter ever constructs its engine, so it runs wherever one is handed
to it. The declaration rests on a test rather than on the libraries' docs: each
package's playground now runs the whole storage conformance suite against the
real web build of its engine, in jsdom (with `fake-indexeddb` for AsyncStorage).

`@lankajs/secure-store` stays React-Native-only: `expo-secure-store` has no web
implementation.
