const metaschema = require('@saas-plat/metaschema');
const {
  connect,
  disconnect
} = require('../lib/db');
const {
  MetaTable
} = require('../lib');

global.createModel = (Type, name, schema, opts = {}) => {
  console.log(Type.name, '...')
  const model = metaschema[Type.name === 'BaseTable' ? 'Table' : Type.name](name, schema);
  return MetaTable.createModel(model.name, model.schema, opts);
}

before(async () => {
  await connect({
    data: true,
    entity: true
  });
})

after(async () => {
  await setTimeout(async () => await disconnect({
    data: true,
    entity: true
  }), 100)
})
