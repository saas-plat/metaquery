const {
  readonly,
  readonlyDeep
} = require('./util');

const Event = exports.Event = class Event {
  constructor(name, data = {}) {
    readonly(this, 'data', data);
    readonly(this, 'name', name);
  }
}

const Action = exports.Action = class Action {
  constructor(name, data = {}, opts) {
    readonlyDeep(this, 'data', data);
    readonly(this, 'name', name);
    if (opts) {
      Object.keys(opts).forEach(key => {
        readonly(this, key, opts[key]);
      })
    }
  }

  toString() {
    return this.name;
  }
}
