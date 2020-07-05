const {
  readonly 
} = require('./util');
const _ = require('lodash');

const EventData = exports.EventData = class EventData {
  constructor(data) {
    this.fromJS(data);
  }

  toJS() {
    return _.cloneDeep(this);
  }

  fromJS(data) {
    _.merge(this, data);
  }
}

const Event = exports.Event = class Event {
  constructor(name, data = {}) {
    readonly(this, 'data', data);
    readonly(this, 'name', name);
  }
}

const Action = exports.Action = class Action {
  constructor(name, data = {}) {
    readonly(this, 'data', data);
    readonly(this, 'name', name);
  }
}
