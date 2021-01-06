const debug = require('debug')('saas-plat:db');
const mongoose = require('mongoose');

mongoose.set('useFindAndModify', false);

const db = mongoose.connection;
let connected = 'disconnected';

exports.connect = async (options) => {
  await connectData(options);
}

exports.disconnect = async () => {
  await disconnectData();
}

exports.isConnected = ( ) => {
  return   connected === 'connected'  ;
}

db.on('error', console.error.bind(console, 'connection error:'));
db.on('open', () => {
  connected = 'connected';
  debug('mongoose connected.');
});
db.on('reconnectFailed', ()=>{
  disconnectData();
})

const connectData = async (options) => {
  if (connected !== 'disconnected') {
    return connected;
  }
  options = options || {};
  connected = 'connecting';
  const url = 'mongodb://' + ((options.user || process.env.MONGO_USER) ? (encodeURIComponent(options.user || process.env.MONGO_USER) + ':' + encodeURIComponent(options.password || process.env.MONGO_PASSWORD) + '@') : '') +
    (options.url || process.env.MONGO_URL || (process.env.MONGO_PORT_27017_TCP_ADDR ? (process.env.MONGO_PORT_27017_TCP_ADDR + ':27017/query') : '') || "localhost/query");
  debug('connectting...', url);
  await mongoose.connect(url, {
    useUnifiedTopology: true,
    useNewUrlParser: true
  });
  return connected;
}

const disconnectData = async () => {
  await mongoose.disconnect();
  connected = 'disconnected';
}
