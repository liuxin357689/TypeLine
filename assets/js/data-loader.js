/* ==========================================================================
 * 书库分类数据按需加载器（#33 新建，ES5）
 * 职责：ensureCategory(id, cb) —— 已载分类直接回调；未载按 catalog.js 注册表
 *       动态注入 assets/js/data/<file>，onload/onerror 回调；同 id 并发请求
 *       排队共享一次注入（pending 去重），保留 file:// 双击直跑语义。
 * 依赖：window.TP_CATALOG（catalog.js）、window.TP_CATS（分类文件挂载点）
 * ========================================================================== */
(function () {
  var pending = {};   /* id -> [cb, ...]：注入进行中的等待队列 */

  function getEntry(id) {
    var list = window.TP_CATALOG || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function ensureCategory(id, cb) {
    var callback = typeof cb === 'function' ? cb : function () {};
    var cats = window.TP_CATS || {};
    /* 已加载：直接同步回调 */
    if (cats[id]) { callback(null, cats[id]); return; }

    var entry = getEntry(id);
    if (!entry) { callback(new Error('未知分类: ' + id), null); return; }

    /* 注入进行中：排队等待同一次 onload/onerror */
    if (pending[id]) { pending[id].push(callback); return; }
    pending[id] = [callback];

    function flush(err) {
      var queue = pending[id] || [];
      delete pending[id];
      var data = (window.TP_CATS || {})[id] || null;
      for (var i = 0; i < queue.length; i++) queue[i](err, data);
    }

    var s = document.createElement('script');
    s.src = 'assets/js/data/' + entry.file;
    s.onload = function () {
      if ((window.TP_CATS || {})[id]) flush(null);
      else flush(new Error('分类数据缺失: ' + id));   /* 文件加载成功但未挂载 */
    };
    s.onerror = function () {
      if (s.parentNode) s.parentNode.removeChild(s);   /* 失败清除，允许重试 */
      flush(new Error('分类数据加载失败: ' + id));
    };
    document.body.appendChild(s);
  }

  window.TP_DataLoader = {
    getEntry: getEntry,
    ensureCategory: ensureCategory
  };
})();
