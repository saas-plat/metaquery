module.exports = {
  db: require('./db'),
  ...require('./Error'),
  ...require('./Event'),
  ...require('./MetaTable'),
  ...require('./Tables'),
  ...require('./DataServices'),
  ...require('./DataMigration'),
  Tables: require('./Tables'),
  DataServices: require('./DataServices'),
}

require('./MetaTable').register(require('./Tables'));
