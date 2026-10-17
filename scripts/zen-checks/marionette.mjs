import net from "node:net";

export class Marionette {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
    this.greeting = null;
    this.greeted = new Promise(resolve => { this.onGreeting = resolve; });
    socket.on("data", chunk => this.receive(chunk));
    socket.on("close", () => this.failAll(new Error("Marionette connection closed")));
    socket.on("error", error => this.failAll(error));
  }

  static async connect(port, { timeoutMs = 60000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try {
        const socket = await new Promise((resolve, reject) => {
          const s = net.connect({ host: "127.0.0.1", port }, () => resolve(s));
          s.once("error", reject);
        });
        const client = new Marionette(socket);
        await Promise.race([client.greeted, delay(5000).then(() => { throw new Error("no Marionette greeting"); })]);
        return client;
      } catch (error) {
        lastError = error;
        await delay(500);
      }
    }
    throw new Error(`Could not connect to Marionette on port ${port}: ${lastError?.message}`);
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const colon = this.buffer.indexOf(0x3a);
      if (colon < 0) return;
      const length = Number(this.buffer.subarray(0, colon).toString());
      if (this.buffer.length < colon + 1 + length) return;
      const message = JSON.parse(this.buffer.subarray(colon + 1, colon + 1 + length).toString());
      this.buffer = this.buffer.subarray(colon + 1 + length);
      if (!Array.isArray(message)) { this.greeting = message; this.onGreeting(message); continue; }
      const [, id, error, result] = message;
      const waiter = this.pending.get(id);
      if (!waiter) continue;
      this.pending.delete(id);
      if (error) waiter.reject(new Error(`${error.error}: ${error.message}`));
      else waiter.resolve(result);
    }
  }

  failAll(error) {
    for (const waiter of this.pending.values()) waiter.reject(error);
    this.pending.clear();
  }

  send(name, params = {}, { timeoutMs = 130000 } = {}) {
    const id = this.nextId++;
    const body = Buffer.from(JSON.stringify([0, id, name, params]));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.failAll(new Error(`Marionette command ${name} timed out after ${timeoutMs}ms`));
        this.socket.destroy();
      }, timeoutMs);
      const finish = fn => value => { clearTimeout(timer); fn(value); };
      this.pending.set(id, { resolve: finish(resolve), reject: finish(reject) });
      try {
        this.socket.write(`${body.length}:`);
        this.socket.write(body);
      } catch (error) {
        this.failAll(error);
        this.socket.destroy();
      }
    });
  }

  async startSession() {
    return this.send("WebDriver:NewSession", { capabilities: { alwaysMatch: { "moz:accessibilityChecks": false } } });
  }

  setContext(value) { return this.send("Marionette:SetContext", { value }); }

  async execute(script, args = [], { sandbox = null } = {}) {
    const result = await this.send("WebDriver:ExecuteScript", { script, args, ...(sandbox ? { sandbox } : {}) });
    return result?.value;
  }

  async executeAsync(script, args = [], { timeoutMs = 30000 } = {}) {
    await this.send("WebDriver:SetTimeouts", { script: timeoutMs });
    const result = await this.send("WebDriver:ExecuteAsyncScript", { script, args }, { timeoutMs: timeoutMs + 5000 });
    return result?.value;
  }

  performActions(actions) { return this.send("WebDriver:PerformActions", { actions }); }
  releaseActions() { return this.send("WebDriver:ReleaseActions"); }

  // Graceful quit runs quit-application-granted, so SessionStore and Pane save.
  async quit() {
    try { await this.send("Marionette:Quit", { flags: ["eAttemptQuit"] }, { timeoutMs: 10000 }); }
    finally { this.socket.destroy(); }
  }

  close() { this.socket.destroy(); }
}

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
