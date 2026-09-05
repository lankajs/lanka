---
"@lankajs/plugin-prefetch": major
---

`LankaDataWarmup` owns the lifecycle an application had to write around it. `setSource()` binds the tasks; `start()` latches once after `startDelayMs`, only when `isReady()` says the session is confirmed and the connection is not saving data, and a refused start re-arms (`rearm.delayMs`, `rearm.maxAttempts`) instead of latching; `pause()` / `resume()` hold the next batch, and a pause nobody releases expires after `pauseExpiryMs`; a `scheduler` supplies the idle frame before each batch; `concurrency()` sets the batch size per batch when the link's quality is the input; `retry` gives failed tasks more passes. A task may state `immutableReason` instead of `keptFreshBy`. `run(tasks)` remains. Diagnostics report `hasStarted` and `isPaused` instead of `hasRun`.
