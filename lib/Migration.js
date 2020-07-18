const {
  t
} = require('./i18n');
const util = require('util');
const _ = require('lodash');
const {
  readonly,
  unset,
  dropCollection
} = require('./util');
const mongoose = require('mongoose');
const debug = require('debug')('saas-plat:Migration');
const {
  Action
} = require('./Event');
const moment = require('moment');
const conn = mongoose.connection;
const BATCH = 10;

exports.Migration = class Migration {

  constructor(migrationTypes, newTypes) {
    this.migrationTypes = migrationTypes;
    this.newTypes = newTypes;
  }

  async dropback({
    backId,
  } = {}) {
    for (const model of this.migrationTypes) {
      debug('drop %s backup...', model.name, (backId || this.backId));
      const db = model.db.db;
      const backups = db.collection(model.collection.name + '.' + (backId || this.backId));
      await dropCollection(backups);
      debug('drop %s', backups.collectionName);
    }
  }

  async backup({
    force = false
  } = {}) {
    this.backId = moment().format('YYYYMMDDHHmmss');
    for (const model of this.migrationTypes) {
      const db = model.db.db;
      const tables = db.collection(model.collection.name);
      const backups = db.collection(model.collection.name + '.' + this.backId);
      debug('start %s backup...', model.collection.name + '.' + this.backId);
      const exists = await backups.countDocuments();
      if (exists > 0 && !force) {
        throw new BizError(t('备份失败，集合已经存在且不为空'));
      }
      await dropCollection(backups);
      debug('drop %s', backups.collectionName);
      // 本地克隆，不带索引
      const inserts = [];
      let counter = 0;
      const cur = tables.find().batchSize(BATCH);
      let it = await cur.next();
      while (it) {
        inserts.push(it);
        if (inserts.length >= BATCH) {
          await backups.insertMany(inserts);
          inserts.length = 0;
          counter += inserts.length;
        }
        it = await cur.next();
      }
      if (inserts.length > 0) {
        await backups.insertMany(inserts);
        counter += inserts.length;
        inserts.length = 0;
      }
      debug('backup %s count', model.collection.name, counter);
    }
    return this.backId;
  }

  async rollback({
    backId,
    dropBackupCollection = true
  } = {}) {
    for (const model of this.migrationTypes) {
      debug('start %s rollback...', model.name, (backId || this.backId));
      const db = model.db.db;
      const tables = db.collection(model.collection.name);
      const backups = db.collection(model.collection.name + '.' + (backId || this.backId));
      // 删除数据和索引
      await dropCollection(tables);
      debug('drop %s', tables.collectionName);
      // 重建索引
      await model.init();
      // 恢复数据
      const inserts = [];
      let counter = 0;
      const cur = backups.find().batchSize(BATCH);
      let it = await cur.next();
      while (it) {
        inserts.push(it);
        if (inserts.length >= BATCH) {
          await tables.insertMany(inserts);
          inserts.length = 0;
          counter += inserts.length;
        }
        it = await cur.next();
      }
      if (inserts.length > 0) {
        await tables.insertMany(inserts);
        counter += inserts.length;
        inserts.length = 0;
      }
      debug('rollback %s count', model.collection.name, counter);

      if (dropBackupCollection) {
        await dropCollection(backups);
        debug('drop %s', backups.collectionName);
      }
    }
  }

  async up(fromVersion, toVersion) {
    this.upCounter = 0;
    for (const tableType of this.migrationTypes) {
      debug('start %s data migration...', tableType.name);
      await this._migrationTables(tableType, fromVersion, toVersion);
    }
  }

  async _migrationTables(model, fromVersion, toVersion) {
    const actions = [model.schema.get('name') + '.migrate',
      model.schema.get('schema').type + '.migrate',
      'migrate'
    ];
    if (model.schema.get('ns')) {
      actions.push(
        model.schema.get('ns') + '.' + model.schema.get('name') + '.migrate',
        model.schema.get('ns') + '.' + model.schema.get('schema').type + '.migrate');
    }
    const batchSize = 10;
    const cur = model.find({
      _ns: model.schema.get('ns')
    }, null, {
      batchSize
    }).cursor();
    // 迁移事件
    let doc = await cur.next();
    while (doc) {
      // 执行升级
      debug('execute data %s migration...', doc._id);
      const NewModel = this.newTypes.find(type => type.name === model.name);
      if (!NewModel) {
        // 执行自定义规则
        await this._migrateAction(actions, oldData, fromVersion, toVersion);
        debug('data delete...', doc._id);
        await doc.remove();
        this.upCounter++;
      } else {
        // 需要手动删除多余字段
        const oldData = doc.toObject();
        const rmFields = unset(oldData, NewModel.schema.get('schema').fields);
        debug('unset fields:', rmFields);
        let isUpdated = false;
        if (Object.keys(rmFields).length > 0) {
          await (model.collection.updateOne({
            _id: doc._id
          }, {
            $unset: rmFields
          }));
          isUpdated = true;
        }
        // 所有已经删除的字段也会加载到doc
        // 不需要类型转换，Model自动会转换，不能自动转换会报验证错误
        const upDoc = await NewModel.findById(doc._id);
        //debug(doc._id,NewModel.collection.name,doc.collection.name)
        // 执行自定义规则
        await this._migrateAction(actions, oldData, fromVersion, toVersion, upDoc);
        // 需要更新
        if (upDoc.isModified()) {
          isUpdated = true;
        }
        if (isUpdated) {
          debug('data update...', doc._id);
          await upDoc.save();
          this.upCounter++;
        }
      }
      doc = await cur.next();
    }
  }

  onAction(handle) {
    this._onAction = handle;
  }

  async _migrateAction(actions, data, fromVersion, toVersion, doc) {
    if (!this._onAction) {
      return data;
    }

    await this._onAction([
      ...actions.map(action => new Action(action, data, {
        from: fromVersion,
        to: toVersion
      })),
      doc
    ]);
  }
}
