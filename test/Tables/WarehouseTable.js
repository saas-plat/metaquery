const {
	MetaTable,
	DataTable,
} = require('../../lib');

module.exports = (options)=> createModel(DataTable, 'WarehouseTable', {
	ID: {
		type: 'string',
		mapping: 'id'
	},
  Name: 'string',
  Code: {
    type:'string',
    unique: true
  },
	Status: 'string',
	Ts: {
		type: 'string',
		mapping: 'ts'
	},
}, options)
