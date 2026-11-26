/* 数据层：沿用旧库 wisteria-happiness-db，版本 2 → 3 只新增，不动旧表。 */
var DB_NAME = 'wisteria-happiness-db';
var DB_VERSION = 3;
var STORE = { happy: 'entries', words: 'sig_words', mood: 'mood', meta: 'meta' };

var _db = null;

function openDB() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function () {
      var db = req.result;
      // 旧表：存在就原样保留，不重建、不清空
      ['entries', 'sig_words'].forEach(function (name) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
        }
      });
      if (!db.objectStoreNames.contains('mood')) {
        var mood = db.createObjectStore('mood', { keyPath: 'id', autoIncrement: true });
        mood.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = function () { _db = req.result; resolve(_db); };
    req.onerror = function () { reject(req.error); };
    req.onblocked = function () { reject(new Error('数据库被其他标签页占用，请关闭其他标签页后重试')); };
  });
}

function dbAll(store) {
  return new Promise(function (resolve, reject) {
    var r = _db.transaction(store, 'readonly').objectStore(store).getAll();
    r.onsuccess = function () { resolve(r.result || []); };
    r.onerror = function () { reject(r.error); };
  });
}

function dbPut(store, obj) {
  obj = Object.assign({}, obj);
  // 新增记录不能带 undefined 主键，否则 IndexedDB 会拒绝写入
  if (obj.id === undefined || obj.id === null || obj.id === '') delete obj.id;
  return new Promise(function (resolve, reject) {
    var t = _db.transaction(store, 'readwrite');
    var r = t.objectStore(store).put(obj);
    t.oncomplete = function () { resolve(r.result); };
    t.onerror = function () { reject(t.error); };
    t.onabort = function () { reject(t.error || new Error('写入被中断')); };
  });
}

function dbDel(store, id) {
  return new Promise(function (resolve, reject) {
    var t = _db.transaction(store, 'readwrite');
    t.objectStore(store).delete(id);
    t.oncomplete = resolve;
    t.onerror = function () { reject(t.error); };
  });
}

function dbClear(store) {
  return new Promise(function (resolve, reject) {
    var t = _db.transaction(store, 'readwrite');
    t.objectStore(store).clear();
    t.oncomplete = resolve;
    t.onerror = function () { reject(t.error); };
  });
}

/* 一个事务里批量写入；任一条出错整批回滚，不会留下半截数据 */
function dbBulk(store, list, replace) {
  return new Promise(function (resolve, reject) {
    var t = _db.transaction(store, 'readwrite');
    var os = t.objectStore(store);
    if (replace) os.clear();
    list.forEach(function (item) { os.put(item); });
    t.oncomplete = function () { resolve(list.length); };
    t.onerror = function () { reject(t.error); };
    t.onabort = function () { reject(t.error || new Error('导入被中断，已回滚')); };
  });
}

function metaGet(key, fallback) {
  return new Promise(function (resolve) {
    var r = _db.transaction('meta', 'readonly').objectStore('meta').get(key);
    r.onsuccess = function () { resolve(r.result ? r.result.value : fallback); };
    r.onerror = function () { resolve(fallback); };
  });
}

function metaSet(key, value) {
  return dbPut('meta', { key: key, value: value });
}
