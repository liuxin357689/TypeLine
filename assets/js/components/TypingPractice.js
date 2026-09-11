/* ==========================================================================
 * TypingPractice 打字练习组件（设计文档 4.2 / 6 章）
 * 核心：逐行配对输入（6.8）——文章按容器实际宽度自适应换行切分为 rows
 *       （隐藏镜像 .row-mirror 逐字符 span 测 top 折行点，任务 #12 / #20C3），
 *       每个 row 上部=原文逐字四态标色，下部=该行配对输入行；
 *       active row 蓝框高亮 + 自动滚入；输满推进；退格跨行回退。
 * IME 兼容（6.1/9.1）、错字分离（6.3/9.2）、统计（6.5）、完成弹窗（P3）。
 * ========================================================================== */
(function () {
  var Vue = window.Vue;
  var ref = Vue.ref, computed = Vue.computed, watch = Vue.watch, inject = Vue.inject,
      nextTick = Vue.nextTick, onMounted = Vue.onMounted, onUnmounted = Vue.onUnmounted;

  /* #33：文章池改由调用方传入（当前分类 TP_CATS[cat].articles）；
     excludeId 防连抽同篇（池仅 1 篇时回退全池） */
  function pickArticle(pool, excludeId) {
    var ARTICLES = pool || [];
    if (!ARTICLES.length) return { id: 0, title: "", text: "" };
    var cand = ARTICLES.filter(function (a) { return a.id !== excludeId; });
    if (!cand.length) cand = ARTICLES;
    return cand[Math.floor(Math.random() * cand.length)];
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  window.TP_TypingPractice = {
    name: "TypingPractice",
    template: `
<div class="tp" :class="['prof-' + profile.slot, { 'prof-verse': profile.lineBreak === 'verse' }]">
  <!-- #35 渲染档案镜像：chunk = verse-block / word / flat-run；字符 span 统一 .mchar，
       槽类由 profile 决定（fixed=ch-slot 定宽 / measured|single=mw-char 自然宽） -->
  <div ref="mirrorRef" class="row-mirror line-text" aria-hidden="true"><span
      v-for="(ck, ki) in mirrorChunks"
      :key="ki"
      :class="ck.block ? 'verse-block' : (ck.word ? 'word' : 'flat-run')"
    ><span
        v-for="(ch, ci) in ck.chars"
        :key="ci"
        class="mchar"
        :class="mirrorCharClass"
      >{{ ch }}</span></span></div>
  <!-- F3 模式工具条 + 元信息合并单行（#28）：左=分类 chip+换分类+模式分段（全文/限时+时长档），
       中=篇/字数，右=换一篇/重新开始；窄屏 flex-wrap 换行。持久化 typeline:prefs:v1 -->
  <div class="tp-toolbar">
    <div class="tp-bar-left">
      <span class="cat-chip" :title="'当前分类：' + catName">{{ catName }}</span>
      <button class="btn ghost" type="button" @click="changeCategory">换分类</button>
      <div class="seg" role="group" aria-label="练习模式">
        <button type="button" class="seg-btn" :class="{ on: prefs.mode === 'full' }" @click="setPref({ mode: 'full' })">全文</button>
        <button type="button" class="seg-btn" :class="{ on: prefs.mode === 'timed' }" @click="setPref({ mode: 'timed' })">限时</button>
      </div>
      <div v-if="prefs.mode === 'timed'" class="seg" role="group" aria-label="限时时长">
        <button type="button" class="seg-btn" :class="{ on: prefs.timedSec === 30 }" @click="setPref({ timedSec: 30 })">30s</button>
        <button type="button" class="seg-btn" :class="{ on: prefs.timedSec === 60 }" @click="setPref({ timedSec: 60 })">60s</button>
        <button type="button" class="seg-btn" :class="{ on: prefs.timedSec === 120 }" @click="setPref({ timedSec: 120 })">120s</button>
      </div>
    </div>
    <span class="tp-meta-text" :title="article.title">第 {{ article.id }} 篇 · {{ totalChars }} 字</span>
    <div class="tp-meta-actions">
      <button class="btn ghost" type="button" @click="nextArticle">换一篇</button>
      <button class="btn ghost" type="button" @click="restart">重新开始</button>
    </div>
  </div>

  <div class="progress-track">
    <div class="progress-bar" :style="{ width: progress + '%' }"></div>
  </div>

  <div class="rows" ref="rowsBox" @click="focusInput">
    <div
      v-for="(row, ri) in rows"
      :key="article.id + '-' + ri"
      :ref="function (el) { setRowRef(ri, el); }"
      :style="{ '--i': ri }"
      class="row"
      :class="{ active: ri === activeRowIndex, 'row-single': profile.slot === 'single', 'row-dim': profile.lineBreak === 'verse' && ri !== activeRowIndex && pos <= row.start }"
    >
      <!-- #35 单行覆盖模式（english/poetry）：单行字符流三态 + 错位置替换显示用户错字符；
           IME 组合预览浮层行下方悬浮（#37：不覆盖原文）；提示文字已全删（#37） -->
      <template v-if="profile.slot === 'single'">
        <div class="row-source line-text" :class="{ 'verse-centered': profile.lineBreak === 'verse' }"><span
            v-for="(ch, ci) in row.chars"
            :key="ci"
            class="char mw-char"
            :class="charStates[row.start + ci]"
          >{{ overlayChar(row.start + ci, ch) }}</span></div>
        <span
          v-if="ri === activeRowIndex && !done && composingText"
          class="composing-float"
        >{{ composingText }}</span>
      </template>
      <!-- 双行配对模式（fixed/measured，6.8） -->
      <template v-else>
        <div v-if="profile.slot === 'measured'" class="row-source line-text"><span
            v-for="(grp, gi) in groupRow(row)"
            :key="gi"
            :class="grp.word ? 'word' : 'sp-run'"
          ><span
              v-for="(ch, ci) in grp.chars"
              :key="ci"
              class="char ch-m"
              :class="charStates[grp.start + ci]"
              :style="slotStyle(grp.start + ci)"
            >{{ ch }}</span></span></div>
        <div v-else class="row-source line-text"><span
            v-for="(ch, ci) in row.chars"
            :key="ci"
            class="char ch-slot"
            :class="charStates[row.start + ci]"
          >{{ ch }}</span></div>
        <!-- measured 输入行改 block 排版（.row-input-measured）：与原文行同排版上下文，
             词距/空格宽/折行完全同源（修复 flex 匿名项导致的两行偏移，#35 插单 B） -->
        <div class="row-input" :class="{ 'row-input-measured': profile.slot === 'measured' }">
          <span v-if="ri === activeRowIndex && !done" class="caret" aria-hidden="true"></span>
          <template v-if="inputSlice(row).length">
            <!-- #38 原文位置锁定：槽 i 恒为原文槽（宽=charWidths[i] inline 绑定不变），
                 词间 margin 仅原文词边界产生；正确字符绿色、错字红色槽内替换（不占额外宽度、不推挤后续槽） -->
            <template v-if="profile.slot === 'measured'">
              <span
                v-for="(grp, gi) in groupRow(row)"
                :key="'i' + gi"
                :class="grp.word ? 'word' : 'sp-run'"
              ><span
                  v-for="(it, ci) in lockedGroup(grp)"
                  :key="ci"
                  class="in-char ch-m"
                  :class="it.ok ? 'good' : 'bad'"
                  :style="slotStyle(it.start)"
                >{{ it.ch }}</span></span>
            </template>
            <template v-else>
              <span
                v-for="(item, ci) in inputSlice(row)"
                :key="ci"
                class="in-char ch-slot"
                :class="{ bad: !item.ok }"
              >{{ item.ch }}</span>
            </template>
          </template>
          <div
            v-else-if="!(ri === activeRowIndex && !done && composingText)"
            class="row-input-empty"
            :class="{ dashed: ri === activeRowIndex && !done }"
          ></div>
          <!-- IME 组合预览（任务 #20D）：隐藏 input 中的拼音串临时渲染到已提交字符之后，
               textContent 插值渲染（禁 v-html），compositionend 即清空 -->
          <span
            v-if="ri === activeRowIndex && !done && composingText"
            class="composing"
          >{{ composingText }}</span>
        </div>
      </template>
    </div>
    <input
      ref="inputRef"
      class="hidden-input"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      aria-label="打字输入区"
      @compositionstart="onCompStart"
      @compositionupdate="onCompUpdate"
      @compositionend="onCompEnd"
      @input="onInput"
      @keydown="onKeydown"
      @paste.prevent
    />
  </div>

  <div class="pos-indicator">
    <div class="pos-info">当前：第 {{ currentRowNum }} 行 · 第 {{ currentColNum }} 列 · 总 {{ pos }} / {{ totalChars }} 字</div>
    <div class="pos-track">
      <div class="pos-fill" :style="{ width: progress + '%' }"></div>
    </div>
  </div>

  <div class="hud">
    <div v-if="isTimed" class="pill" :class="{ warn: remaining <= 10000 }"><span class="pill-label">剩余</span><span class="pill-value">{{ remainingText }}</span></div>
    <div class="pill"><span class="pill-label">用时</span><span class="pill-value">{{ timeText }}</span></div>
    <div class="pill"><span class="pill-label">速度</span><span class="pill-value">{{ speed }} 字/分钟</span></div>
    <div class="pill"><span class="pill-label">准确率</span><span class="pill-value">{{ accuracy }}%</span></div>
  </div>

  <div v-if="toast" class="tp-toast" role="status">{{ toast }}</div>

  <div v-if="done" class="modal-mask">
    <div class="modal-card">
      <div class="modal-badge">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>
      </div>
      <h2 class="modal-title">练习完成</h2>
      <div v-if="isTimed" class="modal-mode-note">限时模式 · {{ prefs.timedSec }}s</div>
      <div class="modal-stats">
        <div class="m-stat">
          <span class="m-label">用时</span>
          <span class="m-value">{{ timeText }}</span>
        </div>
        <div class="m-stat main">
          <span class="m-label">速度</span>
          <span class="m-value">{{ speed }}<span class="m-unit">字/分钟</span></span>
        </div>
        <div class="m-stat">
          <span class="m-label">准确率</span>
          <span class="m-value">{{ accuracy }}%</span>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn primary" type="button" @click="nextArticle">换一篇</button>
        <button class="btn outline" type="button" @click="restart">再试一次</button>
      </div>
    </div>
  </div>
</div>
`,
    setup: function () {
      /* ---------- #33 分类接入：池=TP_CATS[cat].articles（app.js 保证挂载后才进入本视图） ---------- */
      var currentCat = inject('currentCat', null);
      var goHome = inject('goHome', null);
      var catId = computed(function () { return (currentCat && currentCat.value) || ''; });
      var articlePool = computed(function () {
        var cat = (window.TP_CATS || {})[catId.value];
        return (cat && cat.articles) || [];
      });
      var catName = computed(function () {
        var e = window.TP_DataLoader && window.TP_DataLoader.getEntry(catId.value);
        return e ? e.name : '未选分类';
      });
      /* ---------- #35 渲染档案：注册表 profile 三旋钮（lineBreak/slot/font） ----------
         fixed   = --ch-w 定宽槽双行（short/long，零变化）
         measured= mirror 逐字测宽槽双行（code，词间断行）
         single  = 单行覆盖式（english/poetry，错字替换显示） */
      var profile = computed(function () {
        var e = window.TP_DataLoader && window.TP_DataLoader.getEntry(catId.value);
        return (e && e.profile) || { lineBreak: 'width', slot: 'fixed', font: 'step' };
      });
      /* 换分类：回首页并清当前分类；组件随卸载触发 onUnmounted 既有
         ≥20 字放弃存档语义（与切视图一致，裁决要求）；prefs.cat 保留供「继续上次」 */
      function changeCategory() {
        if (typeof goHome === 'function') goHome({ clearCat: true });
      }

      /* ---------- 响应式状态（4.5） ---------- */
      var article = ref(pickArticle(articlePool.value, null));
      var pos = ref(0);
      var userInput = ref([]);          // 每位实际输入字符（与原文分离，9.2）
      var startTime = ref(null);
      var elapsed = ref(0);             // 毫秒
      var done = ref(false);
      var isComposing = ref(false);
      var composingText = ref("");     // IME 组合中的拼音串（任务 #20D，仅视觉，不入 pos/userInput）
      var timerId = null;
      var inputRef = ref(null);
      var rowsBox = ref(null);
      var mirrorRef = ref(null);
      var rowEls = [];
      var resetting = false;           // #28：重置/换文期间抑制 active 行居中跟随
      var lineStarts = ref([]);        // 自适应折行行首全局索引（任务 #12）
      var measureTimer = null;         // debounce 定时器
      var fontsPending = true;         // fonts.ready 回调存活守卫

      /* 自适应换行（任务 #12）：行字符数由容器实际宽度决定（镜像测量），
         不再使用固定字数常量；lineStarts 为各行行首全文全局索引 */

      /* F3 偏好（模式/时长）：读自 TP_Store.getPrefs()，持久化 typeline:prefs:v1；
         标点开关已裁决取消，偏好仅 { mode, timedSec } */
      var prefs = ref((window.TP_Store && window.TP_Store.getPrefs)
        ? window.TP_Store.getPrefs()
        : { mode: 'full', timedSec: 30 });

      /* 原文字符数组（只读，Array.from 安全处理码点）；
         原文标点始终原样参与比对与切行（无任何过滤分支，标点开关已取消） */
      var textChars = computed(function () {
        return Array.from((article.value && article.value.text) || "");
      });
      var totalChars = computed(function () { return textChars.value.length; });

      /* #35 verse 断行（poetry）：article.verses → [{chars, start}]；
         join 长度与全文不等时回落 width 折行（守卫） */
      var verses = computed(function () {
        var a = article.value;
        var vs = (a && a.verses) || null;
        if (!vs || !vs.length) return null;
        var out = [];
        var s = 0;
        for (var i = 0; i < vs.length; i++) {
          var vc = Array.from(vs[i]);
          out.push({ chars: vc, start: s });
          s += vc.length;
        }
        return s === textChars.value.length ? out : null;
      });

      /* #35 词边界（measured）：空格分词编号，空格字符为 -1 */
      var wordIds = computed(function () {
        var chars = textChars.value;
        var out = new Array(chars.length);
        var wid = 0;
        var inWord = false;
        for (var i = 0; i < chars.length; i++) {
          if (chars[i] === ' ') { out[i] = -1; inWord = false; }
          else { if (!inWord) { wid++; inWord = true; } out[i] = wid; }
        }
        return out;
      });

      /* #35 词分组：[from,to) 全局索引切为 {word, chars, start} 序列（空格独立成组） */
      function wordGroups(from, to) {
        var chars = textChars.value;
        var ids = wordIds.value;
        var out = [];
        var i = from;
        while (i < to) {
          if (ids[i] === -1) {
            out.push({ word: false, chars: chars.slice(i, i + 1), start: i });
            i++;
          } else {
            var w = ids[i];
            var j = i;
            while (j < to && ids[j] === w) j++;
            out.push({ word: true, chars: chars.slice(i, j), start: i });
            i = j;
          }
        }
        return out;
      }
      function groupRow(row) { return wordGroups(row.start, row.end); }
      /* #38 measured 输入行「原文位置锁定」模型（仅渲染层，引擎语义/错字本/统计零变化）：
         已提交流→原文槽重建映射：流字符 === chars[target] → 覆盖该槽（显原文字符绿色）；
         否则错字 → 不消耗槽，记在当前 target 槽红色槽内替换（同槽保留最近一次）；
         多余错字不再把后续槽整体推挤，词间 margin 仍仅原文词边界产生 */
      var lockedModel = computed(function () {
        var chars = textChars.value;
        var ui = userInput.value;
        var red = {};
        var t = 0;
        for (var k = 0; k < ui.length; k++) {
          if (t < chars.length && ui[k] === chars[t]) { t++; }
          else { red[t] = ui[k]; }
        }
        return { red: red, cover: t };
      });
      /* 输入行词分组切片（measured，#38 锁定）：连续原文槽 [grp.start, min(grp.end, limit))；
         start=全局索引（harness 逐词首字符对齐断言用） */
      function lockedGroup(grp) {
        var m = lockedModel.value;
        var chars = textChars.value;
        var limit = m.cover + (m.red[m.cover] !== undefined ? 1 : 0);
        var end = Math.min(grp.start + grp.chars.length, limit);
        var out = [];
        for (var i = grp.start; i < end; i++) {
          var r = m.red[i];
          out.push({ ch: r !== undefined ? r : chars[i], ok: r === undefined, start: i });
        }
        return out;
      }

      /* #35 镜像 chunk：verse=诗行块 / measured=词组序列 / 其余=全文单块 */
      var mirrorChunks = computed(function () {
        var chars = textChars.value;
        var p = profile.value;
        if (p.lineBreak === 'verse' && verses.value) {
          return verses.value.map(function (v) {
            return { block: true, word: false, chars: v.chars, start: v.start };
          });
        }
        if (p.slot === 'measured') return wordGroups(0, chars.length);
        return [{ block: false, word: false, chars: chars, start: 0 }];
      });
      var mirrorCharClass = computed(function () {
        return profile.value.slot === 'fixed' ? 'ch-slot' : 'mw-char';
      });

      /* #35 measured 槽宽：mirror 逐字 offsetWidth（原文/输入两行同源 inline 绑定） */
      var charWidths = ref([]);
      function slotStyle(i) {
        var w = charWidths.value[i];
        return w ? { width: w + 'px' } : null;
      }
      /* #35 single 覆盖：错位置替换显示用户错字符（该位置不显示原文） */
      function overlayChar(i, ch) {
        if (i < pos.value) {
          var u = userInput.value[i];
          if (u !== ch) return u;
        }
        return ch;
      }

      /* 行切分：由镜像测量得到的 lineStarts 派生；start/end 均为全文全局索引（末行 end = 全文长度） */
      var rows = computed(function () {
        var chars = textChars.value;
        var out = [];
        if (!chars.length) return out;                  // 全文为空 rows=[]（守卫 4）
        var ls = lineStarts.value;
        if (!ls || !ls.length) {
          /* 引导种子：首测前全文暂作单行渲染，保证 onMounted 时有真实 .row-source
             可量宽；onMounted 内同步测量后替换为真实折行（paint 前完成，无闪烁） */
          return [{ chars: chars.slice(), start: 0, end: chars.length }];
        }
        for (var i = 0; i < ls.length; i++) {
          var s = ls[i];
          var e = (i + 1 < ls.length) ? ls[i + 1] : chars.length;
          out.push({ chars: chars.slice(s, e), start: s, end: e });
        }
        return out;
      });

      /* active row = 包含 pos 的行（线性查找；pos 越过末行行首时归末行） */
      var activeRowIndex = computed(function () {
        var rs = rows.value;
        if (!rs.length) return 0;
        var p = pos.value;
        for (var i = 0; i < rs.length; i++) {
          if (p >= rs[i].start && p < rs[i].end) return i;
        }
        return rs.length - 1;
      });

      /* 逐字四态（6.2） */
      var charStates = computed(function () {
        var chars = textChars.value;
        var ui = userInput.value;
        var p = pos.value;
        var out = new Array(chars.length);
        for (var i = 0; i < chars.length; i++) {
          if (i < p) out[i] = ui[i] === chars[i] ? "correct" : "wrong";
          else if (i === p) out[i] = "cursor";
          else out[i] = "pending";
        }
        return out;
      });

      /* 当前输入位置指示（行号 / 列号，1 起始） */
      var currentRowNum = computed(function () { return activeRowIndex.value + 1; });
      var currentColNum = computed(function () {
        var rs = rows.value;
        if (!rs.length) return 1;
        var row = rs[activeRowIndex.value];
        var col = pos.value - row.start + 1;
        return Math.max(1, Math.min(col, row.chars.length));
      });

      var correctCount = computed(function () {
        var chars = textChars.value;
        var ui = userInput.value;
        var n = 0;
        for (var i = 0; i < pos.value && i < chars.length; i++) {
          if (ui[i] === chars[i]) n++;
        }
        return n;
      });

      /* 统计（6.5，全除零守卫，裁决 3） */
      var timeText = computed(function () {
        var s = Math.floor(elapsed.value / 1000);
        return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
      });
      var speed = computed(function () {
        var mins = elapsed.value / 60000;
        if (!(mins > 0)) return 0;
        return Math.round(correctCount.value / mins);
      });
      var accuracy = computed(function () {
        if (pos.value <= 0) return 100;
        return Math.round((correctCount.value / pos.value) * 100);
      });
      var progress = computed(function () {
        var len = totalChars.value;
        if (len <= 0) return 0;
        return Math.min(100, (pos.value / len) * 100);
      });

      /* ---------- F3 限时模式 ---------- */
      var isTimed   = computed(function () { return prefs.value.mode === 'timed'; });
      var limitMs   = computed(function () { return (prefs.value.timedSec || 30) * 1000; });
      var remaining = computed(function () {
        if (!isTimed.value) return 0;
        var r = limitMs.value - elapsed.value;
        return r < 0 ? 0 : r;
      });
      var remainingText = computed(function () {
        var s = Math.ceil(remaining.value / 1000);
        return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
      });

      /* ---------- 计时（F4：事件标记 + 1000ms 心跳合并渲染） ---------- */
      /* F4 性能优化：原 200ms 轮询改为脏标记 + 心跳——
         输入/提交事件（pushChar / Backspace）仅置 statsDirty，不同步写 elapsed；
         1000ms 心跳统一 flush elapsed（秒级推进）并合并渲染脏标记；
         统计口径不变：完成/放弃存档仍走 stopTimer(true) 精确取毫秒；
         F3 限时归零检查移入心跳（结算粒度 1s，finishTimed 仍锁 elapsed=限时长）。 */
      var statsDirty = false;
      var hbStats = { ticks: 0, flushes: 0, marks: 0 };   /* 自测观测口（F4），卸载后 ticks 停增 */
      window.TP_TypingPractice.hbStats = hbStats;
      function markStats() { statsDirty = true; hbStats.marks++; }
      function flushStats() {
        var dirty = statsDirty;
        statsDirty = false;
        if (startTime.value === null || done.value) return;   /* 未开局/已完成：elapsed 锁定 */
        elapsed.value = Date.now() - startTime.value;
        if (dirty) hbStats.flushes++;
      }
      function stopTimer(finalize) {
        if (timerId !== null) { clearInterval(timerId); timerId = null; }
        if (finalize && startTime.value !== null) {
          elapsed.value = Date.now() - startTime.value;
        }
      }
      function startTimer() {
        if (startTime.value !== null) return;
        startTime.value = Date.now();
        elapsed.value = 0;
        timerId = setInterval(function () {
          hbStats.ticks++;
          flushStats();                                   /* 心跳：秒级推进 + 合并渲染标记 */
          /* F3 限时：倒计时归零结算（心跳粒度 1s） */
          if (isTimed.value && !done.value && elapsed.value >= limitMs.value) finishTimed();
        }, 1000);
      }
      /* F3 限时结算：组合中未结束的 IME 输入不提交不计字（丢弃 composing 与 input 缓冲，
         不产生半条记录）；elapsed 置为限时长——字/分口径与全文模式一致 =
         correctCount/(durationMs/60000)，此处 durationMs=限时长（实际用时） */
      function finishTimed() {
        if (done.value) return;
        isComposing.value = false;
        composingText.value = "";
        if (inputRef.value) inputRef.value.value = "";
        elapsed.value = limitMs.value;   /* 实际用时 = 限时长 */
        stopTimer(false);                /* 停表但不再 finalize（elapsed 已定为限时长） */
        done.value = true;               /* watch(done) → saveRecordOnce(false) → mode='timed' */
      }

      /* ---------- 输入核心 ---------- */
      function pushChar(ch) {
        if (done.value) return;                       // 完成守卫（B10）
        var len = totalChars.value;
        if (pos.value >= len) return;                 // 越界守卫（B2）
        startTimer();                                 // 计时起点=首字符（6.5）
        userInput.value.push(ch);
        pos.value = pos.value + 1;
        markStats();                              /* F4：提交事件置脏，心跳合并渲染统计 */
        if (pos.value >= len && len > 0) {            // 最后一行输满 → 完成
          done.value = true;
          stopTimer(true);
          saveRecordOnce(false);                      // V2.0 F1：完成时存档（#26 改为 once 互斥）
        }
      }
      function commitString(str) {
        if (!str) return;
        var it = String(str)[Symbol.iterator]();
        var step;
        while (!(step = it.next()).done) pushChar(step.value);
      }

      /* IME 组合预览（任务 #20D）：读取隐藏 input 当前组合串到 composingText，
         仅作输入行视觉渲染与组合期锚点参照，不触碰 pos/userInput/charStates/统计 */
      function syncComposingText() {
        var el = inputRef.value;
        composingText.value = el ? el.value : "";
      }
      function onCompStart() { isComposing.value = true; syncComposingText(); }
      function onCompUpdate() { syncComposingText(); }
      function onCompEnd(e) {
        isComposing.value = false;
        composingText.value = "";                 // 预览清空；字符仍走 e.data 提交，不重复入库
        commitString(e.data);
        if (inputRef.value) inputRef.value.value = "";
      }
      function onInput(e) {
        // 自愈（评审 P1-1）：以浏览器 e.isComposing 为权威；
        // 若 compositionend 丢失导致内部标志卡死为 true，先纠正再判定，避免吞输入
        if (e && e.isComposing === false && isComposing.value) isComposing.value = false;
        // 组合期跳过提交（6.1），但以 input 事件兜底同步组合预览（任务 #20D）
        if (isComposing.value || (e && e.isComposing)) { syncComposingText(); return; }
        var el = inputRef.value;
        if (!el) return;
        var v = el.value;
        if (v) { commitString(v); el.value = ""; }
      }
      function onKeydown(e) {
        // 自愈（评审 P1-1）：e.isComposing===false 且非 229 时纠正卡死的内部标志
        if (e.isComposing === false && e.keyCode !== 229 && isComposing.value) isComposing.value = false;
        // 组合期跳过控制键处理（6.1/9.1，B8）
        if (isComposing.value || e.isComposing || e.keyCode === 229) return;
        if (e.key === "Tab") { e.preventDefault(); return; }    // 防焦点丢失（裁决 4）
        if (e.key === "Backspace") {
          e.preventDefault();
          if (done.value) return;
          if (pos.value <= 0) return;                           // 起点守卫（B3）
          pos.value = pos.value - 1;                            // 跨行回退由 computed 自动重算（6.4）
          userInput.value = userInput.value.slice(0, pos.value);
          markStats();                                          /* F4：退格亦为提交事件 */
        }
      }

      /* ---------- 换篇 / 重开 ---------- */
      function resetState() {
        stopTimer(false);
        sessionSaved = false;                          // #26：新一轮练习复位存档互斥
        resetting = true;                              // #28：抑制重置/换文期间的居中跟随
        setTimeout(function () { resetting = false; }, 0);
        pos.value = 0;
        userInput.value = [];
        startTime.value = null;
        elapsed.value = 0;
        done.value = false;
        isComposing.value = false;
        if (inputRef.value) inputRef.value.value = "";
        nextTick(function () {
          if (rowsBox.value) rowsBox.value.scrollTop = 0;
          focusInput();
        });
      }
      function restart() { resetState(); }
      function nextArticle() {
        /* V2.0 F1：换文时若已提交 ≥20 字且未完成且本轮未存档，保存为放弃记录（#26 once 互斥） */
        if (pos.value >= 20 && !done.value && !sessionSaved) { stopTimer(true); saveRecordOnce(true); }
        article.value = pickArticle(articlePool.value, article.value ? article.value.id : null);
        charWidths.value = [];                         // #35：换文复位测宽槽（新文重测）
        resetState();
        nextTick(function () {
          measureLines();
          nextTick(updateCaretAnchor);                           // 切文后更新锚点（#15A 条款 3）
        });
      }

      function focusInput() {
        if (inputRef.value) inputRef.value.focus({ preventScroll: true });
      }

      /* ---------- F3 偏好变更 ---------- */
      var toast = ref("");
      var toastTimer = null;
      function showToast(msg) {
        toast.value = msg;
        if (toastTimer !== null) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.value = ""; toastTimer = null; }, 2200);
      }
      function setPref(patch) {
        if (!window.TP_Store || !window.TP_Store.setPrefs) return;
        prefs.value = window.TP_Store.setPrefs(patch);
        onPrefsChange();
      }
      /* 裁决（F3）：练习进行中（pos>0 且未完成）切换 模式/时长 → 重置当篇并 toast 提示；
         pos=0（尚未输入）时无感不重置。偏好变更为用户主动行为，不记放弃记录。 */
      function onPrefsChange() {
        if (pos.value > 0 && !done.value) {
          resetState();
          showToast("模式已更改，本篇已重置");
        }
      }

      /* ---------- V2.0 F1：练习记录存档 ---------- */
      /* #26 修复：每轮练习（reset→完成/放弃）仅存档一次的互斥标志。
         完成/换文/切视图三个触发点共用，避免漏写或重复写；resetState 复位。 */
      var sessionSaved = false;
      function saveRecordOnce(abandoned) {
        if (sessionSaved) return;                    // 本轮已存档，幂等跳过
        sessionSaved = true;
        saveRecord(abandoned);
      }
      /* 兼保（#26）：done 翻转即存档，即使 pushChar 同步路径被中断也必落盘 */
      watch(done, function (v) { if (v) saveRecordOnce(false); });

      /* 收集当前所有错字（用户输入 vs 原文），供 store 记录及 F2 错字本使用；
         context = 原文中以 pos 为中心最多 7 字的上下文片段 */
      function collectWrongChars() {
        var chars = textChars.value;
        var ui    = userInput.value;
        var len   = chars.length;
        var out   = [];
        for (var i = 0; i < pos.value && i < len; i++) {
          if (ui[i] !== chars[i]) {
            var cs = Math.max(0, i - 3);
            var ce = Math.min(len, i + 4);
            out.push({
              ch:      ui[i],
              expected: chars[i],
              pos:     i,
              context: chars.slice(cs, ce).join('')
            });
          }
        }
        return out;
      }

      /* 保存一条记录到 TP_Store；口径完全沿用 V1 computed（speed/accuracy/elapsed） */
      function saveRecord(abandoned) {
        if (!window.TP_Store) return;
        var rec = window.TP_Store.createRecord({
          articleId:  article.value  ? article.value.id : 0,
          chars:      pos.value,
          durationMs: elapsed.value,
          cpm:        speed.value,       /* = round(correctCount/(elapsed/60000)) */
          accuracy:   accuracy.value,    /* = round(correctCount/pos*100) */
          wrongChars: collectWrongChars(),
          mode:       isTimed.value ? 'timed' : 'full',   /* F3：限时记录 mode='timed'（计入统计） */
          cat:        catId.value,                         /* #33：记录所属分类（旧记录无此字段→统计显示「历史」） */
          abandoned:  abandoned
        });
        window.TP_Store.addRecord(rec);
      }

      /* ---------- IME 锚点跟随 + 输入行光标同源定位（任务 #20A/B/D/E） ---------- */
      /* 隐藏 input 锚到「用户输入行下方」：
         top  = inLineRect.bottom - rowsRect.top + rows.scrollTop（紧贴底边，无额外下移，任务 #20E）
         left = 该行已提交输入的光标 x（k>0 取末个 .in-char 的 rect.right，k=0 取 inLineRect.left），
                组合期间取 .composing 片段的 rect.right（拼音末端，任务 #20D），
                换算内容坐标后 clamp 到 [0, rows.clientWidth - 240]；
         输入行 .caret 与锚点 left 同一计算（B3），二者视觉重合 */
      function updateCaretAnchor() {
        var inp = inputRef.value;
        var box = rowsBox.value;
        if (!inp || !box) return;
        var rowEl = rowEls[activeRowIndex.value];
        if (!rowEl) return;
        var rowsRect = box.getBoundingClientRect();
        var left, top;
        var caretEl = null;
        var inLineLeft = 0;
        if (profile.value.slot === 'single') {
          /* #35 single：锚点=当前字符 rect（top=行底、left=字符 left）；
             composing-float 同锚（bottom 对齐行底、left=字符 left，CSS translateY(-100%)） */
          var src = rowEl.querySelector('.row-source');
          if (!src) return;
          var spans = src.querySelectorAll('.char');
          if (!spans.length) return;
          var arow = rows.value[activeRowIndex.value];
          var idx = pos.value - arow.start;
          if (idx < 0) idx = 0;
          if (idx > spans.length - 1) idx = spans.length - 1;
          var cr = spans[idx].getBoundingClientRect();
          left = cr.left - rowsRect.left + box.scrollLeft;
          top = cr.bottom - rowsRect.top + box.scrollTop;
          var fl = rowEl.querySelector('.composing-float');
          if (fl) {
            /* #37：浮层改行下方悬浮（不覆盖原文）：left=当前字符左缘、top=活动行 rect.bottom+2；
               绝对定位包含块=padding box（.row 有 2px 边框），需扣 clientLeft/clientTop */
            var rowRect = rowEl.getBoundingClientRect();
            fl.style.left = (cr.left - rowRect.left - rowEl.clientLeft) + 'px';
            fl.style.top = (rowRect.bottom - rowRect.top - rowEl.clientTop + 2) + 'px';
          }
        } else {
          var inLine = rowEl.querySelector('.row-input');
          if (!inLine) return;
          var inChars = inLine.querySelectorAll('.in-char');
          var k = inChars.length;
          var inLineRect = inLine.getBoundingClientRect();
          var compEl = inLine.querySelector('.composing');
          /* #38 measured：渲染槽自 row.start 连续，光标锚视觉覆盖位 cover（cover-1 槽右缘=cover 槽左缘），
             错字槽内替换不推移光标；fixed 沿用末字符末端 */
          var x;
          if (compEl) {
            x = compEl.getBoundingClientRect().right;                      // 组合期：拼音末端（任务 #20D）
          } else if (profile.value.slot === 'measured') {
            var cidx = lockedModel.value.cover - 1 - rows.value[activeRowIndex.value].start;
            x = (cidx >= 0 && cidx < k) ? inChars[cidx].getBoundingClientRect().right : inLineRect.left;
          } else {
            x = k > 0 ? inChars[k - 1].getBoundingClientRect().right : inLineRect.left;
          }
          inLineLeft = inLineRect.left - rowsRect.left + box.scrollLeft;  // 输入行左缘内容坐标
          left = x - rowsRect.left + box.scrollLeft;
          top = inLineRect.bottom - rowsRect.top + box.scrollTop;   // 紧贴输入行底边（任务 #20E：移除 +2）
          caretEl = inLine.querySelector('.caret');
        }
        var maxLeft = box.clientWidth - 240;
        if (maxLeft < 0) maxLeft = 0;
        if (left < 0) left = 0;
        if (left > maxLeft) left = maxLeft;
        inp.style.left = left + "px";
        inp.style.top = top + "px";
        /* 光标与锚点同源：同一 left 换算到 .row-input 局部坐标（single 无 .caret） */
        if (caretEl) caretEl.style.left = (left - inLineLeft) + "px";
      }

      function setRowRef(i, el) { rowEls[i] = el; }

      /* 该行已输入字符切片（错字分离，6.3/6.8；全局索引口径不变，end 为行末全局索引） */
      function inputSlice(row) {
        var ui = userInput.value;
        var chars = textChars.value;
        var end = Math.min(pos.value, row.end);
        var out = [];
        for (var i = row.start; i < end; i++) {
          out.push({ ch: ui[i], ok: ui[i] === chars[i] });
        }
        return out;
      }

      /* #28 active 行自动居中跟随：变化时平滑滚动至 .rows 视觉中线；
         目标 scrollTop = row.offsetTop + row.offsetHeight/2 - clientHeight/2，
         clamp [0, scrollHeight-clientHeight]；behavior smooth，不支持回退 auto。
         首次进入/换文（resetting）不强制跳动，仅跨行推进时跟随；
         组合输入期间不触发额外滚动（仅 activeRowIndex 变化触发，天然满足） */
      function centerActiveRow(idx) {
        var box = rowsBox.value;
        var el = rowEls[idx];
        if (!box || !el) return;
        var target = el.offsetTop + el.offsetHeight / 2 - box.clientHeight / 2;
        var max = box.scrollHeight - box.clientHeight;
        if (target < 0) target = 0;
        if (target > max) target = max;
        var smooth = typeof box.scrollTo === "function" &&
          document.documentElement && "scrollBehavior" in document.documentElement.style;
        if (smooth) box.scrollTo({ top: target, behavior: "smooth" });
        else box.scrollTop = target;
        /* 平滑未启动兜底（部分 headless/无合成器环境 smooth 不推进）：
           120ms 后若 scrollTop 未移动且目标不同，回退 auto 直达；真实浏览器平滑已启动则不触发 */
        if (smooth) {
          var startTop = box.scrollTop;
          setTimeout(function () {
            if (Math.abs(box.scrollTop - startTop) < 1 && Math.abs(target - startTop) > 1) box.scrollTop = target;
          }, 120);
        }
      }

      /* active row 变化 → 居中跟随 + 更新 IME 锚点 */
      watch(activeRowIndex, function (idx, oldIdx) {
        nextTick(function () {
          if (!resetting && idx !== oldIdx) centerActiveRow(idx);
          updateCaretAnchor();
        });
      });

      /* pos 变化 → 更新 IME 锚点（任务 #15A 条款 3）；
         nextTick 立即调用 + rAF 双保险：确保 Vue DOM patch 完成后定位，
         并在浏览器下一帧 layout 稳定后再次校正 */
      watch(pos, function () {
        nextTick(function () {
          updateCaretAnchor();
          if (window.requestAnimationFrame) requestAnimationFrame(updateCaretAnchor);
        });
      });

      /* 组合串变化 → .composing 片段渲染后重算锚点/光标（任务 #20D，同 pos 的 nextTick+rAF 双保险） */
      watch(composingText, function () {
        nextTick(function () {
          updateCaretAnchor();
          if (window.requestAnimationFrame) requestAnimationFrame(updateCaretAnchor);
        });
      });

      /* ---------- 自适应换行测量（任务 #12，#20C3 改 span 测量） ---------- */
      /* 镜像 .row-mirror 将全文渲染为逐字符 .ch-slot span（v-for 与行同源字符数组，码点口径）；
         宽度由 JS 设为 .row-source 内容区宽，遍历镜像 span 的 getBoundingClientRect().top，
         top 变化处记为新行行首（索引即码点索引，与 rows 切片口径天然一致）；
         与 .row-source 共享 .line-text 排版（white-space: pre-wrap 杜绝空格折叠偏差） */
      /* F4 增量测量：镜像 span 仅随文章切换由 v-for 重建（resize 不重建）；
         全量重测仅发生在「文章 key 或容器宽变化」时；同宽重复信号（resize/RO/fonts.ready）
         命中 skip 去重，避免重复全量；lineStarts 语义不变 = 行首全局索引数组 */
      var measuredKey = "";          /* 文章 key = id + ':' + 码点数 */
      var measuredWidth = -1;        /* 上次全量测量时的内容区宽 */
      var measureStats = { full: 0, skip: 0, ms: 0 };   /* 自测观测口（F4）：全量次数/skip 次数/末次全量耗时 ms */
      window.TP_TypingPractice.measureStats = measureStats;
      function measureLines() {
        var chars = textChars.value;
        if (!chars.length) { lineStarts.value = []; measuredKey = ""; measuredWidth = -1; return; }   // 全文为空 rows=[]
        var mirror = mirrorRef.value;
        if (!mirror) return;                                    // 镜像未就绪：保留上一次 rows（守卫 4）
        var mspans = mirror.querySelectorAll('.mchar');          // #35：chunk 包裹后统一 .mchar 选取
        if (!mspans.length || mspans.length !== chars.length) return;  // 镜像未渲染/陈旧：保留上一次 rows
        var srcEl = null;
        for (var i = 0; i < rowEls.length; i++) {
          if (rowEls[i]) { srcEl = rowEls[i].querySelector(".row-source"); if (srcEl) break; }
        }
        if (!srcEl) return;                                     // 尚无可参照行：保留上一次 rows
        var cs = window.getComputedStyle(srcEl);
        var w = srcEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (!(w > 0)) return;                                   // 宽度<=0：保留上一次 rows（守卫 4）
        var key = (article.value ? article.value.id : 0) + ":" + chars.length;
        /* F4 增量去重：文章 key 与宽均未变且已有切分 → skip（无变化/重复信号不全量重测）；
           宽变化（key 同）或切文（key 异）→ 落入下方全量路径（现状行为保留） */
        if (key === measuredKey && w === measuredWidth && lineStarts.value.length) {
          measureStats.skip++;
          return;
        }
        var t0 = (window.performance && performance.now) ? performance.now() : 0;
        mirror.style.width = w + "px";
        var starts = [];
        var lastTop = null;
        for (var j = 0; j < mspans.length; j++) {
          var top = Math.round(mspans[j].getBoundingClientRect().top);
          if (lastTop === null || top !== lastTop) {
            starts.push(j);
            lastTop = top;
          }
        }
        if (starts.length) lineStarts.value = starts;           // 测量失败保留上一次 rows（守卫 4）
        /* #35 measured：逐字槽宽写入 charWidths（原文/输入两行 inline 同源绑定） */
        if (profile.value.slot === 'measured') {
          var ws = new Array(mspans.length);
          for (var q = 0; q < mspans.length; q++) {
            ws[q] = Math.round(mspans[q].getBoundingClientRect().width * 100) / 100;
          }
          charWidths.value = ws;
        }
        measuredKey = key;
        measuredWidth = w;
        measureStats.full++;
        if (window.performance && performance.now) measureStats.ms = Math.round((performance.now() - t0) * 10) / 10;
        nextTick(updateCaretAnchor);                              // 测量完成后更新锚点（#15A 条款 3）
      }

      /* 统一 debounce 约 120ms：resize / ResizeObserver / 断点变化共用 */
      function scheduleMeasure() {
        if (measureTimer !== null) clearTimeout(measureTimer);
        measureTimer = setTimeout(function () { measureTimer = null; measureLines(); }, 120);
      }

      /* ---------- 生命周期 ---------- */
      var mq = null;
      var resizeObs = null;
      var anchorSettleTimer = null;
      function onMqChange() { scheduleMeasure(); }              // 断点仅作重算信号，不再提供字符数
      function onWinResize() { scheduleMeasure(); }

      onMounted(function () {
        if (window.matchMedia) {
          mq = window.matchMedia("(max-width: 768px)");
          if (mq.addEventListener) mq.addEventListener("change", onMqChange);
          else if (mq.addListener) mq.addListener(onMqChange);
        }
        measureLines();                                         // 首测：立即切分
        updateCaretAnchor();                                      // 同步锚点（#15A 条款 3）
        /* tp-rise 动画使用 translateY(8px)，getBoundingClientRect 会包含 transform，
           动画结束后再校正一次确保锚点精确（0.4s + max delay ≈ 0.5s） */
        anchorSettleTimer = setTimeout(updateCaretAnchor, 550);
        if (window.ResizeObserver && rowsBox.value) {
          resizeObs = new ResizeObserver(function () { scheduleMeasure(); });
          resizeObs.observe(rowsBox.value);
        }
        window.addEventListener("resize", onWinResize);         // resize 兜底
        if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
          document.fonts.ready.then(function () {
            if (fontsPending) measureLines();                   // 字体就绪后重测
          });
        }
        focusInput();
      });
      onUnmounted(function () {
        /* V2.0 F1：切换视图时若已提交 ≥20 字且未完成且本轮未存档，保存为放弃记录（#26 once 互斥） */
        if (pos.value >= 20 && !done.value && !sessionSaved) { stopTimer(true); saveRecordOnce(true); }
        stopTimer(false);                                       // 防定时器泄漏（B17）
        fontsPending = false;
        if (measureTimer !== null) { clearTimeout(measureTimer); measureTimer = null; }
        if (toastTimer !== null) { clearTimeout(toastTimer); toastTimer = null; }
        if (anchorSettleTimer !== null) { clearTimeout(anchorSettleTimer); anchorSettleTimer = null; }
        if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
        window.removeEventListener("resize", onWinResize);
        if (mq) {
          if (mq.removeEventListener) mq.removeEventListener("change", onMqChange);
          else if (mq.removeListener) mq.removeListener(onMqChange);
        }
      });

      /* #35 自测观测口：harness 断言用只读快照（rows/wordIds/verses/profile/槽宽数） */
      window.TP_TypingPractice.probe = function () {
        return {
          profile: profile.value,
          rows: rows.value.map(function (r) { return { start: r.start, end: r.end }; }),
          wordIds: wordIds.value,
          verses: verses.value ? verses.value.map(function (v) { return { start: v.start, len: v.chars.length }; }) : null,
          charWidths: charWidths.value.length,
          lockCover: lockedModel.value.cover
        };
      };

      return {
        article: article,
        pos: pos,
        done: done,
        composingText: composingText,
        rows: rows,
        activeRowIndex: activeRowIndex,
        charStates: charStates,
        textChars: textChars,
        totalChars: totalChars,
        currentRowNum: currentRowNum,
        currentColNum: currentColNum,
        timeText: timeText,
        speed: speed,
        accuracy: accuracy,
        progress: progress,
        inputRef: inputRef,
        rowsBox: rowsBox,
        mirrorRef: mirrorRef,
        inputSlice: inputSlice,
        groupRow: groupRow,
        lockedGroup: lockedGroup,
        slotStyle: slotStyle,
        overlayChar: overlayChar,
        profile: profile,
        mirrorChunks: mirrorChunks,
        mirrorCharClass: mirrorCharClass,
        setRowRef: setRowRef,
        focusInput: focusInput,
        onCompStart: onCompStart,
        onCompUpdate: onCompUpdate,
        onCompEnd: onCompEnd,
        onInput: onInput,
        onKeydown: onKeydown,
        restart: restart,
        nextArticle: nextArticle,
        prefs: prefs,
        setPref: setPref,
        catName: catName,
        changeCategory: changeCategory,
        isTimed: isTimed,
        remaining: remaining,
        remainingText: remainingText,
        toast: toast
      };
    }
  };
})();
