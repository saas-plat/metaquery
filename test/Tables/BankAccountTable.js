const {
  MetaTable,
  DataTable,
} = require('../../lib');

module.exports = (options)=> createModel(DataTable, 'BankAccountTable',{
  "Code": {type:"string",mapping:'code'},
  "Name": {type:"string",mapping:'name'},
  "NewBalance": "number"
}, options)
