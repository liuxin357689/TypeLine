/* ==========================================================================
 * HomeView 书库首页组件（#33 新建）
 * 职责：五分类卡片网格（名称+描述+篇数）、顶部「继续上次：XX」快捷按钮
 *       （prefs.cat 命中注册表时显示）、加载态/失败提示；
 *       点击卡片 → inject selectCategory(id, cb)（app.js 负责按需加载与路由）
 * 双主题走 CSS 变量（.home-* 见 style.css）；375 窄屏单列不溢出。
 * ========================================================================== */
(function () {
  var Vue = window.Vue;
  var ref = Vue.ref, computed = Vue.computed, inject = Vue.inject;

  window.TP_HomeView = {
    name: "TpHomeView",
    template: `
<div class="home">
  <div class="home-head">
    <h1 class="home-title">书库</h1>
    <p class="home-sub">选择一个分类开始练习，分类数据按需加载</p>
    <button
      v-if="lastCat"
      type="button"
      class="btn primary home-resume"
      @click="pick(lastCat.id)"
      :disabled="loadingId === lastCat.id"
    >{{ loadingId === lastCat.id ? '加载中…' : '继续上次：' + lastCat.name }}</button>
  </div>
  <div class="home-grid" role="list">
    <button
      v-for="c in catalog"
      :key="c.id"
      type="button"
      role="listitem"
      class="home-card"
      :class="{ loading: loadingId === c.id }"
      :disabled="loadingId === c.id"
      @click="pick(c.id)"
    >
      <span class="home-card-name">{{ c.name }}</span>
      <span class="home-card-desc">{{ c.desc }}</span>
      <span class="home-card-count">{{ loadingId === c.id ? '加载中…' : c.count + ' 篇' }}</span>
    </button>
  </div>
  <p v-if="error" class="home-error" role="alert">{{ error }}</p>
</div>
`,
    setup: function () {
      var selectCategory = inject('selectCategory', null);
      var loadingId = ref(null);
      var error = ref('');

      var catalog = computed(function () { return window.TP_CATALOG || []; });

      /* 「继续上次」：prefs.cat 命中注册表才显示（旧偏好无 cat / 非法值静默隐藏） */
      var lastCat = computed(function () {
        var cat = '';
        try { cat = (window.TP_Store && window.TP_Store.getPrefs().cat) || ''; } catch (e) { cat = ''; }
        if (!cat) return null;
        return window.TP_DataLoader ? window.TP_DataLoader.getEntry(cat) : null;
      });

      function pick(id) {
        if (loadingId.value) return;
        error.value = '';
        loadingId.value = id;
        if (typeof selectCategory !== 'function') {
          loadingId.value = null;
          error.value = '路由未就绪，请刷新页面重试';
          return;
        }
        selectCategory(id, function (err) {
          loadingId.value = null;
          if (err) error.value = (err && err.message) || '分类加载失败';
          /* 成功：app.js 已切至 typing 视图，本组件随卸载无需复位 */
        });
      }

      return { catalog: catalog, lastCat: lastCat, loadingId: loadingId, error: error, pick: pick };
    }
  };
})();
