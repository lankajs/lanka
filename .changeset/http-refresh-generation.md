---
"@lankajs/plugin-http": patch
---

A request sent before a token refresh, whose 401 arrives after that refresh has
finished, is now retried with the new credentials instead of starting a second
refresh. The refresh was shared only while it ran, so on a slow network a burst
of requests could rotate the token twice — with a server that revokes a session
when a spent refresh token is reused, that second rotation signs the user out.
A request sent after a refresh completed still refreshes on its own 401.
