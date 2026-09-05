---
"@lankajs/plugin-prefetch": patch
---

The chunk sweep's wire ceiling no longer applies to the pause and the visibility gate. `waitUntilAllowed` held all three under one `quietWireTimeoutMs` deadline, so a backgrounded WebView pulled the next chunk after the ceiling — the user's data plan spent on a screen nobody was looking at — and a pause was cut to whichever of `pauseExpiryMs` and `quietWireTimeoutMs` was shorter. A pause now waits for its own expiry; a hidden tab is waited for without a ceiling once the platform has reported itself visible (a platform that never did is still not believed); only the wire wait keeps the ceiling.
