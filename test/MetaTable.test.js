const {
  BaseTable,
  TableCache,
  MetaTable
} = require('../lib');
const {
  expect
} = require('chai');
const util = require('./util');
const mongoose = require('mongoose');
const {
  Table
} = require('@saas-plat/metaschema');

describe('数据表', () => {

  before(async () => {
    await mongoose.connection.db.collection('tables.DataTableForMerge.tables').deleteMany();
  })

  it('元数据定义，支持description等', async () => {

    const TestModel = createModel(BaseTable, 'TestModel', {
      "id": "string",
      "Code": "string",
      "Str1": {
        type: 'string',
        description: '这是一个字符串'
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
        "REF2": {
          "id": "string",
          "Code": "string",
          "Name": "string"
        }
      }]
    }, {
      description: '测试Model'
    });
    //const  {name, description, fields} = TestMode.schema.paths
    expect(TestModel.schema.path('Str1').options.description).to.be.eq('这是一个字符串');
    //console.log({name, description, fields})

  });

  it('创建一个简单数据表，可以增删改数据', async () => {

    await mongoose.connection.db.collection('DataTable1.tables').deleteMany();

    const DataTable1 = createModel(BaseTable, 'DataTable1', {
      "id": "string",
      "Code": "string",
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
        "REF2": {
          "id": "string",
          "Code": "string",
          "Name": "string"
        }
      }]
    });

    const dt1 = new DataTable1({
      id: 'aaaa',
      Name: 'test001',
      Str1: 'abcxyz',
      Bool1: true,
      Obj1: {
        Code: 'eeeeeeeeee'
      },
      Ref1: {
        id: '100'
      },
      Details: [{
        REF2: {
          id: 'xxxxx'
        },
        Value: 100
      }]
    });
    await dt1.save();
    //await DataTable1.commitAll();

    await DataTable1.findOneAndUpdate({
      id: 'aaaa'
    }, {
      $addToSet: {
        Details: [{
          REF2: {
            id: 'xxxxx'
          },
          Value: 200
        }]
      }
    });

    await DataTable1.findOneAndUpdate({
      id: 'aaaa'
    }, {
      id: 'aaaa',
      Value: 100
    });

  });

  it('只创建一个Schame给gql生成类型用', async () => {
    await mongoose.connection.db.collection('DataTable1.tables').deleteMany();

    const DataTable1 = Table('DataTable1', {
      "id": "string",
      "Code": "string",
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
        "REF2": {
          "id": "string",
          "Code": "string",
          "Name": "string"
        }
      }]
    });

  })

  it('相同schema模型，不同租户需要通过集合隔离', async () => {

    await mongoose.connection.db.collection('org001.SamellModel.tables').deleteMany();
    await mongoose.connection.db.collection('org002.SamellModel.tables').deleteMany();

    const schema = {
      "Name": "string",
    }

    const SamellModel1 = createModel(BaseTable, 'SamellModel', schema, {
      ns: 'org001'
    });

    await new SamellModel1({
      Name: 'aaaaa',
    }).save();

    console.log('----------------')

    expect((await SamellModel1.find({
      Name: 'aaaaa'
    })).map(it => it.toObject())).to.be.eql([{
      Name: 'aaaaa'
    }])

    const SamellModel2 = createModel(BaseTable, 'SamellModel', schema, {
      ns: 'org002'
    });

    expect((await SamellModel1.find({
      Name: 'aaaaa'
    })).map(it => it.toObject())).to.be.eql([{
      Name: 'aaaaa'
    }])

    expect((await SamellModel2.find({
      Name: 'aaaaa'
    })).map(it => it.toObject())).to.be.eql([])
  })

  it('不同租户支持ns字段进行数据隔离，ns字段在查询或者保存时由中间件注入', async () => {
    await mongoose.connection.db.collection('org001.TableNS1.tables').deleteMany();
    await mongoose.connection.db.collection('org002.TableNS1.tables').deleteMany();

    const schema = {
      "Name": "string",
      "Other": "number"
    }

    const TableNS1 = createModel(BaseTable, 'TableNS1', schema, {
      ns: 'org001'
    });
    const TableNS2 = createModel(BaseTable, 'TableNS1', schema, {
      ns: 'org002'
    });

    await new TableNS1({
      Name: 'aaaaa',
    }).save();
    await new TableNS2({
      Name: 'bbbbb',
    }).save();

    expect(await TableNS1.count()).to.be.eql(1);
    expect(await TableNS2.count()).to.be.eql(1);

    expect((await TableNS1.find()).length).to.be.eql(1);
    expect((await TableNS2.find()).length).to.be.eql(1);

    expect(await TableNS1.findOne({
      Name: 'bbbbb'
    })).to.be.null;
    expect(await TableNS2.findOne({
      Name: 'aaaaa'
    })).to.be.null;

    expect(await TableNS1.findOneAndUpdate({
      Name: 'bbbbb'
    }, {})).to.be.null;
    expect(await TableNS2.findOneAndUpdate({
      Name: 'aaaaa'
    }, {})).to.be.null;

    expect((await TableNS1.findOneAndUpdate()).toObject()).to.be.eql({
      Name: 'aaaaa',
    }, {});
    expect((await TableNS2.findOneAndUpdate()).toObject()).to.be.eql({
      Name: 'bbbbb',
    }, {});

    expect((await TableNS1.find()).length).to.be.eql(1);
    expect((await TableNS2.find()).length).to.be.eql(1);

    expect(await TableNS1.findOneAndRemove({
      Name: 'bbbbb'
    })).to.be.null;
    expect(await TableNS2.findOneAndRemove({
      Name: 'aaaaa'
    })).to.be.null;

    expect((await TableNS1.find()).length).to.be.eql(1);
    expect((await TableNS2.find()).length).to.be.eql(1);

    // update
    await TableNS1.update({
      Name: 'aaaaa',
    }, {
      //  Name: 'aaaaa',
      Other: 100
    });
    await TableNS2.update({
      Name: 'bbbbb',
    }, {
      //Name: 'bbbbb',
      Other: 200
    });
    expect((await TableNS1.findOne()).toObject()).to.be.eql({
      Name: 'aaaaa',
      Other: 100
    });
    expect((await TableNS2.findOne()).toObject()).to.be.eql({
      Name: 'bbbbb',
      Other: 200
    });
    expect((await TableNS1.find()).length).to.be.eql(1);
    expect((await TableNS2.find()).length).to.be.eql(1);
    expect(await TableNS1.findOne({
      Name: 'bbbbb'
    })).to.be.null;
    expect(await TableNS2.findOne({
      Name: 'aaaaa'
    })).to.be.null;

    // updateOne
    await TableNS1.updateOne({
      Name: 'aaaaa',
    }, {
      Other: 101
    });
    await TableNS2.updateOne({
      Name: 'bbbbb',
    }, {
      Other: 201
    });
    expect((await TableNS1.findOne()).toObject()).to.be.eql({
      Name: 'aaaaa',
      Other: 101
    });
    expect((await TableNS2.findOne()).toObject()).to.be.eql({
      Name: 'bbbbb',
      Other: 201
    });
    expect((await TableNS1.find()).length).to.be.eql(1);
    expect((await TableNS2.find()).length).to.be.eql(1);

    // replaceOne
    await TableNS1.replaceOne({
      Name: 'aaaaa',
    }, {
      Name: 'aaaaa',
      Other: 101
    });
    await TableNS2.replaceOne({
      Name: 'bbbbb',
    }, {
      Name: 'bbbbb',
      Other: 201
    });
    expect((await TableNS1.findOne()).toObject()).to.be.eql({
      Name: 'aaaaa',
      Other: 101
    });
    expect((await TableNS2.findOne()).toObject()).to.be.eql({
      Name: 'bbbbb',
      Other: 201
    });
    expect((await TableNS1.find()).length).to.be.eql(1);
    expect((await TableNS2.find()).length).to.be.eql(1);

    //bulkWrite
    //geoSearch
    //insertMany
    await TableNS1.insertMany([{
      Name: 'cccc'
    }, {
      Name: 'dddd'
    }])
    // updateMany
    await TableNS1.updateMany({
      Name: 'cccc'
    }, {
      Other: 300
    })
    //aggregate
    await TableNS1.aggregate()
  })

  it('同时支持多版本的相同数据对象，相同版本采用存储隔离', async () => {

    const VersionModel = createModel(BaseTable, 'VersionModel', {
      name: 'string'
    }, {
      version: '1'
    });
    const VersionModel2 = createModel(BaseTable, 'VersionModel', {
      name: 'string',
      code: 'string'
    }, {
      version: '2'
    });
    const VersionModel1 = createModel(BaseTable, 'VersionModel', {
      name: 'string'
    }, {
      version: '1'
    });

    expect(VersionModel).to.be.equal(VersionModel1);
    expect(VersionModel).to.not.equal(VersionModel2);

    const VersionModel_org001 = createModel(BaseTable, 'VersionModel', {
      name: 'string'
    }, {
      version: '1',
      ns: 'org001'
    });

    expect(VersionModel).to.not.equal(VersionModel_org001);
    expect(VersionModel_org001).to.not.equal(VersionModel);

    // 继承关系
    //expect(VersionModel_org001).to.not.equal(VersionModel);

    TableCache.ttl('VersionModel_1', .3);
    TableCache.ttl('VersionModel_2', .3);

    // 3s后回收
    await util.wait(200);
    const VersionModel22 = createModel(BaseTable, 'VersionModel', {
      name: 'string',
      code: 'string'
    }, {
      version: '2'
    });
    await util.wait(200);

    const VersionModel11 = createModel(BaseTable, 'VersionModel', {
      name: 'string'
    }, {
      version: '1'
    });
    const VersionModel222 = createModel(BaseTable, 'VersionModel', {
      name: 'string',
      code: 'string'
    }, {
      version: '2'
    });
    expect(VersionModel2).to.be.equal(VersionModel222);
    expect(VersionModel).to.not.equal(VersionModel11);

  })

  it('支持合并存储', async () => {

    await mongoose.connection.db.collection('DataTableForMerge.tables').deleteMany();

    const DataTable1 = createModel(BaseTable, 'DataTableForMerge', {
      "id": "string",
      "Code": "string",
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
        "REF2": {
          "id": "string",
          "Code": "string",
          "Name": "string"
        }
      }]
    }, {
      prefix: 'tables',
      ns: 'orgmerge',
      splitCollection: false
    });

    const DataTable2 = createModel(BaseTable, 'DataTableForMerge', {
      "id": "string",
      "Code": "string",
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
        "REF2": {
          "id": "string",
          "Code": "string",
          "Name": "string"
        }
      }]
    }, {
      prefix: 'tables',
      ns: 'orgmerge2',
      splitCollection: false
    });

    let dt1 = new DataTable1({
      id: 'aaaa',
      Name: 'test001',
      Str1: 'abcxyz',
      Bool1: true,
      Obj1: {
        Code: 'eeeeeeeeee'
      },
      Ref1: {
        id: '100'
      },
      Details: [{
        REF2: {
          id: 'xxxxx'
        },
        Value: 100
      }]
    });
    await dt1.save();
    //await DataTable1.commitAll();

    console.log('---------2------------')
    let dt2 = new DataTable2({
      id: 'aaaa',
      Name: 'test001',
      Str1: 'abcxyz',
      Bool1: true,
      Obj1: {
        Code: 'eeeeeeeeee'
      },
      Ref1: {
        id: '100'
      },
      Details: [{
        REF2: {
          id: 'xxxxx'
        },
        Value: 100
      }]
    });
    await dt2.save();

    expect(await DataTable1.count({
      id: 'aaaa'
    })).to.be.eql(1);
    expect(await DataTable2.count({
      id: 'aaaa'
    })).to.be.eql(1);
  });

  it('可以通过schema自定义一个行为', async () => {

    const CustomeSchemaAction = createModel(BaseTable, 'CustomeSchemaAction', {
      "Name": "string",
      "dosomething": async function () { // <==== 这里不能用箭头函数要不this就不是Model啦
        return await this.find({

        })
      }
    });

    await new CustomeSchemaAction({
      Name: 'aaaaa',
    });

    await CustomeSchemaAction.dosomething();

  })

  it('一个数据对象可以执行行为产生的事件规则', async () => {
    await mongoose.connection.db.collection('TableWithRules.tables').deleteMany();
    const TableWithRules = createModel(BaseTable, 'TableWithRules', {
      "Name": "string",
      "findByName": async function (name) {
        return await this.find({
          Name: name
        })
      }
    }, {
      actionHandler: objs => {
        console.log(1, ...objs)
        if (objs.some(it => it.Name === 'cccc')) {
          objs.find(it => it.Name === 'cccc').Name = 'bbbb'
        }
      }
    });

    const a = await new TableWithRules({
      Name: 'cccc'
    });
    const b = await new TableWithRules({
      Name: 'aaaaa',
    });
    await a.save();
    await b.save();

    expect((await TableWithRules.find({})).length).to.be.eql(2);
    expect((await TableWithRules.findByName('aaaaa')).length).to.be.eql(1);
    expect((await TableWithRules.findByName('bbbb')).length).to.be.eql(1);
  })

  it('自定义validator校验器的支持', async () => {
    await mongoose.connection.db.collection('TableWithValidator.tables').deleteMany();
    const TableWithValidator = createModel(BaseTable, 'TableWithValidator', {
      "Name": {
        type: "string",
        validator: (r, v) => v === 'bbb'
      },
    });

    let ok = true;
    try {
      const a = await new TableWithValidator({
        Name: 'aaa'
      });
      await a.save();
      ok = false;
    } catch (e) {
      console.log(e.message)
    }
    if (!ok) {
      expect.fail('!not validator');
    }
    const b = await new TableWithValidator({
      Name: 'bbb'
    });
    await b.save();
  })

})
