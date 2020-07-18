# metaquery
通过元数据定义查询对象提供数据服务

## 定义查询对象
```js
const {
  MetaTable
} = require('@saas-plat/metaquery');

const BankAccountTable = MetaTable.createModel('BankAccountTable',{
  fields:{
    "Code": {type:"string",mapping:'code'},
    "Name": {type:"string",mapping:'name'},
    "NewBalance": "number"
  }
});
```

## 查询对象类型与服务

- 数据表
- 汇总表
- 树表
- 联合表



## 数据迁移
```js
const datamigration = new Migration([BankAccountTable1], [BankAccountTable2]);
await datamigration.backup();
datamigration.onAction(()=>{
  // 升级规则
  ...
})
await datamigration.up('v1','v2');
await datamigration.dropback();
```
