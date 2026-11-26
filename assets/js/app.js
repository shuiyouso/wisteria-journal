/* 应用层：路由、渲染、编辑、筛选、备份与导入 */
(function () {
  'use strict';

  var CFG = {
    happy: {
      store: 'entries', label: '幸福收藏', icon: '✿',
      search: ['title', 'body', 'tags'],
      desc: '记录让你开心、温暖、值得珍藏的小事'
    },
    words: {
      store: 'sig_words', label: '西格的话', icon: '♡',
      search: ['title', 'body', 'tags'],
      desc: '保存西格想对你说的话'
    },
    mood: {
      store: 'mood', label: '心情花笺', icon: '❀',
      search: ['what', 'feelings', 'body', 'thoughts', 'discovery', 'message', 'keywords'],
      desc: '记录发生了什么，以及当时的感受'
    }
  };
  var ORDER = ['happy', 'words', 'mood'];

  var state = {
    view: 'home', space: 'happy', q: '', month: '', tag: '', mood: '',
    limit: 15, editing: null, images: [], moods: [], quick: true, cache: {}
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 启动 ---------------- */
  init();

  async function init() {
    try {
      await openDB();
    } catch (e) {
      document.body.innerHTML = '<p style="padding:40px;text-align:center">数据库打不开：' + esc(e.message) +
        '<br>请尝试关闭其他标签页，或换一个浏览器。</p>';
      return;
    }
    state.moods = await metaGet('customMoods', DEFAULT_MOODS.slice());
    document.addEventListener('click', onClick);
    $('overlay').addEventListener('click', function (e) { if (e.target.id === 'overlay') closeSheet(); });
    $('form').addEventListener('submit', onSubmit);
    $('btnCancel').addEventListener('click', closeSheet);
    $('btnClose').addEventListener('click', closeSheet);
    $('q').addEventListener('input', function () { state.q = this.value.trim(); state.limit = 15; renderList(); });
    $('fMonth').addEventListener('change', function () { state.month = this.value; renderList(); });
    $('fTag').addEventListener('change', function () { state.tag = this.value; renderList(); });
    $('fMood').addEventListener('change', function () { state.mood = this.value; renderList(); });
    $('btnNew').addEventListener('click', function () { openEditor(null); });
    $('btnMore').addEventListener('click', function () { state.limit += 15; renderList(); });
    $('btnBackupOne').addEventListener('click', function () { exportOne(state.space); });
    window.addEventListener('hashchange', route);
    route();
  }

  function route() {
    var h = (location.hash || '#/home').replace(/^#\//, '');
    if (h === 'happy' || h === 'words' || h === 'mood') {
      state.space = h; state.view = 'list';
      state.q = ''; state.month = ''; state.tag = ''; state.mood = ''; state.limit = 15;
      $('q').value = '';
      renderList();
    } else if (h === 'backup') {
      state.view = 'backup';
      renderBackup();
    } else {
      state.view = 'home';
      renderHome();
    }
    ['home', 'list', 'backup'].forEach(function (v) {
      var el = $('view-' + v);
      el.classList.toggle('active', v === state.view);
    });
    document.querySelectorAll('#nav a').forEach(function (a) {
      var target = a.getAttribute('data-view');
      var active = (state.view === 'home' && target === 'home') ||
        (state.view === 'list' && target === state.space) ||
        (state.view === 'backup' && target === 'backup');
      a.classList.toggle('active', active);
    });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------------- 首页 ---------------- */
  async function renderHome() {
    var data = await loadAll();
    var counts = { happy: data.happy.length, words: data.words.length, mood: data.mood.length };
    $('stats').innerHTML = ORDER.map(function (k) {
      return '<div class="stat"><strong>' + counts[k] + '</strong><span>' + CFG[k].label + '</span></div>';
    }).join('');

    $('homeCards').innerHTML = ORDER.map(function (k) {
      return '<a class="card" href="#/' + k + '">' +
        '<span class="ico">' + CFG[k].icon + '</span>' +
        '<span><b>' + CFG[k].label + '</b><small>' + esc(CFG[k].desc) + '</small></span>' +
        '</a>';
    }).join('');

    var all = [];
    ORDER.forEach(function (k) {
      data[k].forEach(function (r) { all.push({ type: k, rec: r }); });
    });
    all.sort(function (a, b) {
      var ka = a.rec.updatedAt || a.rec.createdAt || a.rec.date || '';
      var kb = b.rec.updatedAt || b.rec.createdAt || b.rec.date || '';
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    });
    var latest = all.slice(0, 5);
    $('recentList').innerHTML = latest.length
      ? latest.map(function (x) { return itemHTML(x.type, x.rec, true); }).join('')
      : '<p class="empty">还没有记录。想到什么，就写一点吧。</p>';
  }

  /* ---------------- 列表 ---------------- */
  async function loadAll() {
    var out = {};
    for (var i = 0; i < ORDER.length; i++) {
      var k = ORDER[i];
      out[k] = await dbAll(CFG[k].store);
    }
    state.cache = out;
    return out;
  }

  async function renderList() {
    var data = state.cache.happy ? state.cache : await loadAll();
    var space = state.space;
    var cfg = CFG[space];
    var rows = sortByDateDesc(data[space] || []);

    fillSelect($('fMonth'), '全部月份', monthsOf(rows), function (v) { return v.replace('-', ' 年 ') + ' 月'; });
    $('fMonth').value = state.month;

    var isMood = space === 'mood';
    document.querySelectorAll('.only-mood').forEach(function (el) { el.classList.toggle('hidden', !isMood); });
    document.querySelectorAll('.only-happy,.only-words').forEach(function (el) { el.classList.toggle('hidden', isMood); });

    if (!isMood) {
      var tags = [];
      rows.forEach(function (r) { (r.tags || []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); }); });
      fillSelect($('fTag'), '全部标签', tags.sort(), function (v) { return v; });
      $('fTag').value = state.tag;
    } else {
      var used = [];
      rows.forEach(function (r) { (r.feelings || []).forEach(function (t) { if (used.indexOf(t) < 0) used.push(t); }); });
      fillSelect($('fMood'), '全部情绪', used.sort(), function (v) { return v; });
      $('fMood').value = state.mood;
    }

    var filtered = rows.filter(function (r) {
      if (state.month && monthOf(r.date) !== state.month) return false;
      if (!isMood && state.tag && (r.tags || []).indexOf(state.tag) < 0) return false;
      if (isMood && state.mood && (r.feelings || []).indexOf(state.mood) < 0) return false;
      return bySearch(r, state.q, cfg.search);
    });

    var shown = filtered.slice(0, state.limit);
    $('btnMore').classList.toggle('hidden', filtered.length <= shown.length);
    $('btnMore').textContent = '显示更多（还有 ' + Math.max(0, filtered.length - shown.length) + ' 条）';

    if (!filtered.length) {
      $('list').innerHTML = '<p class="empty">' + (rows.length ? '没有符合条件的记录。' : '这里还空着。点右上角「新增」记下第一条。') + '</p>';
      return;
    }

    var html = '', lastMonth = '';
    shown.forEach(function (r) {
      var m = monthOf(r.date);
      if (m !== lastMonth) {
        lastMonth = m;
        html += '<div class="month-head">' + (m ? m.replace('-', ' 年 ') + ' 月' : '未标日期') + '</div>';
      }
      html += itemHTML(space, r, false);
    });
    $('list').innerHTML = html;
  }

  function fillSelect(sel, firstLabel, values, labelFn) {
    sel.innerHTML = '<option value="">' + firstLabel + '</option>' +
      values.map(function (v) {
        return '<option value="' + esc(v) + '">' + esc(labelFn ? labelFn(v) : v) + '</option>';
      }).join('');
  }

  function monthsOf(rows) {
    var set = [];
    rows.forEach(function (r) {
      var m = monthOf(r.date);
      if (m && set.indexOf(m) < 0) set.push(m);
    });
    return set.sort().reverse();
  }

  function itemHTML(type, r, clamp) {
    var isMood = type === 'mood';
    var title = r.title || '';
    var meta = ['<span>' + fmtDate(r.date) + '</span>'];
    if (isMood && r.feelings && r.feelings.length) {
      meta.push('<span>' + r.feelings.slice(0, 3).map(esc).join(' · ') + '</span>');
    }
    var tags = (r.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    var bodyText = isMood ? (r.what || '') : (r.body || '');
    var extra = '';
    if (isMood) {
      if (r.thoughts) extra += '<p class="body"><b>当时的想法：</b>' + nl2br(r.thoughts) + '</p>';
      if (r.bodyFeel) extra += '<p class="body"><b>身体感受：</b>' + nl2br(r.bodyFeel) + '</p>';
      if (r.discovery) extra += '<p class="body"><b>后来我发现了：</b>' + nl2br(r.discovery) + '</p>';
      if (r.message) extra += '<p class="body"><b>留给自己的话：</b>' + nl2br(r.message) + '</p>';
      if (r.keywords && r.keywords.length) {
        extra += '<div>' + r.keywords.map(function (k) { return '<span class="tag">' + esc(k) + '</span>'; }).join('') + '</div>';
      }
    }
    var imgs = (r.images || []).length
      ? '<div class="imgs">' + r.images.map(function (src) {
          return '<a href="' + src + '" target="_blank" rel="noopener"><img src="' + src + '" alt="配图" loading="lazy"></a>';
        }).join('') + '</div>'
      : '';
    return '<article class="item' + (isMood ? ' entry-quote' : '') + '">' +
      (title ? '<h3>' + esc(title) + '</h3>' : '') +
      '<div class="meta">' + meta.join('') + '</div>' +
      (tags ? '<div>' + tags + '</div>' : '') +
      (bodyText ? '<p class="body' + (clamp ? ' clamp' : '') + '">' + nl2br(bodyText) + '</p>' : '') +
      (clamp ? '' : extra) + imgs +
      '<div class="item-actions">' +
      '<button class="soft" data-act="edit" data-type="' + type + '" data-id="' + r.id + '">编辑</button>' +
      '<button class="soft" data-act="del" data-type="' + type + '" data-id="' + r.id + '">删除</button>' +
      '</div></article>';
  }

  /* ---------------- 事件 ---------------- */
  async function onClick(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var type = btn.getAttribute('data-type');
    var id = Number(btn.getAttribute('data-id'));

    if (act === 'edit') {
      var list = await dbAll(CFG[type].store);
      var rec = list.filter(function (x) { return x.id === id; })[0];
      if (rec) openEditor(rec);
    } else if (act === 'del') {
      if (!confirm('删除这条记录？删除后无法恢复，建议先导出备份。')) return;
      await dbDel(CFG[type].store, id);
      toast('已删除');
      state.cache = {};
      if (state.view === 'list') { await renderList(); } else { await renderHome(); }
    }
  }

  /* ---------------- 编辑弹层 ---------------- */
  function openEditor(rec) {
    state.editing = rec || null;
    state.images = rec && rec.images ? rec.images.slice() : [];
    var space = state.space;
    var cfg = CFG[space];
    $('sheetTitle').textContent = (rec ? '编辑' : '新增') + ' · ' + cfg.label;
    $('form').innerHTML = space === 'mood' ? moodFormHTML(rec) : normalFormHTML(space, rec);
    if (space === 'mood') bindMoodForm(rec);
    else bindNormalForm(space);
    $('overlay').classList.remove('hidden');
    var first = $('form').querySelector('input,textarea');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  function closeSheet() {
    $('overlay').classList.add('hidden');
    $('form').innerHTML = '';
    state.editing = null;
    state.images = [];
  }

  function normalFormHTML(space, rec) {
    rec = rec || {};
    var tags = (rec.tags || []).join('，');
    var imgField = space === 'happy'
      ? '<div class="field"><label>图片（可选，单张不超过 1.5MB）</label>' +
        '<input type="file" id="imgInput" accept="image/*" multiple>' +
        '<div class="thumb-row" id="thumbs"></div></div>'
      : '';
    return '' +
      '<div class="field"><label>日期</label><input type="date" id="fDate" value="' + esc(rec.date || todayStr()) + '"></div>' +
      '<div class="field"><label>标题' + (space === 'words' ? '（可留空）' : '') + '</label>' +
      '<input type="text" id="fTitle" maxlength="80" value="' + esc(rec.title || '') + '" placeholder="' +
      (space === 'words' ? '不填也行' : '给这件事起个名字') + '"></div>' +
      '<div class="field"><label>' + (space === 'words' ? '想说的话' : '内容') + '</label>' +
      '<textarea id="fBody" placeholder="' + (space === 'words' ? '写下来，长短都可以' : '把那一刻写下来') + '">' + esc(rec.body || '') + '</textarea></div>' +
      '<div class="field"><label>标签（可选，用逗号分隔）</label>' +
      '<input type="text" id="fTags" value="' + esc(tags) + '" placeholder="比如：工作，朋友"></div>' +
      imgField;
  }

  function bindNormalForm(space) {
    if (space === 'happy') {
      var input = $('imgInput');
      input.addEventListener('change', async function () {
        var files = Array.prototype.slice.call(this.files || []);
        for (var i = 0; i < files.length; i++) {
          var f = files[i];
          if (f.size > 1.5 * 1024 * 1024) { toast('「' + f.name + '」超过 1.5MB，已跳过'); continue; }
          state.images.push(await readFileDataURL(f));
        }
        this.value = '';
        renderThumbs();
      });
      renderThumbs();
    }
  }

  function renderThumbs() {
    var box = $('thumbs');
    if (!box) return;
    box.innerHTML = state.images.map(function (src, i) {
      return '<span class="thumb"><img src="' + src + '" alt=""><button type="button" data-delimg="' + i + '">×</button></span>';
    }).join('');
    box.querySelectorAll('button[data-delimg]').forEach(function (b) {
      b.onclick = function () {
        state.images.splice(Number(b.getAttribute('data-delimg')), 1);
        renderThumbs();
      };
    });
  }

  function moodFormHTML(rec) {
    rec = rec || {};
    var chips = state.moods.map(function (m) {
      var on = (rec.feelings || []).indexOf(m) >= 0;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-mood="' + esc(m) + '">' + esc(m) + '</button>';
    }).join('');
    var full = !state.quick;
    return '' +
      '<div class="tabs2">' +
      '<button type="button" class="' + (full ? '' : 'on') + '" data-mode="quick">快速记录</button>' +
      '<button type="button" class="' + (full ? 'on' : '') + '" data-mode="full">完整记录</button>' +
      '</div>' +
      '<p class="hint">不必急着解释自己的感受，先把它记录下来。</p>' +
      '<div class="field"><label>日期</label><input type="date" id="fDate" value="' + esc(rec.date || todayStr()) + '"></div>' +
      '<div class="field"><label>发生了什么</label>' +
      '<textarea id="fWhat" placeholder="事情经过，写关键的部分就行">' + esc(rec.what || '') + '</textarea></div>' +
      '<fieldset class="fieldset"><legend>当时的感受（可多选，也可以不选）</legend>' +
      '<div class="chip-wrap" id="moodChips">' + chips + '</div>' +
      '<div class="field" style="margin:10px 0 0"><div class="row">' +
      '<input type="text" id="newMood" placeholder="自定义一个情绪词" maxlength="12">' +
      '<button type="button" class="soft" id="btnAddMood">添加</button></div></div>' +
      '</fieldset>' +
      '<div class="field' + (full ? '' : ' hidden') + '" data-full="1"><label>身体感受（可选）</label>' +
      '<input type="text" id="fBodyFeel" value="' + esc(rec.bodyFeel || '') + '" placeholder="胸口发紧、眼眶发热、身体放松…"></div>' +
      '<div class="field' + (full ? '' : ' hidden') + '" data-full="1"><label>当时的想法（可选）</label>' +
      '<textarea id="fThoughts">' + esc(rec.thoughts || '') + '</textarea></div>' +
      '<div class="field' + (full ? '' : ' hidden') + '" data-full="1"><label>后来我发现了什么（可选）</label>' +
      '<textarea id="fDiscovery">' + esc(rec.discovery || '') + '</textarea></div>' +
      '<div class="field' + (full ? '' : ' hidden') + '" data-full="1"><label>留给自己的话（可选）</label>' +
      '<input type="text" id="fMessage" value="' + esc(rec.message || '') + '"></div>' +
      '<div class="field' + (full ? '' : ' hidden') + '" data-full="1"><label>关键词（可选，逗号分隔）</label>' +
      '<input type="text" id="fKeywords" value="' + esc((rec.keywords || []).join('，')) + '"></div>';
  }

  function bindMoodForm(rec) {
    $('form').querySelectorAll('[data-mode]').forEach(function (b) {
      b.onclick = function () {
        state.quick = b.getAttribute('data-mode') === 'quick';
        $('form').querySelectorAll('[data-mode]').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        $('form').querySelectorAll('[data-full]').forEach(function (el) {
          el.classList.toggle('hidden', state.quick);
        });
      };
    });
    $('form').querySelectorAll('[data-mood]').forEach(function (b) {
      b.onclick = function () { b.classList.toggle('on'); };
    });
    $('btnAddMood').onclick = async function () {
      var v = ($('newMood').value || '').trim();
      if (!v) return;
      if (state.moods.indexOf(v) < 0) {
        state.moods.push(v);
        await metaSet('customMoods', state.moods);
      }
      var wrap = $('moodChips');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip on'; b.textContent = v; b.setAttribute('data-mood', v);
      b.onclick = function () { b.classList.toggle('on'); };
      wrap.appendChild(b);
      $('newMood').value = '';
    };
    if (state.quick && rec) state.quick = true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    var space = state.space;
    var rec = state.editing || {};
    var now = nowISO();

    if (space === 'mood') {
      var chosen = Array.prototype.slice.call($('form').querySelectorAll('[data-mood].on'))
        .map(function (b) { return b.getAttribute('data-mood'); });
      var item = {
        id: rec.id, date: $('fDate').value || todayStr(),
        what: $('fWhat').value.trim(),
        feelings: chosen,
        bodyFeel: ($('fBodyFeel') || {}).value ? $('fBodyFeel').value.trim() : '',
        thoughts: ($('fThoughts') || {}).value ? $('fThoughts').value.trim() : '',
        discovery: ($('fDiscovery') || {}).value ? $('fDiscovery').value.trim() : '',
        message: ($('fMessage') || {}).value ? $('fMessage').value.trim() : '',
        keywords: splitTags(($('fKeywords') || {}).value || ''),
        createdAt: rec.createdAt || now, updatedAt: now
      };
      if (!item.what && !item.feelings.length) { toast('至少写一点发生了什么，或选一个感受'); return; }
      await dbPut('mood', item);
      toast(rec.id ? '已保存修改' : '已记下');
    } else {
      var body = $('fBody').value.trim();
      if (!body) { toast('内容不能为空'); return; }
      var row = {
        id: rec.id, date: $('fDate').value || todayStr(),
        title: $('fTitle').value.trim(), body: body,
        tags: splitTags($('fTags').value),
        createdAt: rec.createdAt || now, updatedAt: now
      };
      if (space === 'happy') row.images = state.images.slice();
      await dbPut(CFG[space].store, row);
      toast(rec.id ? '已保存修改' : '已收好');
    }

    closeSheet();
    state.cache = {};
    if (state.view === 'list') { await renderList(); } else { await renderHome(); }
  }

  /* ---------------- 备份 ---------------- */
  function stamp() { return todayStr().replace(/-/g, ''); }

  async function buildAll() {
    var data = await loadAll();
    return {
      app: '紫藤花语', version: 5, exportedAt: nowISO(),
      counts: { happy: data.happy.length, words: data.words.length, mood: data.mood.length },
      data: { happy: data.happy, words: data.words, mood: data.mood }
    };
  }

  async function exportAll() {
    var payload = await buildAll();
    download('紫藤花语_全部备份_' + stamp() + '.json', JSON.stringify(payload, null, 2));
    toast('已导出全部数据');
  }

  async function exportOne(space) {
    var payload = await buildAll();
    var one = {
      app: '紫藤花语', version: 5, exportedAt: nowISO(), space: space,
      entries: payload.data[space]
    };
    download('紫藤花语_' + CFG[space].label + '_' + stamp() + '.json', JSON.stringify(one, null, 2));
    toast('已导出「' + CFG[space].label + '」');
  }

  async function exportMarkdown() {
    var data = await loadAll();
    var out = ['# 紫藤花语备份', '', '导出时间：' + new Date().toLocaleString('zh-CN'), ''];
    ORDER.forEach(function (k) {
      out.push('## ' + CFG[k].label, '');
      sortByDateDesc(data[k]).forEach(function (r) {
        out.push('### ' + (r.title || (k === 'mood' ? (r.what || '').slice(0, 20) : '未命名')));
        out.push('- 日期：' + (r.date || ''));
        if (r.feelings && r.feelings.length) out.push('- 感受：' + r.feelings.join('、'));
        if (r.tags && r.tags.length) out.push('- 标签：' + r.tags.join('、'));
        if (r.keywords && r.keywords.length) out.push('- 关键词：' + r.keywords.join('、'));
        out.push('');
        out.push(k === 'mood' ? (r.what || '') : (r.body || ''));
        if (r.thoughts) out.push('', '**当时的想法：** ' + r.thoughts);
        if (r.bodyFeel) out.push('', '**身体感受：** ' + r.bodyFeel);
        if (r.discovery) out.push('', '**后来我发现了：** ' + r.discovery);
        if (r.message) out.push('', '**留给自己的话：** ' + r.message);
        out.push('');
      });
    });
    downloadText('紫藤花语_' + stamp() + '.md', out.join('\n'), 'text/markdown');
    toast('已导出 Markdown');
  }

  /* 兼容三种格式：v5 全部 / v5 单模块 / 旧版 v4 单模块 */
  function normalizeImport(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('文件不是有效的 JSON 对象');
    var out = { happy: [], words: [], mood: [] };
    if (raw.data && typeof raw.data === 'object') {
      ORDER.forEach(function (k) { if (Array.isArray(raw.data[k])) out[k] = raw.data[k]; });
      if (!out.happy.length && !out.words.length && !out.mood.length && !raw.data) throw new Error('备份里没有记录');
      return out;
    }
    if (Array.isArray(raw.entries) && raw.space) {
      var key = raw.space === 'happy' ? 'happy' : raw.space === 'mood' ? 'mood' : 'words';
      out[key] = raw.entries;
      return out;
    }
    if (Array.isArray(raw.entries)) { out.happy = raw.entries; return out; }
    throw new Error('无法识别的备份格式');
  }

  function cleanRecord(space, r) {
    var now = nowISO();
    var base = {
      date: r.date || todayStr(),
      createdAt: r.createdAt || now,
      updatedAt: r.updatedAt || now
    };
    if (space === 'mood') {
      return Object.assign(base, {
        what: r.what || '', feelings: Array.isArray(r.feelings) ? r.feelings : [],
        bodyFeel: r.bodyFeel || '', thoughts: r.thoughts || '', discovery: r.discovery || '',
        message: r.message || '', keywords: Array.isArray(r.keywords) ? r.keywords : []
      });
    }
    return Object.assign(base, {
      title: r.title || '', body: r.body || '',
      tags: Array.isArray(r.tags) ? r.tags : [],
      images: space === 'happy' && Array.isArray(r.images) ? r.images : []
    });
  }

  async function runImport(file) {
    var box = $('importResult');
    box.innerHTML = '正在读取…';
    try {
      var text = await readFileText(file);
      var raw = JSON.parse(text);
      var incoming = normalizeImport(raw);
      var replace = $('replaceMode').checked;
      var summary = [];
      var total = 0;
      ORDER.forEach(function (k) { total += incoming[k].length; summary.push(CFG[k].label + ' ' + incoming[k].length + ' 条'); });
      if (!total) throw new Error('这个文件里没有记录');

      var ok = confirm('将导入：' + summary.join('，') + '。\n' +
        (replace ? '将替换同名模块的现有数据。' : '将与现有数据合并，重复的自动跳过。') +
        '\n\n导入前建议先导出一次当前数据。继续？');
      if (!ok) { box.textContent = '已取消。'; return; }

      var added = 0, skipped = 0;
      for (var i = 0; i < ORDER.length; i++) {
        var k = ORDER[i];
        if (!incoming[k].length) continue;
        var store = CFG[k].store;
        var existing = replace ? [] : await dbAll(store);
        var seen = {};
        existing.forEach(function (x) { seen[fingerprint(x)] = true; });
        var batch = [];
        incoming[k].forEach(function (r) {
          var rec = cleanRecord(k, r);
          var fp = fingerprint(rec);
          if (seen[fp]) { skipped++; return; }
          seen[fp] = true;
          batch.push(rec);
        });
        if (batch.length) { await dbBulk(store, batch, replace); added += batch.length; }
      }

      state.cache = {};
      box.innerHTML = '<b>导入完成</b><br>新增 ' + added + ' 条' + (skipped ? '，跳过重复 ' + skipped + ' 条' : '') +
        '。<br>请刷新页面或切换到其他模块查看。';
      toast('导入完成，新增 ' + added + ' 条');
    } catch (err) {
      box.innerHTML = '<b>导入失败</b><br>' + esc(err.message) + '<br>原有数据未被改动。';
    }
  }

  async function renderBackup() {
    var data = await loadAll();
    $('legacyResult').innerHTML = '';
    $('importResult').innerHTML = '';
    $('btnExportAll').onclick = exportAll;
    $('btnExportMd').onclick = exportMarkdown;
    $('fileImport').onchange = function () {
      if (this.files && this.files[0]) runImport(this.files[0]);
      this.value = '';
    };
    document.querySelectorAll('[data-export]').forEach(function (b) {
      b.onclick = function () { exportOne(b.getAttribute('data-export')); };
    });
    $('btnCheckLegacy').onclick = async function () {
      var h = await dbAll('entries'), w = await dbAll('sig_words'), m = await dbAll('mood');
      $('legacyResult').innerHTML =
        '旧版「幸福收藏」<b>' + h.length + '</b> 条，旧版「西格的话」<b>' + w.length + '</b> 条。' +
        (m.length ? '' : '') +
        '<br>这些记录沿用同一个数据库，已经在上面三个模块里显示，无需再导入。' +
        '<br>如果你手里还有旧网站导出的 <code>.json</code> 备份，也可以在上面的「恢复数据」里导入，会自动识别旧格式。';
    };
    if (!data) return;
  }
})();
