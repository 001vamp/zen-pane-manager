import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { spawn } from "node:child_process";
import test from "node:test";
import { Marionette } from "./marionette.mjs";
import { stopProcess } from "./process.mjs";
import { caughtFix } from "./prove-fails.mjs";

function connection() {
  const socket = new EventEmitter();
  socket.write = () => {};
  socket.destroy = () => { socket.destroyed = true; };
  return { socket, client: new Marionette(socket) };
}

test("a hung command rejects clearly, clears pending work, and closes the connection", async () => {
  const { socket, client } = connection();
  await assert.rejects(client.send("HungCommand", {}, { timeoutMs: 20 }), /HungCommand timed out after 20ms/);
  assert.equal(client.pending.size, 0);
  assert.equal(socket.destroyed, true);
});

test("successful responses and connection failures clear their command timers", async () => {
  const { socket, client } = connection();
  const result = client.send("Success", {}, { timeoutMs: 20 });
  const body = JSON.stringify([1, 1, null, { value: 42 }]);
  socket.emit("data", Buffer.from(`${Buffer.byteLength(body)}:${body}`));
  assert.deepEqual(await result, { value: 42 });
  const failed = client.send("Disconnected", {}, { timeoutMs: 20 });
  socket.emit("close");
  await assert.rejects(failed, /connection closed/);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(socket.destroyed, undefined, "no stale timer should destroy the socket");
  assert.equal(client.pending.size, 0);
});

test("quit propagates a command failure and still closes its socket", async () => {
  const { socket, client } = connection();
  const quit = client.quit();
  socket.emit("error", new Error("quit failed"));
  await assert.rejects(quit, /quit failed/);
  assert.equal(socket.destroyed, true);
});

const run = { status: 1, signal: null };
const report = failed => ({ fatal: null, results: [1, 2, 3, 4, 5].map(check => ({ name: `${check}. product assertion`, ok: check !== failed })) });

test("each reverted fix requires its own assertion failure", () => {
  for (let check = 1; check <= 5; check++) {
    assert.equal(caughtFix(run, report(check), check), true);
    assert.equal(caughtFix(run, report(check % 5 + 1), check), false);
  }
});

test("harness errors, crashes, missing checks and process errors never prove a fix", () => {
  const errorLine = report(4);
  errorLine.results[3].name = "4. picker shortcut (harness error)";
  for (const [attempt, result] of [
    [run, errorLine],
    [run, { ...report(4), fatal: "harness crashed" }],
    [{ status: null, signal: "SIGKILL" }, report(4)],
    [{ ...run, error: new Error("spawn failed") }, report(4)],
    [run, { ...report(4), results: report(4).results.slice(1) }],
    [run, null],
  ]) assert.equal(caughtFix(attempt, result, 4), false);
});

async function childProcess(t) {
  const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); process.send('ready'); setInterval(() => {}, 1000);"], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
  const exited = once(child, "exit");
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); await exited; });
  await once(child, "message");
  return { pid: child.pid, exited, child };
}

test("shutdown waits for actual exit and escalates to SIGKILL", async t => {
  const proc = await childProcess(t);
  const signals = [];
  await stopProcess(proc, { owned: pid => pid === proc.pid, log: line => signals.push(line), waitMs: 5, killWaitMs: 50 });
  assert.equal(proc.child.signalCode, "SIGKILL");
  assert.equal(signals.length, 2);
});

test("an already exited process is never signalled", async () => {
  await stopProcess({ pid: -1, exited: Promise.resolve(0) }, {
    owned: () => assert.fail("must not inspect or signal an exited process"), log: () => {}, waitMs: 5,
  });
});

test("ownership failure preserves the live process for the caller", async t => {
  const proc = await childProcess(t);
  await assert.rejects(stopProcess(proc, { owned: () => false, log: () => {}, waitMs: 5 }), /not our test instance/);
  assert.equal(proc.child.signalCode, null);
});

test("shutdown cannot succeed without an exit event even after killing", async t => {
  const proc = await childProcess(t);
  await assert.rejects(stopProcess({ ...proc, exited: new Promise(() => {}) }, {
    owned: () => true, log: () => {}, waitMs: 5, killWaitMs: 20,
  }), /has not exited after SIGKILL; retaining its profile/);
});
