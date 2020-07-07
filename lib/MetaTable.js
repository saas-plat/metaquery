const debug = require('debug')('saas-plat:MetaTable');
const _ = require('lodash');
const i18n = require('./i18n');
const mongoose = require('mongoose');
const moment = require('moment');
const {
  Action
} = require('./Event');
const {
  createMappingProps
} = require('@saas-plat/metaschema/lib/Schema');
const NodeCache = require("node-cache");

const defOptions = {
  strict: true,
  useNestedStrict: true,
  minimize: false, // 保存空对象
  timestamps: false, // 不生成
  versionKey: false, // 不需要
  toJSON: {
    virtuals: false,
    transform: function (doc, ret, options) {
      doc.schema.get('schema').cutFields(ret);
      return ret;
    }
  },
  toObject: {
    virtuals: false,
    transform: function (doc, ret, options) {
      // 查询模式是没有定义fields??
      doc.schema.get('schema') && doc.schema.get('schema').cutFields(ret);
      // delete ret._ns;
      return ret;
    }
  }
}

const cache = exports.TableCache = new NodeCache({
  stdTTL: process.env.TABLE_TIMEOUT || 60 * 60, // 1h
  useClones: false,
});
cache.on("expired", function (key, value) {
  debug('%s table expired...', key);
  delete mongoose.modelSchemas[key];
});
cache.on("flush", function () {
  debug('table flush...');
});

// The permitted SchemaTypes are:
// String
// Number
// Date
// Buffer
// Boolean
// Mixed
// ObjectId
// Array
const createDbSchema = (obj) => {
  const mgschema = {};
  obj && obj.forEach(item => {
    const type = item.type;
    const key = item.key;
    const defValue = item.defValue;
    const rules = item.rules || {};
    const description = item.description;
    switch (type) {
    case 'id':
      mgschema[key] = {
        type: mongoose.Schema.Types.ObjectId,
      };
      break;
    case 'string':
      mgschema[key] = {
        type: String,
        default: defValue && String(defValue),
        lowercase: rules.lowercase && Boolean(rules.lowercase),
        uppercase: rules.uppercase && Boolean(rules.uppercase),
        trim: rules.trim && Boolean(rules.trim),
        match: rules.match && new RegExp(rules.match || rules.pattern),
        enum: rules.enum && Array(rules.enum)
      };
      break;
    case 'object':
      // 这个是 mixed
      // mgschema[key] = {
      //   type:   createDbSchema(item.fields),
      //   default: undefined
      // };
      mgschema[key] = createDbSchema(item.fields);
      break;
    case 'reference':
      mgschema[key] = {
        type: mongoose.Schema.Types.ObjectId,
        ref: item.src,
      };
      break;
    case 'array':
      const subtype = (item.subtype) || (
        item.fields && item.fields.length > 0 ?
        'object' :
        'mixed');
      let subsche;
      switch (subtype) {
      case 'id':
        subsche = {
          type: mongoose.Schema.Types.ObjectId
        };
        break;
      case 'string':
        subsche = {
          type: String,
          default: defValue && String(defValue),
          lowercase: rules.lowercase && Boolean(rules.lowercase),
          uppercase: rules.uppercase && Boolean(rules.uppercase),
          trim: rules.trim && Boolean(rules.trim),
          match: rules.match && new RegExp(rules.match || rules.pattern),
          enum: rules.enum && Array(rules.enum)
        };
        break;
      case 'object':
        // mixed改成子文档，要不gql无法查询子字段
        subsche = new mongoose.Schema(createDbSchema(item.fields), defOptions);
        break;
      case 'reference':
        subsche = {
          type: mongoose.Schema.Types.ObjectId,
          ref: item.src,
        };
        break;
      case 'array':
        subsche = {
          type: []
        };
        break;
      case 'number':
        subsche = {
          type: Number,
          default: defValue && Number(defValue),
          min: rules.min && Number(rules.min),
          max: rules.max && Number(rules.max)
        };
        break;
      case 'date':
        subsche = {
          type: Date,
          default: defValue && new Date(defValue),
          min: rules.min && Number(moment(rules.min).format()),
          max: rules.max && Number(moment(rules.max).format())
        };
        if (defValue === 'now') {
          subsche.default = Date.now;
        } else if (defValue) {
          subsche.default = moment(defValue).toDate();
        }
        break;
      case 'buffer':
        subsche = {
          type: Buffer
        };
        break;
      case 'boolean':
        subsche = {
          type: Boolean,
          default: defValue && Boolean(defValue)
        };
        break;
      case 'function':
        return;
      case 'mixed':
      default:
        subsche = {
          type: mongoose.Schema.Types.Mixed,
          default: defValue
        };
        break;
      }
      // if (type === 'string' || type === 'number' || type === 'date' || type === 'boolean') {
      //   subsche.index = item.index;
      //   subsche.unique = item.unique;
      //   subsche.sparse = item.sparse;
      // }
      mgschema[key] = {
        type: [subsche],
        default: undefined,
        description: description,
      };
      return; // 数组不需要额外处理
    case 'number':
      mgschema[key] = {
        type: Number,
        default: defValue && Number(defValue),
        min: rules.min && Number(rules.min),
        max: rules.max && Number(rules.max)
      };
      break;
    case 'date':
      mgschema[key] = {
        type: Date,
        min: rules.min && Number(moment(rules.min).format()),
        max: rules.max && Number(moment(rules.max).format())
      };
      if (defValue === 'now') {
        mgschema[key].default = Date.now;
      } else if (defValue) {
        mgschema[key].default = moment(defValue).toDate();
      }
      break;
    case 'buffer':
      mgschema[key] = {
        type: Buffer
      };
      break;
    case 'boolean':
      mgschema[key] = {
        type: Boolean,
        default: defValue && Boolean(defValue)
      };
      break;
    case 'function':
      return;
    case 'mixed':
    default:
      mgschema[key] = {
        type: mongoose.Schema.Types.Mixed,
        default: defValue
      };
      break;
    }
    if (type === 'string' || type === 'number' || type === 'date' || type === 'boolean') {
      mgschema[key].index = item.index;
      mgschema[key].unique = item.unique;
      mgschema[key].sparse = item.sparse;
    }
    mgschema[key].description = description;
    mgschema[key] = _.omitBy(mgschema[key], _.isUndefined);
  });
  return mgschema;
}

const createVirtualProps = (mgschema, mappings) => {
  _.keys(mappings).forEach(mkey => {
    const userkey = mappings[mkey];
    let getfn, setfn;
    getfn = () => {
      // debug(mkey, '<=', userkey)
      return this[userkey];
    }
    if (typeof userkey === 'string') {
      // 不需要映射
      if (userkey === mkey) {
        return;
      }
      setfn = (value) => {
        // debug(mkey, '=>', userkey)
        this[userkey] = value;
      }
    } else if (_.isArray(userkey)) {
      const submapping = userkey[0];
      setfn = (value) => {
        // debug(mkey, '=>', userkey)
        if (!value) {
          this[mkey] = value;
        } else {
          // 在model上设置虚拟key但是在子对象上需要采用get和set属性
          this[mkey] = _.toArray(value).map(it => createMappingProps(it, submapping));
        }
      }
    } else if (_.isPlainObject(userkey)) {
      setfn = (value) => {
        // debug(mkey, '=>', userkey)
        // 在model上设置虚拟key但是在子对象上需要采用get和set属性
        this[mkey] = createMappingProps(_.toPlainObject(value), userkey);
      }
    }
    const virtual = mgschema.virtual(mkey);
    virtual.get(getfn);
    virtual.set(setfn);
  });
}

const reduceSubPath = async (references, populateService, doc, subpaths, index = 0) => {
  const subpath = subpaths[index];
  if (index === subpaths.length - 1) {
    // 对象属性
    const kpath = subpath.startsWith('.') ? subpath.substr(1) : subpath;
    const id = _.get(doc, kpath);
    if (id) {
      const refdoc = await (await populateService(references[subpaths.join('[]')])).findById(id);
      doc.set(kpath, refdoc);
      if (doc[kpath] !== refdoc) {
        throw new Error(i18n.t('{{kpath}}引用类型无效', {
          kpath
        }));
      }
      debug('set %s=%o', kpath, refdoc);
    }
  } else {
    const docarr = _.get(doc, subpath);
    if (docarr) {
      if (subpaths[index + 1]) {
        // 数组中的对象的子属性
        for (const it of docarr) {
          await reduceSubPath(references, populateService, it, subpaths, index + 1);
        }
      } else {
        // 数组引用
        for (let i = 0; i < docarr.length; i++) {
          const id = docarr[i];
          if (id) {
            const refdoc = await (await populateService(references[subpaths.join('[]')])).findById(id);
            docarr[i] = refdoc;
            if (docarr[i] !== refdoc) {
              throw new Error(i18n.t('{{subpath}}[{{i}}]引用类型无效', {
                subpath,
                i
              }));
            }
            debug('populate %s[%n]=%o', subpath, i, refdoc);
          }
        }
      }
    }
  }
}

const populateReferencesHandler = async (references, populateService, ...docs) => {
  const paths = _.keys(references);
  for (const doc of docs) {
    if (doc) {
      debug('---- {%s} populate ----', doc._id);
      for (const path of paths) {
        // 这里是真对数组的拆分不是对象，拆分的每一项可以是一个对象路径
        const subpaths = path.split('[]')
        debug('%s populate...', path);
        await reduceSubPath(references, populateService, doc, subpaths);
        //debug(doc)
      }
      debug('---- {%s} END ----', doc._id);
    }
  }
}

const getReferenceModel = async (refName, prefix, ns, splitCollection, getReferenceVersion, checkVersion = false) => {
  const refVersion = getReferenceVersion ? (await getReferenceVersion(refName)) : null;
  if (checkVersion && !refVersion) {
    throw new Error(i18n.t('引用对象{{refName}}无法获取版本号', {
      refName
    }));
  }
  debug('find %s_%s reference...', refName, refVersion, ns);
  const versionedName = refName + (refVersion ? '_' + refVersion : '');
  const model = cache.get(versionedName);
  const collectionName = (prefix ? (prefix + '.') : '') +
    (ns && splitCollection !== false ? (ns + '.') : '') +
    refName + '.tables';
  if (ns !== model.ns) {
    debug('%s subclass...', versionedName, collectionName);
    const newSchema = model.schema.clone();
    //newSchema.set('getReferenceVersion', getReferenceVersion);
    const refmodel = model.__subclass(mongoose.connection, newSchema, collectionName);
    refmodel.ns = ns;
    model.getReferenceVersion = getReferenceVersion;
    return refmodel;
  } else {
    return model;
  }
}

exports.Document = mongoose.Document;

const tables = new Map();

const getType = exports.getType = (type) => {
  const Model = tables.get(type);
  return Model;
}

exports.register = (Tables) => {
  const keys = Object.keys(Tables);
  for (const name of keys) {
    if (!name) {
      console.error('entity can not be register');
      return;
    }
  }
  for (const name of keys) {
    let type = name;
    // 首字母大写
    type = type[0].toUpperCase() + type.substr(1);
    tables.set(type, Tables[name]);
  }
}

const MetaTable = exports.MetaTable = class MetaTable extends mongoose.Model {

  static findOneAndUpdate(conditions, update, ...other) {
    return mongoose.Model.findOneAndUpdate.call(this, conditions, {
      ...update,
      _ns: this.ns
    }, ...other);
  }
  static findOneAndReplace(conditions, update, ...other) {
    return mongoose.Model.findOneAndReplace.call(this, conditions, {
      ...update,
      _ns: this.ns
    }, ...other);
  }
  static update(conditions, update, ...other) {
    return mongoose.Model.update.call(this, conditions, {
      ...update,
      _ns: this.ns
    }, ...other);
  }
  static updateMany(conditions, update, ...other) {
    return mongoose.Model.updateMany.call(this, conditions, {
      ...update,
      _ns: this.ns
    }, ...other);
  }
  static updateOne(conditions, update, ...other) {
    return mongoose.Model.updateOne.call(this, conditions, {
      ...update,
      _ns: this.ns
    }, ...other);
  }
  static replaceOne(conditions, update, ...other) {
    return mongoose.Model.replaceOne.call(this, conditions, {
      ...update,
      _ns: this.ns
    }, ...other);
  }

  static bulkWrite(ops, ...other) {
    // insertOne, updateOne, updateMany, replaceOne, deleteOne, and/or deleteMany
    return mongoose.Model.replaceOne.call(this, ops.map(it => {
      if (it.insertOne) {
        it.document = {
          ...it.document,
          ns: this.ns
        }
      }
      if (it.updateOne || it.updateMany || it.replaceOne) {
        it.filter = {
          ...it.filter,
          ns: this.ns
        }
        it.update = {
          ...it.update,
          ns: this.ns
        }
      }

      if (it.deleteOne || it.deleteMany) {
        it.filter = {
          ...it.filter,
          ns: this.ns
        }
      }
    }), ...other);
  }

  static geoSearch(conditions, ...other) {

  }

  static insertMany(docs, ...other) {
    if (!Array.isArray(docs)) {
      docs = [docs]
    }
    return mongoose.Model.insertMany.call(this, docs.map(it => ({
      ...it,
      _ns: this.ns
    })), ...other);
  }

  static createModel(name, schema, opts = {}) {
    if (!name) {
      throw new Error(i18n.t('查询对象名称无效'))
    }
    const {
      scope,
      version,
      prefix,
      ns,
      splitCollection,
      actionHandler,
      query, // 查询模式
      populateReferences, // 填充引用对象
      getReferenceVersion, // 如果没有自定义populateService需要查询版本
      populateService,
      description
    } = {
      scope: {},
      query: false,
      populateReferences: false,
      ...opts
    };
    // 如果缓存有，版本一致不重建啦
    const versionedName = name + (version ? '_' + version : '');
    const collectionName = (prefix ? (prefix + '.') : '') +
      (ns && splitCollection !== false ? (ns + '.') : '') +
      name + '.tables';
    debug('----- %s(%s) -----', versionedName, schema.type);
    let model = cache.get(versionedName);
    if (model) {
      cache.ttl(versionedName);
      if (ns !== model.ns) {
        // 创建不同集合名称的子类
        debug('%s subclass...', versionedName, collectionName, ns);
        // return mongoose.model(versionedName, newSchema, collectionName);
        // 这里采用创建subclass应该比新建model要快很多？
        model = model.__subclass(mongoose.connection, null, collectionName);
        model.ns = ns;
        model.getReferenceVersion = getReferenceVersion;
      }
      debug('--------------- From Cache ------------------');
      return model;
    }
    const BaseTable = getType(schema.type);
    if (!BaseTable) {
      throw new Error(t('{{type}}查询类型未定义', schema));
    }
    const sche = createDbSchema(schema.fields);
    sche._ns = {
      type: String,
      index: true,
    }
    if (!sche) {
      throw new Error(i18n.t('查询Schema加载失败'));
    }
    const mgschema = new mongoose.Schema(sche, defOptions);
    mgschema.set('key', versionedName);
    mgschema.set('name', name);
    mgschema.set('schema', schema);
    mgschema.set('version', version);
    mgschema.set('description', description);

    // 查询模式是给gql提供生成mgschema用
    if (!query) {
      if (schema.conflicts.length > 0) {
        throw new Error(i18n.t('系统字段{{keys}}冲突，请修改成其他名称!', {
          keys: schema.conflicts.map(it => it.key).join(',')
        }))
      }

      // 需要mapto，doc.set即可
      //createMapping(fields, name);
      createVirtualProps(mgschema, schema.mappings);
      mgschema.loadClass(BaseTable);

      // 每个model不同，需要存储到model中
      // mgschema.set('ns', ns);
      // mgschema.set('getReferenceVersion', getReferenceVersion);

      mgschema.static('getReferenceModel', function (name) {
        return getReferenceModel(name, this.prefix, this.ns, this.splitCollection, this.getReferenceVersion, !!version);
      });

      // 自定义行为函数
      for (const {
          key,
          handle
        } of schema.actions) {
        mgschema.static(key, handle);
        debug('carete custom action: %s ...', key);
      }

      // 行为规则
      //debug(mgschema)
      const fireAction = async (ns, action, doc) => {
        if (actionHandler) {
          debug('on %s action...', action, doc);
          // 规则key不需要带环境，环境取决加载的规则范围
          ns = ns ? ns.split('/')[0] : ns;
          const events = [
            action, // 所有行为
            schema.type + '.' + action, // 一类行为
            name + '.' + action // 特定行为
          ];
          const nsEvents = ns ? [
            ns + '.' + action, // 特定范围所有行为
            ns + '.' + schema.type + '.' + action, // 特定范围一类行为
            ns + '.' + name + '.' + action // 特定范围特定行为
          ] : [];
          await actionHandler([
            ...events.concat(nsEvents).map(name => (new Action(name))),
            doc
          ]);
        }
      }

      // this==Query对象
      // mgschema.pre('find', async function () {
      //   await fireAction('find', this);
      // });
      mgschema.pre('init', async function () {
        await fireAction(this.constructor.ns, 'initing', this);
      });
      mgschema.pre('validate', async function () {
        await fireAction(this.constructor.ns, 'validating', this);
      });
      mgschema.pre('save', async function () {
        await fireAction(this.constructor.ns, 'saving', this);
      });
      mgschema.pre('remove', async function () {
        await fireAction(this.constructor.ns, 'removing', this);
      });
      mgschema.pre('updateOne', async function () {
        await fireAction(this.constructor.ns, 'saving', this);
      });
      mgschema.pre('deleteOne', async function () {
        await fireAction(this.constructor.ns, 'removing', this);
      });
      mgschema.post('init', async (doc) => {
        await fireAction(this.ns, 'inited', doc);
      });
      mgschema.post('validate', async (doc) => {
        await fireAction(this.ns, 'validated', doc);
      });
      mgschema.post('save', async (doc) => {
        await fireAction(this.ns, 'saved', doc);
      });
      mgschema.post('remove', async (doc) => {
        await fireAction(this.ns, 'removed', doc);
      });
      mgschema.post('updateOne', async (doc) => {
        await fireAction(this.ns, 'saved', doc);
      });
      mgschema.post('deleteOne', async (doc) => {
        await fireAction(this.ns, 'removed', doc);
      });

      // 保存和删除统一提交，但是findAndUpdate啥的是直接提交
      // const commits = [];
      // mgschema.pre('save', true, function (next, done) {
      //   next();
      //   commits.push(done);
      // });
      // mgschema.pre('remove', true, function (next, done) {
      //   next();
      //   commits.push(done);
      // });
      // mgschema.pre('find', true, function (next, done) {
      //   next();
      //   commits.push(done);
      // });
    }

    // 每条数据都必须记录ns
    mgschema.
    pre('count', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('find', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('deleteMany', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('deleteOne', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('findOne', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('findOneAndDelete', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('findOneAndRemove', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('remove', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('findOneAndUpdate', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('update', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('updateMany', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('updateOne', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('replaceOne', function () {
      this.where('_ns', this.model.ns);
    }).
    pre('save', function () {
      this.set('_ns', this.constructor.ns);
    }).
    // pre('insertMany', function () {
    //   debug(this)
    //   //this.set('_ns', this.constructor.ns);
    // }).
    pre('aggregate', function () {
      this.match({
        _ns: this.model.ns
      });
    });

    if (populateReferences) {
      // 自动填充引用类型
      // 由于没有cache model，mongoose的填充找不到model，所以我们自己做了个填充
      // mgschema.plugin(autopopulatePlugin);
      const populateServiceFn = populateService || (function (name) {
        return getReferenceModel(name, this.model.prefix, this.model.ns, this.model.splitCollection, this.model.getReferenceVersion, !!version)
      });
      mgschema.
      post('find', async function (docs) {
        await populateReferencesHandler(schema.references, populateServiceFn.bind(this), ...docs);
        //debug(docs)
      }).
      post('findOne', async function (doc) {
        await populateReferencesHandler(schema.references, populateServiceFn.bind(this), doc);
      }).
      post('findOneAndUpdate', async function (doc) {
        await populateReferencesHandler(schema.references, populateServiceFn.bind(this), doc);
      });
    }

    // 这里collectionName是第一创建的model的集合，要是不同租户不同需要改成model子类保证集合不同
    // name 不能是 versionedName，要不引用类型填充失败
    debug('create model %s...', name, collectionName);
    model = mongoose.model(name, mgschema, collectionName, {
      cache: false // 重建会报错
    });

    model.versionedName = versionedName;
    model.prefix = prefix;
    model.ns = ns;
    model.splitCollection = splitCollection;
    model.getReferenceVersion = getReferenceVersion;
    // model.commitAll = async () => {
    //   commits.forEach(done => done());
    // };

    cache.set(versionedName, model);
    debug('--------------- END ------------------');

    return model;
  }
}

MetaTable.$isMongooseModelPrototype = true;
