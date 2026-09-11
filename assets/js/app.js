/* ==========================================================================
 * 根组件 + 应用挂载（设计文档 4.2 / 4.5 / 9.6 / 9.9）
 * 职责：导航栏（品牌 / 分段 pill Tab / 主题切换）、theme 持久化、
 *       <component :is="currentTabComp"> 视图切换、createApp().mount('#app')
 * #33 书库路由：默认视图 home；打字页签未选分类→home；
 *       provide selectCategory（按需加载分类数据→持久化 prefs.cat→进 typing）、
 *       goHome（换分类/统计返回）、currentCat（当前分类 id ref）
 * ========================================================================== */
(function () {
  /* CDN 加载失败降级（9.9 / B16）：不白屏，给出可诊断提示 */
  if (!window.Vue) {
    var box = document.getElementById("app");
    if (box) {
      box.innerHTML =
        '<div class="boot-error">Vue 加载失败，请检查网络连接后刷新页面。<br>' +
        '（本应用通过 CDN 引入 Vue 3 全局构建，离线或网络受限环境下无法启动。）</div>';
    }
    return;
  }

  var Vue = window.Vue;
  var createApp = Vue.createApp, ref = Vue.ref, computed = Vue.computed, watch = Vue.watch, provide = Vue.provide;

  var THEME_KEY = "tp_theme";

  function readTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch (e) {
      return "dark"; // 静默降级（B6/B7）
    }
  }
  function writeTheme(t) {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch (e) { /* 静默降级 */ }
  }

  var ICON_MOON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
    '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>';
  var ICON_SUN =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  var ICON_LOGO =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<rect x="2" y="6" width="20" height="12" rx="2"/>' +
    '<path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/></svg>';

  var RootComponent = {
    name: "TpRoot",
    template: `
<div class="app">
  <header class="app-bar">
    <div class="brand">
      <span class="brand-logo" v-html="logoIcon"></span>
      <span class="brand-name">TypeLine</span>
    </div>
    <nav class="tabs" role="tablist">
      <button
        type="button"
        class="tab"
        role="tab"
        :class="{ on: currentTab === 'typing' }"
        :aria-selected="currentTab === 'typing'"
        @click="goTab('typing')"
      >打字练习</button>
      <button
        type="button"
        class="tab"
        role="tab"
        :class="{ on: currentTab === 'keyboard' }"
        :aria-selected="currentTab === 'keyboard'"
        @click="goTab('keyboard')"
      >键盘测试</button>
      <button
        type="button"
        class="tab"
        role="tab"
        :class="{ on: currentTab === 'stats' }"
        :aria-selected="currentTab === 'stats'"
        @click="goTab('stats')"
      >统计</button>
    </nav>
    <button
      type="button"
      class="theme-btn"
      :title="theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'"
      @click="toggleTheme"
    >
      <span v-if="theme === 'dark'" v-html="moonIcon"></span>
      <span v-else v-html="sunIcon"></span>
    </button>
  </header>
  <main class="app-main">
    <component :is="currentTabComp"></component>
  </main>
</div>
`,
    setup: function () {
      var theme = ref(readTheme());
      var currentTab = ref("home");      /* #33：默认视图为书库首页 */
      var reviewChars = ref([]);          /* F2：错字本复练载荷（进 review 模式时注入） */

      /* #33：当前分类 id（null=未选）。初始从 prefs.cat 恢复——已选分类的
         数据文件尚未注入，仅恢复选择状态；点「打字练习」页签时再按需加载 */
      var currentCat = ref(null);
      try {
        var prefsCat = window.TP_Store && window.TP_Store.getPrefs().cat;
        if (prefsCat && window.TP_DataLoader && window.TP_DataLoader.getEntry(prefsCat)) {
          currentCat.value = prefsCat;
        }
      } catch (e) { /* 静默降级：偏好损坏视为未选分类 */ }

      /* 主题：watch → data-theme + localStorage（9.6）；
         首帧（immediate）只同步 data-theme 属性、不写 localStorage（评审 P2-7），
         仅用户实际切换后才持久化；与 index.html 首帧预置脚本同值，无闪屏 */
      var themePersisted = false;
      watch(theme, function (t) {
        document.documentElement.setAttribute("data-theme", t);
        if (themePersisted) writeTheme(t);
        themePersisted = true;
      }, { immediate: true });

      function toggleTheme() {
        theme.value = theme.value === "dark" ? "light" : "dark";
      }

      /* 视图切换：<component :is>，切走即卸载、切回重新初始化（9.3 / 裁决 1）
         #33：home 显式视图；typing 未选分类时回落 HomeView（防御性，goTab 已守卫） */
      var currentTabComp = computed(function () {
        if (currentTab.value === 'keyboard') return window.TP_KeyboardTest;
        if (currentTab.value === 'stats')    return window.TP_StatsView;
        if (currentTab.value === 'review')   return window.TP_ReviewView;
        if (currentTab.value === 'typing' && !currentCat.value) return window.TP_HomeView;
        if (currentTab.value === 'home')     return window.TP_HomeView;
        return window.TP_TypingPractice;
      });

      /* #33：页签点击统一入口——打字页签未选分类→home */
      function goTab(tab) {
        if (tab === 'typing' && !currentCat.value) { currentTab.value = 'home'; return; }
        currentTab.value = tab;
      }

      /* 向子组件提供切换页签能力（StatsView 空态「开始练习」按钮使用）；
         #33：typing 目标同样过未选分类守卫 */
      provide('switchTab', function (tab) { goTab(tab); });

      /* #33：选择分类——按需加载数据→持久化 prefs.cat→进 typing 视图；
         加载失败回调 err、不切视图（HomeView 展示错误提示） */
      provide('selectCategory', function (id, cb) {
        window.TP_DataLoader.ensureCategory(id, function (err, data) {
          if (err || !data) { if (cb) cb(err || new Error('分类加载失败')); return; }
          currentCat.value = id;
          try { window.TP_Store.setPrefs({ cat: id }); } catch (e) { /* 静默降级 */ }
          currentTab.value = 'typing';
          if (cb) cb(null, data);
        });
      });
      /* #33：回书库首页；opts.clearCat=true 同时清当前分类（「换分类」按钮），
         prefs.cat 保留（首页「继续上次」依据） */
      provide('goHome', function (opts) {
        if (opts && opts.clearCat) currentCat.value = null;
        currentTab.value = 'home';
      });
      provide('currentCat', currentCat);
      /* F2：向 ReviewView 提供复练载荷；StatsView 错字本「复练这些字」调用 startReview 进入 */
      provide('reviewChars', reviewChars);
      provide('startReview', function (chars) { reviewChars.value = chars || []; currentTab.value = 'review'; });

      return {
        theme: theme,
        currentTab: currentTab,
        currentTabComp: currentTabComp,
        toggleTheme: toggleTheme,
        goTab: goTab,
        moonIcon: ICON_MOON,
        sunIcon: ICON_SUN,
        logoIcon: ICON_LOGO
      };
    }
  };

  createApp(RootComponent).mount("#app");
})();
