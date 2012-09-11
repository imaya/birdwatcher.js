(function(global) {

global.BirdSociety = BirdSociety;

/**
 * @constructor
 */
function BirdSociety() {
  /** @type {SocketNamespace} */
  this.connection;
  /** @type {boolean} */
  this.connected = false;
  /** @type {function(Object)} */
  this.update;
  /** @type {function(Object)} */
  this.listUpdate;
}

/**
 * connect socket.io.
 * @param {string=} id connection id.
 */
BirdSociety.prototype.connect = function(id) {
  /** @type {BirdSociety} */
  var that = this;
  /** @type {string} */
  var url = [location.protocol, '//', location.host, '/'].join('');
  /** @type {string} */
  var connection;

  connection = this.connection = io.connect(url);
  console.log(connection);

  // 接続完了時
  connection.on('connect', function(){
    that.connected = true;
    if (typeof id === 'string') {
      that.join(id);
    }
  });

  // 切断時
  connection.on('disconnect', function() {
    that.connected = false;
  });

  // メッセージ受信時
  connection.on('message', function(msg){
  });

  // アップデート通知
  connection.on('update', function(data) {
    if (typeof that.update === 'function') {
      that.update(data);
    }
  });

  // チャンネル一覧
  connection.on('list', function(data) {
    if (typeof that.listUpdate === 'function') {
      that.listUpdate(data);
    }
  });
};

/**
 * チャンネルにはいる
 * @param {string} id channel id.
 */
BirdSociety.prototype.join = function(id) {
  this.connection.emit("join", id);
};

/**
 * チャンネルから抜ける
 * @param {string} id channel id.
 */
BirdSociety.prototype.leave = function(id) {
  this.connection.emit("leave", id);
};

/**
 * チャンネル一覧の取得要求
 */
BirdSociety.prototype.list = function() {
  this.connection.emit("list");
}

/**
 * disconnect socket.io.
 */
BirdSociety.prototype.disconnect = function() {
  if (!this.connected) {
    return;
  }
  this.connection.socket.disconnect();
};

/**
 * direct connect.
 * @param {string} id room id.
 * @return {BirdSociety} created new BirdSociety object.
 */
BirdSociety.connect = function(id) {
  var bs = new BirdSociety();

  bs.connect(id);

  return bs;
};

}).call(this, this);

