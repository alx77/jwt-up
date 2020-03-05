const Redis = require("promise-redis");
const cfg = require("../common/config");

class RedisHelper {
  constructor(host, port) {
    this.connection = { host, port };
    var self = this;
    return new Proxy(this, {
      get(target, propKey) {
        return function() {
          let fun = self[propKey];
          if (fun instanceof Function) {
            return fun.apply(self, arguments);
          }
          var client = self.getInstance();
          if (!(client[propKey] instanceof Function)) {
            throw new Error(`'${propKey}' is not a Redis function`);
          }
          return client[propKey].apply(client, arguments);
        };
      }
    });
  }

  getInstance() {
    if (this.client) return this.client;
    this.client = Redis().createClient(this.connection);
    this.client.on("error", e => {
      throw e;
    });
    return this.client;
  }

  close() {
    if (!this.client) return;
    var self = this;
    return new Promise((res, rej) => {
      self.client.on("end", err => (err && rej(err)) || res());
      self.client.quit();
      delete self.client;
    });
  }
}

module.exports = new RedisHelper(cfg.get("REDIS_HOST"), cfg.get("REDIS_PORT"));
