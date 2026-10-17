import { setTimeout as delay } from "node:timers/promises";

async function waitExit(proc, ms) {
  const timer = new AbortController();
  try {
    return await Promise.race([
      proc.exited.then(() => true),
      delay(ms, false, { signal: timer.signal }),
    ]);
  } finally { timer.abort(); }
}

// Return only after exit is confirmed; callers must retain the profile on error.
export async function stopProcess(proc, { owned, log, waitMs = 20000, killWaitMs = 10000 }) {
  if (await waitExit(proc, waitMs)) return;
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    if (!owned(proc.pid)) throw new Error(`pid ${proc.pid} is not our test instance; not signalling it`);
    log(`stopping Zen pid ${proc.pid} with ${signal}`);
    try { process.kill(proc.pid, signal); } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    if (await waitExit(proc, killWaitMs)) return;
  }
  throw new Error(`Zen pid ${proc.pid} has not exited after SIGKILL; retaining its profile`);
}
