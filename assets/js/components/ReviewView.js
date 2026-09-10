/* ==========================================================================
 * ReviewView 错字针对性复练模式（V2.0 F2）
 * 命名空间：window.TP_ReviewView
 * 依赖：window.TP_Store（getWrongBook/addReviewPass/createRecord/addRecord）
 * 进入：StatsView 错字本「复练这些字」→ app.js startReview(chars) → 本视图
 * 隔离：复练记录 mode='review'（review: 前缀隔离），不计入常规汇总/趋势/错字本
 * 衰减：复练通过的字调用 addReviewPass 抵减错字本计数
 * 说明：本组件为独立轻量钻练输入链（compositionend/input 提交），
 *       不复用也不改动 TypingPractice 的 V1 引擎/IME 锚点/行切分逻辑。
 * ========================================================================== */
(function () {
  var Vue = window.Vue;
  var ref = Vue.ref, computed = Vue.computed, inject = Vue.inject,
      onMounted = Vue.onMounted, onUnmounted = Vue.onUnmounted, nextTick = Vue.nextTick;

  var ROW_SIZE = 24;   // 复练行固定切片（无需自适应测量）

  window.TP_ReviewView = {
    name: 'ReviewView',
    template: `
<div class="tp review-view">

  <div class="tp-meta">
    <span class="tp-meta-text">错字复练 · {{ distinctChars.length }} 字 · {{ target.length }} 次输入</span>
    <div class="tp-meta-actions">
      <button class="btn ghost" type="button" @click="finish(false)">结束复练</button>
      <button class="btn ghost" type="button" @click="backStats">返回统计</button>
    </div>
  </div>

  <div v-if="!target.length" class="stats-empty">
    <div class="stats-empty-icon" aria-hidden="true">✅</div>
    <p class="stats-empty-title">暂无待复练错字</p>
    <p class="stats-empty-desc">错字本为空，先去完成一篇练习吧。</p>
    <button class="btn primary" type="button" @click="backStats">返回统计</button>
  </div>

  <template v-else>
    <div class="rows" @click="focusInput">
      <div
        v-for="(row, ri) in rows"
        :key="ri"
        class="row"
        :class="{ active: ri === activeRowIndex && !done }"
      >
        <div class="row-source line-text"><span
            v-for="(ch, ci) in row"
            :key="ci"
            class="char ch-slot"
            :class="stateOf(rowStart(ri) + ci)"
          >{{ ch }}</span></div>
        <div class="row-input">
          <span v-if="ri === activeRowIndex && !done" class="caret" aria-hidden="true"></span>
          <template v-if="inputSlice(rowStart(ri), row.length).length">
            <span
              v-for="(item, ci) in inputSlice(rowStart(ri), row.length)"
              :key="ci"
              class="in-char ch-slot"
              :class="{ bad: !item.ok }"
            >{{ item.ch }}</span>
          </template>
          <div v-else class="row-input-empty" :class="{ dashed: ri === activeRowIndex && !done }"></div>
        </div>
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
      aria-label="错字复练输入框"
      @input="onInput"
      @keydown="onKeydown"
      @compositionstart="onCompStart"
      @compositionupdate="onCompUpdate"
      @compositionend="onCompEnd"
    />

    <div class="tp-stats">
      <div class="pill"><span class="pill-label">进度</span><span class="pill-value">{{ pos }} / {{ target.length }}</span></div>
      <div class="pill"><span class="pill-label">用时</span><span class="pill-value">{{ timeText }}</span></div>
      <div class="pill"><span class="pill-label">准确率</span><span class="pill-value">{{ accuracy }}%</span></div>
    </div>

    <div v-if="done" class="review-done">
      <p>本轮复练完成：通过 {{ passedChars.length }} 字，仍错 {{ stillWrong.length }} 字。</p>
      <button class="btn primary" type="button" @click="backStats">查看错字本</button>
    </div>
  </template>
</div>
`,
    setup: function () {
      var switchTab   = inject('switchTab', function () {});
      var reviewChars = inject('reviewChars', ref([]));

      var inputRef  = ref(null);
      var pos       = ref(0);
      var userInput = ref([]);
      var done      = ref(false);
      var isComposing = ref(false);
      var startTime = ref(null);
      var elapsed   = ref(0);
      var timerId   = null;

      /* 钻练目标序列：每个错字重复 min(count,3) 次 */
      var distinctChars = computed(function () {
        var src = reviewChars.value || [];
        return src.map(function (it) { return it.ch; });
      });
      var target = computed(function () {
        var src = reviewChars.value || [];
        var out = [];
        for (var i = 0; i < src.length; i++) {
          var rep = Math.min(src[i].count || 1, 3);
          for (var r = 0; r < rep; r++) out.push(src[i].ch);
        }
        return out;
      });
      var rows = computed(function () {
        var t = target.value, out = [];
        for (var i = 0; i < t.length; i += ROW_SIZE) out.push(t.slice(i, i + ROW_SIZE));
        if (!out.length) out = [];
        return out;
      });
      function rowStart(ri) { return ri * ROW_SIZE; }
      var activeRowIndex = computed(function () {
        return Math.min(rows.value.length - 1, Math.floor(pos.value / ROW_SIZE));
      });

      /* ---------- 计时 ---------- */
      function stopTimer(finalize) {
        if (timerId !== null) { clearInterval(timerId); timerId = null; }
        if (finalize && startTime.value !== null) elapsed.value = Date.now() - startTime.value;
      }
      function startTimer() {
        if (startTime.value !== null) return;
        startTime.value = Date.now();
        elapsed.value = 0;
        timerId = setInterval(function () { elapsed.value = Date.now() - startTime.value; }, 200);
      }
      var timeText = computed(function () {
        var s = Math.floor(elapsed.value / 1000);
        var m = Math.floor(s / 60);
        return (m < 10 ? '0' + m : m) + ':' + ((s % 60) < 10 ? '0' + (s % 60) : (s % 60));
      });

      /* ---------- 判定 ---------- */
      function stateOf(i) {
        if (i < pos.value) return userInput.value[i] === target.value[i] ? 'ok' : 'bad';
        return '';
      }
      function inputSlice(start, len) {
        var out = [];
        for (var i = start; i < start + len && i < pos.value; i++) {
          out.push({ ch: userInput.value[i], ok: userInput.value[i] === target.value[i] });
        }
        return out;
      }
      var correctCount = computed(function () {
        var n = 0;
        for (var i = 0; i < pos.value; i++) if (userInput.value[i] === target.value[i]) n++;
        return n;
      });
      var accuracy = computed(function () {
        if (pos.value <= 0) return 100;
        return Math.round((correctCount.value / pos.value) * 100);
      });

      /* ---------- 输入 ---------- */
      function pushChar(ch) {
        if (done.value) return;
        if (pos.value >= target.value.length) return;
        startTimer();
        userInput.value.push(ch);
        pos.value = pos.value + 1;
        if (pos.value >= target.value.length) { done.value = true; stopTimer(true); commitReview(); }
      }
      function commitString(str) {
        if (!str) return;
        var it = String(str)[Symbol.iterator](), step;
        while (!(step = it.next()).done) pushChar(step.value);
      }
      function onCompStart() { isComposing.value = true; }
      function onCompUpdate() { isComposing.value = true; }
      function onCompEnd(e) {
        isComposing.value = false;
        commitString(e.data);
        if (inputRef.value) inputRef.value.value = '';
      }
      function onInput(e) {
        if (isComposing.value || (e && e.isComposing)) return;
        var el = inputRef.value;
        if (!el) return;
        var v = el.value;
        if (v) { commitString(v); el.value = ''; }
      }
      function onKeydown(e) {
        if (isComposing.value || e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Backspace') {
          e.preventDefault();
          if (done.value || pos.value <= 0) return;
          pos.value = pos.value - 1;
          userInput.value = userInput.value.slice(0, pos.value);
        }
      }
      function focusInput() { if (inputRef.value) inputRef.value.focus({ preventScroll: true }); }

      /* ---------- 复练结算：衰减 + review 记录 ---------- */
      var passedChars = ref([]);
      var stillWrong  = ref([]);
      function commitReview() {
        var passSet = {}, wrongSet = {}, wrongList = [];
        for (var i = 0; i < pos.value; i++) {
          var t = target.value[i], u = userInput.value[i];
          if (u === t) passSet[t] = true;
          else {
            wrongSet[t] = true;
            wrongList.push({ ch: u, expected: t, pos: i, context: target.value.slice(Math.max(0, i - 3), i + 4).join('') });
          }
        }
        /* 通过的字若本轮仍有错例则不视为通过 */
        var passArr = [];
        for (var k in passSet) { if (Object.prototype.hasOwnProperty.call(passSet, k) && !wrongSet[k]) passArr.push(k); }
        var wrongArr = [];
        for (var w in wrongSet) { if (Object.prototype.hasOwnProperty.call(wrongSet, w)) wrongArr.push(w); }
        passedChars.value = passArr;
        stillWrong.value  = wrongArr;
        if (window.TP_Store) {
          if (passArr.length) window.TP_Store.addReviewPass(passArr, 1);   // 通过计数衰减
          var mins = elapsed.value / 60000;
          window.TP_Store.addRecord(window.TP_Store.createRecord({
            articleId: 0,
            chars: pos.value,
            durationMs: elapsed.value,
            cpm: mins > 0 ? Math.round(correctCount.value / mins) : 0,
            accuracy: accuracy.value,
            wrongChars: wrongList,
            mode: 'review',          // review: 前缀隔离
            abandoned: false
          }));
        }
      }
      function finish() {
        if (!done.value) { stopTimer(true); if (pos.value > 0) commitReview(); done.value = true; }
        backStats();
      }
      function backStats() { switchTab('stats'); }

      onMounted(function () { nextTick(focusInput); });
      onUnmounted(function () { stopTimer(false); });

      return {
        inputRef: inputRef, pos: pos, done: done, target: target, rows: rows,
        rowStart: rowStart, activeRowIndex: activeRowIndex, distinctChars: distinctChars,
        stateOf: stateOf, inputSlice: inputSlice, timeText: timeText, accuracy: accuracy,
        onInput: onInput, onKeydown: onKeydown, onCompStart: onCompStart,
        onCompUpdate: onCompUpdate, onCompEnd: onCompEnd, focusInput: focusInput,
        finish: finish, backStats: backStats, passedChars: passedChars, stillWrong: stillWrong
      };
    }
  };
})();
