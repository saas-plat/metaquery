const {
  db,
  Document,
  MetaTable,
  BaseTable,
  DataMigration
} = require('../lib');
const {
  expect
} = require('chai');
const util = require('util');
const mongoose = require('mongoose');

describe('数据迁移', () => {

  before(async () => {
    const db =  mongoose.connection.db;

    const tkeys = [ns + '.DataTable2'];
    for (const key of tkeys) {
      const tables = db.collection(key + '.tables');
      if (await tables.countDocuments() > 0) {
        await tables.deleteMany();
      }
    }
  })

  const ns = 'test001'



  it('数据表字段修改和数据迁移', async () => {
    const DataTable1 = createModel(BaseTable, 'DataTable2', {
      "id": "string",
      "Name": "string",
      "Str1": {
        type: 'string',
      },
      "Date": "date",
      "Value": {
        type: 'number',
      },
      "Bool1": 'boolean', // 布尔
      "Ref": 'mixed',
      "Obj1": { // 对象类型
        "Code": "string",
        "Name": "string"
      },
      'Details': [{ // 子表
        "Value": "number",
        "REF": {
          "id": "string",
          "Code": "string",
          "Name": "string"
        }
      }]
    },  {
      ns
    });

    const dt1 = new DataTable1({
      id: 'aaaa',
      Name: 'test001',
      Str1: 'abcxyz',
      Bool1: true,
      Obj1: {
        Code: 'eeeeeeeeee',
        Name: 'nnnn'
      },
      Value: 100,
      Ref1: {
        id: '100'
      },
      Details: [{
        REF: {
          id: 'xxxxx',
          Name: 'aaaa'
        },
        Value: 100
      }]
    });
    await dt1.save();
    expect(dt1.get('Details')).to.not.undefined;

    // 修改schame
    const DataTable2 = createModel(BaseTable, "DataTable2", {
      "id": "string",
      "Code": "string",
      "Obj1": {
        "Code": "string",
        "Name2": "string"
      },
      "Value": 'string',
      'Details': [{ // 子表
        "REF": {
          "Name": "string"
        }
      }]
    },  {
      ns,
      version: 'v2'
    })

    const migration = new DataMigration([DataTable1], [DataTable2]);
    //await db.lock(ns);
    migration.onAction(objs=>{
      const b = objs.find(d=> d instanceof DataTable2);
      const d = objs.find(d=> d instanceof Document);
      const e = objs.find(e=>e.name === 'DataTable2.migrate');
      if ( e.name === 'DataTable2.migrate'){
        d.Code = e.data.Name;
        if (b !== d){
          throw 1
        }
      }
    })
    await migration.up();
    // [`rule update_sciprt1{
    //   when{
    //     e: Action e.name == 'DataTable2.migrate' ;
    //     d: Document  ;
    //   }
    //   then{
    //       console.log('===>',e.data);
    //       d.Code = e.data.Name ;
    //   }
    // }`]
    //await db.unlock(ns);

    // 检查升级效果
    const d12 = await DataTable2.findOne({
      id: dt1.id
    });
    console.log(JSON.stringify(d12.toObject(),  1))
    expect(d12.Code).to.be.eql('test001');
    expect(d12.toObject().Details[0]).to.be.eql({
      "REF": {
        "Name": "aaaa"
      }
    });

  })

  it('升级时锁定禁止提交和修改数据表', async () => {})

  // it('实体和数据表对象可以缓存，在版本更新后可以重建', async () => {})

  it('实体版本更新，由一个实体拆分多个实体，或有多个实体合并成一个实体', async () => {

  })

  it('数据表更新，拆分多个表，或合并一张表', async () => {

  })

  it('备份升级失败后可以恢复正常使用', async () => {


    const DataTable1 = createModel(BaseTable, "DataTable2", {
      "id": "string",
      "Code": "string",
      "Obj1": {
        "Code": "string",
        "Name2": "string"
      },
      'Details': [{ // 子表
        "REF": {
          "Name": "string"
        }
      }]
    },  {
      ns
    })

    // ----------- v2 ---------------

    const DataTable2 = createModel(BaseTable, "DataTable2", {
      "id": "string",
      "Code": "string",
      "Obj1": {
        "Code": "string",
        "Name2": "string"
      },
      'Details': [{ // 子表
        "REF": {
          "Name": "string"
        }
      }]
    },  {
      ns,
      version: 'v2'
    })


    const datamigration = new DataMigration([DataTable1], [DataTable2]);
    await datamigration.backup();
    try {
      datamigration.onAction(()=>{
        throw 'error'
      })
      await datamigration.up();
    //   [`rule update_sciprt1{
    //   when{
    //     e: Action e.name == 'DataTable2.migrate';
    //     d: Document;
    //   }
    //   then{
    //     throw 'error'
    //   }
    // }`]
    } catch (err) {
      console.log(err)
      await datamigration.rollback();
    }

    await datamigration.dropback();

  })
})
