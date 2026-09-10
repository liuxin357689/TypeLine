/* ==========================================================================
 * KeyboardTest 键盘全键测试组件（设计文档 4.2 / 7.2 / 9.7）
 * document 级 keydown 仅组件存活期生效（onMounted 添加 / onUnmounted 移除）；
 * code→key Map O(1) 命中；testedKeys 响应式 Set 持久高亮；重置清空。
 * 104 键全部可测（裁决 2，无“系统保留”标注）。
 * 裁决 9（取代裁决 4 的「放行 F5/F12」条款）：测试集内按键一律 preventDefault，
 * 仅豁免 .app-bar 内事件源（头部键盘可达性）。
 * ========================================================================== */
(function () {
  var Vue = window.Vue;
  var ref = Vue.ref, reactive = Vue.reactive, computed = Vue.computed,
      onMounted = Vue.onMounted, onUnmounted = Vue.onUnmounted;

  var SECTIONS = ["功能键区", "主键区", "编辑区", "方向键", "数字小键盘"];
  var RING_R = 34;
  var RING_C = 2 * Math.PI * RING_R;

  window.TP_KeyboardTest = {
    name: "KeyboardTest",
    template: `
<div class="kb">
  <div class="kb-head">
    <h2 class="kb-title">键盘全键测试</h2>
    <div class="kb-progress">
      <div class="ring-box">
        <svg class="ring" viewBox="0 0 80 80">
          <circle class="ring-track" cx="40" cy="40" :r="ringR"></circle>
          <circle class="ring-fill" cx="40" cy="40" :r="ringR" :style="ringStyle"></circle>
        </svg>
        <span class="ring-pct">{{ percent }}%</span>
      </div>
      <div class="kb-count">
        <span>已测试</span>
        <strong>{{ testedCount }}/{{ totalCount }}</strong>
      </div>
    </div>
    <button class="btn ghost" type="button" @click="reset">重置</button>
  </div>

  <div class="kb-legend">
    <span v-for="s in sections" :key="s" class="legend-chip">{{ s }}</span>
  </div>

  <div class="kb-panel">
    <div class="kb-scroll">
      <div class="kb-grid">
        <div
          v-for="k in layout"
          :key="k.code"
          class="key"
          :class="{ tested: testedKeys.has(k.code), pressed: pressedCode === k.code }"
          :style="keyStyle(k)"
        ><span>{{ k.label }}</span></div>
      </div>
    </div>
  </div>

  <p class="kb-tip">按下键盘任意键，对应键帽将点亮为绿色并持久保留，直到点击重置</p>
  <p class="kb-note">测试期间已屏蔽所测按键的浏览器默认行为；系统级组合（如 Alt+Tab、Ctrl+Alt+Del）与浏览器保留组合（如 Ctrl+W）无法屏蔽。</p>
</div>
`,
    setup: function () {
      /* 惰性读取数据层（评审 P2-5）：setup 时才取 window.TP_KEYBOARD_LAYOUT */
      var LAYOUT = window.TP_KEYBOARD_LAYOUT || [];
      /* code→key 映射：遍历布局数据自动生成，O(1) 命中（7.2/9.7） */
      var codeMap = new Map();
      LAYOUT.forEach(function (k) { codeMap.set(k.code, k); });

      var testedKeys = reactive(new Set());
      var pressedCode = ref(null);
      var pressTimer = null;

      var totalCount = computed(function () { return LAYOUT.length; });
      var testedCount = computed(function () { return testedKeys.size; });
      var percent = computed(function () {
        var total = totalCount.value;
        if (total <= 0) return 0;
        return Math.round((testedCount.value / total) * 100);
      });
      var ringStyle = computed(function () {
        var off = RING_C * (1 - percent.value / 100);
        return {
          strokeDasharray: String(RING_C),
          strokeDashoffset: String(off)
        };
      });

      function keyStyle(k) {
        return {
          gridColumn: k.c + " / span " + k.w,
          gridRow: k.r + " / span " + (k.rs || 1)
        };
      }

      function flash(code) {
        pressedCode.value = code;
        if (pressTimer !== null) clearTimeout(pressTimer);
        pressTimer = setTimeout(function () { pressedCode.value = null; }, 160);
      }

      /* key 识别：e.code 查 Map O(1) 命中（9.7）；
         e.code 缺失时不做 label 回退——同名 label（Enter/Shift/Alt/Ctrl/Win 各左右两枚）
         会歧义误命中，直接返回 null（评审 P2-3） */
      function findKey(e) {
        if (!e || !e.code) return null;
        return codeMap.get(e.code) || null;
      }

      function onKeydown(e) {
        var def = findKey(e);
        if (!def) return;
        testedKeys.add(def.code);
        flash(def.code);
        // 头部键盘可达性（评审 P2-6，裁决 9 例外一）：事件源自头部控件（.app-bar）时
        // 不 preventDefault，保证 Tab/空格/Enter 可聚焦与激活头部按钮
        var tgt = e.target;
        var fromBar = !!(tgt && tgt.closest && tgt.closest(".app-bar"));
        if (fromBar) return;
        // 裁决 9：凡 e.code 命中 104 键测试布局一律屏蔽浏览器默认行为——
        // 含 F1–F12（F5 刷新）、Tab、空格、方向键、Enter、Backspace、Ctrl/Alt/Shift，
        // 以及 Ctrl+R、Ctrl+F5 等主键码在测试集内的组合（不区分修饰键）
        e.preventDefault();
      }

      function reset() {
        testedKeys.clear();
        pressedCode.value = null;
      }

      onMounted(function () {
        document.addEventListener("keydown", onKeydown);
      });
      onUnmounted(function () {
        document.removeEventListener("keydown", onKeydown);   // 防监听泄漏（9.3/B12）
        if (pressTimer !== null) clearTimeout(pressTimer);
      });

      return {
        layout: LAYOUT,
        sections: SECTIONS,
        testedKeys: testedKeys,
        pressedCode: pressedCode,
        testedCount: testedCount,
        totalCount: totalCount,
        percent: percent,
        ringR: RING_R,
        ringStyle: ringStyle,
        keyStyle: keyStyle,
        reset: reset
      };
    }
  };
})();
