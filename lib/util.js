const none = exports.none = () => {}


const parseBigData = exports.parseBigData = (data) => {
  // $开头系统字段
  if (_.isPlainObject(data) && (data.$type === 'BigArray' || data._type === 'BigArray' || (Array.isArray(data.$fields) && Array.isArray(data.$data)))) {
    const fields = data.$fields || data._fields || data.fields;
    const datalist = data.$data || data._fields || data.data;
    const bigarr = datalist.map(row => {
      return fields.reduce((obj, key, i) => ({
        ...obj,
        [key]: parseBigData(row[i])
      }), {});
    });
    return bigarr;
  } else if (_.isArray(data)) {
    return data.map(sit => parseBigData(sit));
  } else if (_.isPlainObject(data)) {
    return _.mapValues(data, (it) => parseBigData(it));
  } else {
    return data;
  }
}
const parseUserData = exports.parseUserData = (retobj, mappings) => {
  // 将有可能是mapping字段转换成用户自定义字段名称
  _.keys(mappings).forEach(mkey => {
    if (mkey in retobj) {
      const userkey = mappings[mkey];
      if (typeof userkey === 'string') {
        // 不需要映射
        if (userkey === mkey) {
          return;
        }
        retobj[userkey] = retobj[mkey];
      } else if (_.isArray(userkey)) {
        const submapping = userkey[0];
        const arrobj = _.toArray(retobj[mkey]);
        retobj[userkey] = parseUserData(arrobj, submapping);
      } else if (_.isPlainObject(userkey)) {
        retobj[userkey] = parseUserData(_.toPlainObject(retobj[mkey]), userkey);
      }
      delete retobj[mkey];
    }
  })
  return retobj;
}


exports.noenumerable = function (target, ...keys) {
  keys.forEach(key => {
    Object.defineProperty(target, key, {
      enumerable: false,
      writable: true,
      configurable: false
    });
  })
}

exports.readonly = function readonly(target, key, initValue, enumerable = false) {
  // 修改函数的name需要先改成writable
  Object.defineProperty(target, key, {
    writable: true
  });
  if (initValue !== undefined) {
    target[key] = initValue;
  }
  Object.defineProperty(target, key, {
    writable: false,
    //enumerable: enumerable,
    configurable: false
  });
}

exports.dropCollection = async (collection) => {
  try {
    await collection.drop();
    debug('drop %s', collection.collectionName);
  } catch (err) {
    if (!err.message.match(/ns not found/)) {
      throw err;
    }
  }
}

/**
* Mixes in this class's methods into an existing object.
* @param {object} [target={}] Any object to mix this class's methods into
* @param {function} [MixedIn=Mixin] Constructor to be mixed in
* @param {...*} [args] Arguments to pass to the mixed in constructor, if any
* @return {object} The original target object, mutated
*/
function mixin(target = {}, MixedIn, ...args) {
 if (MixedIn === Object.prototype ||
   MixedIn === Function.prototype) {
   return target;
 }
 mixin(target, Object.getPrototypeOf(MixedIn), ...args);
 // Get all the methods from this class, bind them to the instance, and copy
 // them to the target object.
 const object = MixedIn.prototype;
 Object.getOwnPropertyNames(object).map(key => [key, object[key]])
   .filter(([methodName, method]) =>
     typeof method === 'function' && methodName !== 'constructor')
   .forEach(([methodName, method]) => {
     Object.defineProperty(target, methodName, {
       configrable: true,
       enumerable: false,
       writable: true,
       value: method
     })
   });
 return target;
}

exports.mix = function mix(SuperClass, ...mixins) {
 return class extends SuperClass {
   constructor(...args) {
     super(...args);
     mixins.forEach(Mixedin => {
       mixin(this, Mixedin)
     });
   }
 };
}
