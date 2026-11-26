/* 工具函数：时间、转义、下载、去重指纹、提示 */
var DEFAULT_MOODS = ['开心', '兴奋', '满足', '感动', '温暖', '平静', '悲伤', '难过', '委屈', '愤怒', '害怕', '焦虑', '失望', '孤独', '不舍', '羞愧', '释然', '矛盾', '麻木', '说不清楚'];

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function nowISO() { return new Date().toISOString(); }

function fmtDate(s) {
  if (!s) return '';
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '年' + Number(m[2]) + '月' + Number(m[3]) + '日' : String(s);
}

function monthOf(s) {
  var m = String(s || '').match(/^(\d{4})-(\d{2})/);
  return m ? m[1] + '-' + m[2] : '';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function nl2br(s) { return esc(s).replace(/\r?\n/g, '<br>'); }

function splitTags(s) {
  return String(s || '')
    .split(/[,，、;；\s]+/)
    .map(function (t) { return t.trim(); })
    .filter(Boolean)
    .filter(function (t, i, a) { return a.indexOf(t) === i; });
}

/* 轻量指纹，用于导入去重：同日期 + 同正文视为重复 */
function fingerprint(rec) {
  var key = [rec.date || '', (rec.body || rec.content || '').trim(), (rec.title || '').trim()].join('\u0001');
  var h = 5381;
  for (var i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + '_' + key.length;
}

function download(filename, text) {
  var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
}

function downloadText(filename, text, mime) {
  var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
}

function readFileText(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(String(r.result || '')); };
    r.onerror = function () { reject(r.error); };
    r.readAsText(file, 'utf-8');
  });
}

function readFileDataURL(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(String(r.result || '')); };
    r.onerror = function () { reject(r.error); };
    r.readAsDataURL(file);
  });
}

var _toastTimer = null;
function toast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 2600);
}

function sortByDateDesc(list) {
  return list.slice().sort(function (a, b) {
    var ka = (a.date || '') + '|' + (a.updatedAt || a.createdAt || '');
    var kb = (b.date || '') + '|' + (b.updatedAt || b.createdAt || '');
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });
}

function bySearch(rec, q, fields) {
  if (!q) return true;
  var needle = q.toLowerCase();
  for (var i = 0; i < fields.length; i++) {
    var v = rec[fields[i]];
    if (v == null) continue;
    if (Array.isArray(v)) { if (v.join(' ').toLowerCase().indexOf(needle) >= 0) return true; }
    else if (String(v).toLowerCase().indexOf(needle) >= 0) return true;
  }
  return false;
}
