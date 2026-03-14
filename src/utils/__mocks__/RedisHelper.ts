import { vi } from "vitest";

class RedisMock {
  constructor(config = {}) {
    this._data = new Map();
    this._expirations = new Map();
    this._config = config;
    this._streams = new Map();
    this._pubsub = new Map();
    this._subscribers = new Map();

    this.get = vi.fn(this._get.bind(this));
    this.set = vi.fn(this._set.bind(this));
    this.setex = vi.fn(this._setex.bind(this));
    this.del = vi.fn(this._del.bind(this));
    this.exists = vi.fn(this._exists.bind(this));
    this.expire = vi.fn(this._expire.bind(this));
    this.ttl = vi.fn(this._ttl.bind(this));
    this.incr = vi.fn(this._incr.bind(this));
    this.decr = vi.fn(this._decr.bind(this));
    this.hget = vi.fn(this._hget.bind(this));
    this.hset = vi.fn(this._hset.bind(this));
    this.hgetall = vi.fn(this._hgetall.bind(this));
    this.hdel = vi.fn(this._hdel.bind(this));
    this.keys = vi.fn(this._keys.bind(this));
    this.flushall = vi.fn(this._flushall.bind(this));

    // Pipeline support
    this.pipeline = vi.fn(() => new PipelineMock(this));

    // Pub/Sub
    this.publish = vi.fn(this._publish.bind(this));
    this.subscribe = vi.fn(this._subscribe.bind(this));
    this.on = vi.fn(this._on.bind(this));

    // Streams
    this.xadd = vi.fn(this._xadd.bind(this));
    this.xread = vi.fn(this._xread.bind(this));

    // Transactions
    this.multi = vi.fn(() => new MultiMock(this));

    // Connection
    this.connect = vi.fn().mockResolvedValue(this);
    this.disconnect = vi.fn().mockResolvedValue();
    this.quit = vi.fn().mockResolvedValue("OK");

    // Events
    this._listeners = { connect: [], error: [], ready: [] };

    // Test utilities
    this._callLog = [];
    this._mockResponses = new Map();
  }

  async _get(key) {
    this._logCall("get", [key]);

    if (this._expirations.has(key)) {
      const expiry = this._expirations.get(key);
      if (Date.now() > expiry) {
        this._data.delete(key);
        this._expirations.delete(key);
        return null;
      }
    }

    const value = this._data.get(key);
    return value !== undefined ? value : null;
  }

  async _set(key, value, ...args) {
    this._logCall("set", [key, value, ...args]);

    let ttl = null;
    if (args.length >= 2) {
      const [mode, time] = args;
      if (mode === "EX") {
        ttl = time * 1000;
      } else if (mode === "PX") {
        ttl = time;
      }
    }

    this._data.set(key, value);
    if (ttl) {
      this._expirations.set(key, Date.now() + ttl);
    } else {
      this._expirations.delete(key);
    }

    return "OK";
  }

  async _setex(key, seconds, value) {
    return this._set(key, value, "EX", seconds);
  }

  async _del(...keys) {
    this._logCall("del", keys);

    let deleted = 0;
    for (const key of keys) {
      if (this._data.has(key)) {
        this._data.delete(key);
        this._expirations.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async _exists(...keys) {
    this._logCall("exists", keys);

    let count = 0;
    for (const key of keys) {
      if (this._data.has(key)) {
        if (this._expirations.has(key)) {
          const expiry = this._expirations.get(key);
          if (Date.now() > expiry) {
            this._data.delete(key);
            this._expirations.delete(key);
            continue;
          }
        }
        count++;
      }
    }
    return count;
  }

  async _expire(key, seconds) {
    this._logCall("expire", [key, seconds]);

    if (!this._data.has(key)) return 0;

    this._expirations.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async _ttl(key) {
    this._logCall("ttl", [key]);

    if (!this._expirations.has(key)) return -1;

    const expiry = this._expirations.get(key);
    const now = Date.now();

    if (now > expiry) {
      this._data.delete(key);
      this._expirations.delete(key);
      return -2;
    }

    return Math.floor((expiry - now) / 1000);
  }

  // ===== HASH METHODS =====
  async _hget(key, field) {
    this._logCall("hget", [key, field]);

    const hash = this._data.get(key);
    if (!hash || typeof hash !== "object") return null;

    return hash[field] !== undefined ? hash[field] : null;
  }

  async _hset(key, field, value, ...more) {
    this._logCall("hset", [key, field, value, ...more]);

    if (!this._data.has(key) || typeof this._data.get(key) !== "object") {
      this._data.set(key, {});
    }

    const hash = this._data.get(key);
    let created = 0;

    // hset(key, obj)
    if (typeof field === "object") {
      Object.assign(hash, field);
      created = Object.keys(field).length;
    } else {
      // hset(key, field, value, field2, value2, ...)
      const args = [field, value, ...more];
      for (let i = 0; i < args.length; i += 2) {
        if (args[i] !== undefined && args[i + 1] !== undefined) {
          if (hash[args[i]] === undefined) created++;
          hash[args[i]] = args[i + 1];
        }
      }
    }

    return created;
  }

  async _hgetall(key) {
    this._logCall("hgetall", [key]);

    const hash = this._data.get(key);
    return hash && typeof hash === "object" ? hash : null;
  }

  async _hdel(key, ...fields) {
    this._logCall("hdel", [key, ...fields]);

    const hash = this._data.get(key);
    if (!hash || typeof hash !== "object") return 0;

    let deleted = 0;
    for (const field of fields) {
      if (hash[field] !== undefined) {
        delete hash[field];
        deleted++;
      }
    }

    if (Object.keys(hash).length === 0) {
      this._data.delete(key);
    }

    return deleted;
  }

  // ===== KEYS =====
  async _keys(pattern) {
    this._logCall("keys", [pattern]);

    const regex = this._patternToRegex(pattern);
    const keys = [];

    for (const key of this._data.keys()) {
      if (regex.test(key)) {
        keys.push(key);
      }
    }

    return keys;
  }

  // ===== INCR/DECR =====
  async _incr(key) {
    this._logCall("incr", [key]);

    const current = parseInt(this._data.get(key) || "0", 10);
    const newValue = current + 1;
    this._data.set(key, newValue.toString());

    return newValue;
  }

  async _decr(key) {
    this._logCall("decr", [key]);

    const current = parseInt(this._data.get(key) || "0", 10);
    const newValue = current - 1;
    this._data.set(key, newValue.toString());

    return newValue;
  }

  // ===== PUB/SUB =====
  async _publish(channel, message) {
    this._logCall("publish", [channel, message]);

    const subscribers = this._subscribers.get(channel) || [];
    let count = 0;

    for (const subscriber of subscribers) {
      subscriber(channel, message);
      count++;
    }

    return count;
  }

  async _subscribe(channel, callback) {
    this._logCall("subscribe", [channel]);

    if (!this._subscribers.has(channel)) {
      this._subscribers.set(channel, []);
    }

    this._subscribers.get(channel).push(callback);
    return "OK";
  }

  _on(event, listener) {
    this._logCall("on", [event]);

    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(listener);
    return this;
  }

  // ===== STREAMS =====
  async _xadd(stream, id, ...fields) {
    this._logCall("xadd", [stream, id, ...fields]);

    if (!this._streams.has(stream)) {
      this._streams.set(stream, []);
    }

    const entry = { id: id === "*" ? Date.now().toString() : id };
    for (let i = 0; i < fields.length; i += 2) {
      entry[fields[i]] = fields[i + 1];
    }

    this._streams.get(stream).push(entry);
    return entry.id;
  }

  async _xread(count, block, streams) {
    this._logCall("xread", [count, block, streams]);

    const result = [];

    for (const [stream, lastId] of Object.entries(streams)) {
      const streamData = this._streams.get(stream) || [];
      const entries = streamData.filter((entry) => entry.id > lastId);

      if (entries.length > 0) {
        result.push([stream, entries]);
      }
    }

    return result.length > 0 ? result : null;
  }

  // ===== UTILITIES =====
  async _flushall() {
    this._logCall("flushall", []);

    this._data.clear();
    this._expirations.clear();
    this._streams.clear();
    this._pubsub.clear();
    this._subscribers.clear();

    return "OK";
  }

  _patternToRegex(pattern) {
    const regexStr = pattern
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".")
      .replace(/\[([^\]]+)\]/g, "[$1]");

    return new RegExp(`^${regexStr}$`);
  }

  _logCall(method, args) {
    this._callLog.push({
      method,
      args,
      timestamp: Date.now(),
    });
  }

  // ===== TEST UTILITIES =====
  mockResponse(method, response) {
    this._mockResponses.set(method, response);
    return this;
  }

  loadTestData(data) {
    Object.entries(data).forEach(([key, value]) => {
      this._data.set(key, value);
    });
    return this;
  }

  reset() {
    this._data.clear();
    this._expirations.clear();
    this._streams.clear();
    this._pubsub.clear();
    this._subscribers.clear();
    this._callLog = [];
    this._mockResponses.clear();
    return this;
  }

  getCallHistory() {
    return [...this._callLog];
  }

  getLastCall(method) {
    const calls = this._callLog.filter((call) => call.method === method);
    return calls.length > 0 ? calls[calls.length - 1] : null;
  }

  emit(event, ...args) {
    const listeners = this._listeners[event] || [];
    listeners.forEach((listener) => listener(...args));
    return this;
  }

  hasKey(key) {
    return this._data.has(key);
  }

  getStore() {
    return {
      data: Object.fromEntries(this._data),
      expirations: Object.fromEntries(this._expirations),
      streams: Object.fromEntries(this._streams),
    };
  }
}

// ===== PIPELINE MOCK =====
class PipelineMock {
  constructor(redisMock) {
    this.redis = redisMock;
    this.commands = [];
    this.exec = vi.fn(async () => {
      const results = [];
      for (const cmd of this.commands) {
        try {
          const result = await this.redis[cmd.method](...cmd.args);
          results.push([null, result]);
        } catch (error) {
          results.push([error, null]);
        }
      }
      return results;
    });
  }

  get(...args) {
    this.commands.push({ method: "get", args });
    return this;
  }

  set(...args) {
    this.commands.push({ method: "set", args });
    return this;
  }

  setex(...args) {
    this.commands.push({ method: "setex", args });
    return this;
  }

  del(...args) {
    this.commands.push({ method: "del", args });
    return this;
  }

  expire(...args) {
    this.commands.push({ method: "expire", args });
    return this;
  }
}

// ===== MULTI/TRANSACTION MOCK =====
class MultiMock extends PipelineMock {
  constructor(redisMock) {
    super(redisMock);
  }
}

function createRedisMock(config = {}) {
  return new RedisMock(config);
}

const redis = createRedisMock();

export default redis;
