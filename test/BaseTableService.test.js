const {
  DataTableService
} = require('../lib');
const {
  expect
} = require('chai');
const util = require('util');
const mongoose = require('mongoose');

describe('数据查询基础服务', () => {

  before(async () => {
   await mongoose.connection.db.collection('WarehouseTable.tables').deleteMany();
  })

  it('接收业务对象(简单对象、层级关系对象、带分类列表对象、复合对象)事件生成数据对象，可以查询数据', async () => {
    const WarehouseTable = require('./Tables/WarehouseTable')();
    const service = new DataTableService(WarehouseTable);
    await service.onSaved({
      ID: 'aaaa001',
      Name: 'test001',
      Code: '0001',
      Ts: new Date().getTime().toString()
    });
    let doc = await WarehouseTable.findOne({
      ID: 'aaaa001'
    });
    expect(doc.Name).to.be.eql('test001');
    await service.onStatusUpdated({
      ID: 'aaaa001',
      Status: 'ok',
      Ts: new Date().getTime().toString()
    });
    doc = await WarehouseTable.findOne({
      ID: 'aaaa001'
    });
    expect(doc.Status).to.be.eql('ok');
    await service.onDeleted({
      ID: 'aaaa001',
    });
    doc = await WarehouseTable.findOne({
      ID: 'aaaa001'
    });
    expect(doc).to.be.null;
  });

  it('引用数据保存时存id，但是查询时可以填充完整数据', async () => {

  })

})
