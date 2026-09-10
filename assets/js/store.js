/* ==========================================================================
 * TP_Store 练习历史存储层（V2.0 F1）
 * 命名空间：window.TP_Store
 * 存储键：typeline:records:v1
 *   V2 新增 localStorage 键统一使用 typeline: 前缀（见 design-doc §14）；
 *   V1 既有键 tp_theme 不改名不迁移。
 * 上限：MAX=500 条环形缓冲（超限丢弃最旧条目）
 * 降级：read() 对缺失/损坏/旧结构数据平滑降级为空数组，不抛错
 * ========================================================================== */
(function () {
  /* Schema 版本键：字符串末尾 v1 便于未来迁移判断；
     若 schema 变更，改此键名并在 read() 内加迁移逻辑 */
  var KEY = 'typeline:records:v1';
  var MAX = 500;
  /* F2 错字本复练：通过计数衰减键（typeline: 前缀 + 末尾 v1，见 design-doc §14）；
     结构 { [char]: number } 表示该字已被复练通过的次数，用于抵减原始错字计数 */
  var DECAY_KEY = 'typeline:review:decay:v1';

  function generateId() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* 读取全量记录；缺失/损坏/非数组/旧结构均降级为 []，不抛错 */
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      /* 过滤缺少 id 字段的损坏条目（旧结构或手写注入） */
      return parsed.filter(function (r) {
        return r && typeof r === 'object' && typeof r.id === 'string';
      });
    } catch (e) {
      return [];
    }
  }

  function write(records) {
    try {
      localStorage.setItem(KEY, JSON.stringify(records));
    } catch (e) { /* 配额满/隐私模式等静默降级 */ }
  }

  /* ------------------------------------------------------------------ */
  /* createRecord：构造记录对象                                           */
  /* 口径来源（与 TypingPractice.js computed 完全一致）：                  */
  /*   chars      = pos（已提交字符总数）                                  */
  /*   durationMs = elapsed（Date.now()-startTime，毫秒）                 */
  /*   cpm        = speed（round(correctCount / (elapsed/60000))）        */
  /*   accuracy   = accuracy（round(correctCount/pos*100)，pos=0 时 100） */
  /* wrongChars 每项：{ch, expected, pos, context}                        */
  /*   ch       = 用户实际输入的错字                                      */
  /*   expected = 原文正确字                                              */
  /*   pos      = 全文字符索引                                            */
  /*   context  = 周围最多 7 字上下文                                     */
  /* ------------------------------------------------------------------ */
  function createRecord(opts) {
    return {
      id:          generateId(),
      ts:          Date.now(),
      articleId:   opts.articleId   || 0,
      chars:       opts.chars       || 0,
      durationMs:  opts.durationMs  || 0,
      cpm:         opts.cpm         || 0,
      accuracy:    (opts.accuracy !== undefined) ? opts.accuracy : 100,
      wrongChars:  opts.wrongChars  || [],
      mode:        opts.mode        || 'full',   /* F2：'full' 常规 / 'review' 复练（隔离统计） */
      abandoned:   !!opts.abandoned
    };
  }

  /* 新增单条记录；超过 MAX 条时丢弃最旧条目（环形缓冲） */
  function addRecord(rec) {
    var records = read();
    records.push(rec);
    if (records.length > MAX) records = records.slice(records.length - MAX);
    write(records);
    return rec;
  }

  /* 删除单条（按 id） */
  function removeRecord(id) {
    var records = read().filter(function (r) { return r.id !== id; });
    write(records);
  }

  /* 清空全部 */
  function clearAll() {
    write([]);
  }

  /* 查全部（按写入顺序，即时间升序） */
  function getAll() {
    return read();
  }

  /* ------------------------------------------------------------------ */
  /* aggregateWrongChars：错字聚合辅助函数（供 V2.0 F2 错字本复练使用）   */
  /* 按「期望字」（expected）聚合：出现次数、最近时间戳、上下文词组        */
  /* @param {Array} [records]  可传入已读记录；不传则自动读全量           */
  /* @returns {Object}  { [expectedChar]: { count, lastTs, contexts[] } } */
  /*   count    {number}   累计出错次数                                  */
  /*   lastTs   {number}   最近一次出错的 Unix 毫秒时间戳                */
  /*   contexts {string[]} 最多 5 个不重复上下文词组（每个最多 7 字）     */
  /* ------------------------------------------------------------------ */
  function aggregateWrongChars(records) {
    var recs = records || read();
    var map = {};
    for (var ri = 0; ri < recs.length; ri++) {
      var rec = recs[ri];
      if (!rec.wrongChars || !Array.isArray(rec.wrongChars)) continue;
      for (var wi = 0; wi < rec.wrongChars.length; wi++) {
        var w   = rec.wrongChars[wi];
        var key = w.expected || w.ch;
        if (!key) continue;
        if (!map[key]) map[key] = { count: 0, lastTs: 0, contexts: [] };
        map[key].count++;
        if (rec.ts > map[key].lastTs) map[key].lastTs = rec.ts;
        /* 去重后最多保留 5 个上下文 */
        if (w.context && map[key].contexts.length < 5) {
          var dup = false;
          for (var ci = 0; ci < map[key].contexts.length; ci++) {
            if (map[key].contexts[ci] === w.context) { dup = true; break; }
          }
          if (!dup) map[key].contexts.push(w.context);
        }
      }
    }
    return map;
  }

  /* ------------------------------------------------------------------ */
  /* F2 错字本 / 复练衰减                                                  */
  /* ------------------------------------------------------------------ */
  function readDecay() {
    try {
      var raw = localStorage.getItem(DECAY_KEY);
      if (!raw) return {};
      var p = JSON.parse(raw);
      return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
    } catch (e) { return {}; }
  }
  function writeDecay(map) {
    try { localStorage.setItem(DECAY_KEY, JSON.stringify(map)); } catch (e) {}
  }
  /* 复练通过衰减：对每个字累加通过次数（默认 +1） */
  function addReviewPass(chars, n) {
    var map = readDecay();
    var inc = (typeof n === 'number' && n > 0) ? n : 1;
    for (var i = 0; i < (chars || []).length; i++) {
      var c = chars[i];
      if (!c) continue;
      map[c] = (map[c] || 0) + inc;
    }
    writeDecay(map);
    return map;
  }
  /* 错字本：仅统计常规记录（mode!=='review'，前缀隔离），抵减衰减后 count>0 者，
     按 count 降序、lastTs 降序；返回 [{ch,count,lastTs,contexts}] */
  function getWrongBook() {
    var recs = read().filter(function (r) { return r.mode !== 'review'; });
    var agg  = aggregateWrongChars(recs);
    var decay = readDecay();
    var out = [];
    for (var k in agg) {
      if (!Object.prototype.hasOwnProperty.call(agg, k)) continue;
      var eff = agg[k].count - (decay[k] || 0);
      if (eff > 0) out.push({ ch: k, count: eff, lastTs: agg[k].lastTs, contexts: agg[k].contexts });
    }
    out.sort(function (a, b) { return (b.count - a.count) || (b.lastTs - a.lastTs); });
    return out;
  }

  window.TP_Store = {
    KEY:                 KEY,
    MAX:                 MAX,
    read:                read,
    write:               write,
    createRecord:        createRecord,
    addRecord:           addRecord,
    removeRecord:        removeRecord,
    clearAll:            clearAll,
    getAll:              getAll,
    aggregateWrongChars: aggregateWrongChars,
    addReviewPass:       addReviewPass,
    getWrongBook:        getWrongBook,
    DECAY_KEY:           DECAY_KEY
  };
})();
