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
  var ref = Vue.ref, computed = Vue.computed, watch = Vue.watch,
      nextTick = Vue.nextTick, onMounted = Vue.onMounted, onUnmounted = Vue.onUnmounted;

  function pickArticle(excludeId) {
    // 惰性读取数据层（评审 P2-5）：setup/调用时才取 window.TP_ARTICLES，避免加载顺序变动静默变空
    var ARTICLES = window.TP_ARTICLES || [];
    if (!ARTICLES.length) return { id: 0, title: "", text: "" };
    var pool = ARTICLES.filter(function (a) { return a.id !== excludeId; });
    if (!pool.length) pool = ARTICLES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  window.TP_TypingPractice = {
    name: "TypingPractice",
    template: `
<div class="tp">
  <div ref="mirrorRef" class="row-mirror line-text" aria-hidden="true"><span
      v-for="(ch, ci) in textChars"
      :key="ci"
      class="ch-slot"
    >{{ ch }}</span></div>
  <!-- F3 模式工具条：分段控件（模式 全文/限时 + 限时时长档），持久化 typeline:prefs:v1；
       标点开关已裁决取消，原文标点始终原样参与比对，故此处无标点控件 -->
  <div class="tp-toolbar">
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

  <div class="tp-meta">
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
      :class="{ active: ri === activeRowIndex }"
    >
      <div class="row-source line-text"><span
          v-for="(ch, ci) in row.chars"
          :key="ci"
          class="char ch-slot"
          :class="charStates[row.start + ci]"
        >{{ ch }}</span></div>
      <div class="row-input">
        <span v-if="ri === activeRowIndex && !done" class="caret" aria-hidden="true"></span>
        <span v-if="ri === activeRowIndex && pos === 0 && !done && !composingText" class="row-hint">点击此处开始输入，支持中文输入法</span>
        <template v-else-if="inputSlice(row).length">
          <span
            v-for="(item, ci) in inputSlice(row)"
            :key="ci"
            class="in-char ch-slot"
            :class="{ bad: !item.ok }"
          >{{ item.ch }}</span>
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
      /* ---------- 响应式状态（4.5） ---------- */
      var article = ref(pickArticle(null));
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

      /* ---------- 计时 ---------- */
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
          elapsed.value = Date.now() - startTime.value;
          /* F3 限时：倒计时归零立即结算 */
          if (isTimed.value && !done.value && elapsed.value >= limitMs.value) finishTimed();
        }, 200);
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
        }
      }

      /* ---------- 换篇 / 重开 ---------- */
      function resetState() {
        stopTimer(false);
        sessionSaved = false;                          // #26：新一轮练习复位存档互斥
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
        article.value = pickArticle(article.value ? article.value.id : null);
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
        var inLine = rowEl.querySelector(".row-input");
        if (!inLine) return;
        var inChars = inLine.querySelectorAll(".in-char");
        var k = inChars.length;
        var inLineRect = inLine.getBoundingClientRect();
        var rowsRect = box.getBoundingClientRect();
        var compEl = inLine.querySelector(".composing");
        var x = compEl
          ? compEl.getBoundingClientRect().right                        // 组合期：拼音末端（任务 #20D）
          : (k > 0 ? inChars[k - 1].getBoundingClientRect().right : inLineRect.left);
        var inLineLeft = inLineRect.left - rowsRect.left + box.scrollLeft;  // 输入行左缘内容坐标
        var left = x - rowsRect.left + box.scrollLeft;
        var maxLeft = box.clientWidth - 240;
        if (maxLeft < 0) maxLeft = 0;
        if (left < 0) left = 0;
        if (left > maxLeft) left = maxLeft;
        var top = inLineRect.bottom - rowsRect.top + box.scrollTop;   // 紧贴输入行底边（任务 #20E：移除 +2）
        inp.style.left = left + "px";
        inp.style.top = top + "px";
        /* 光标与锚点同源：同一 left 换算到 .row-input 局部坐标 */
        var caret = inLine.querySelector(".caret");
        if (caret) caret.style.left = (left - inLineLeft) + "px";
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

      /* active row 变化 → 自动滚入可视区（6.8）+ 更新 IME 锚点 */
      watch(activeRowIndex, function (idx) {
        nextTick(function () {
          var el = rowEls[idx];
          if (el && el.scrollIntoView) {
            el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
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
      function measureLines() {
        var chars = textChars.value;
        if (!chars.length) { lineStarts.value = []; return; }   // 全文为空 rows=[]
        var mirror = mirrorRef.value;
        if (!mirror) return;                                    // 镜像未就绪：保留上一次 rows（守卫 4）
        var mspans = mirror.children;
        if (!mspans.length || mspans.length !== chars.length) return;  // 镜像未渲染/陈旧：保留上一次 rows
        var srcEl = null;
        for (var i = 0; i < rowEls.length; i++) {
          if (rowEls[i]) { srcEl = rowEls[i].querySelector(".row-source"); if (srcEl) break; }
        }
        if (!srcEl) return;                                     // 尚无可参照行：保留上一次 rows
        var cs = window.getComputedStyle(srcEl);
        var w = srcEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (!(w > 0)) return;                                   // 宽度<=0：保留上一次 rows（守卫 4）
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
        isTimed: isTimed,
        remaining: remaining,
        remainingText: remainingText,
        toast: toast
      };
    }
  };
})();
