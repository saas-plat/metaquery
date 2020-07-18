module.exports = {
  db: require('./db'),
  ...require('./Error'),
  ...require('./Event'),
  ...require('./MetaTable'),
  ...require('./Tables'),
  ...require('./Services'),
  ...require('./Migration'),
  Tables: require('./Tables'),
  Services: require('./Services'),
}

require('./MetaTable').register(require('./Tables'));
