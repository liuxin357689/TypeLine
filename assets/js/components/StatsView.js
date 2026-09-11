/* ==========================================================================
 * StatsView 练习历史与统计面板（V2.0 F1）
 * 命名空间：window.TP_StatsView
 * 依赖：window.TP_Store（assets/js/store.js，须先于此文件加载）
 * 内容：汇总卡 + 近 20 次趋势折线（原生 SVG，禁外部库）+ 历史列表
 * ========================================================================== */
(function () {
  var Vue = window.Vue;
  var ref      = Vue.ref;
  var computed = Vue.computed;
  var inject   = Vue.inject;
  var onMounted   = Vue.onMounted;
  var onUnmounted = Vue.onUnmounted;

  /* SVG 坐标系常量（viewBox 单位，非像素）；图表绘制区 CL→CR, CT→CB */
  var CW = 640, CH = 180;
  var CL = 44,  CR = 596, CT = 14, CB = 156;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function formatTs(ts) {
    var d = new Date(ts);
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
           ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function formatDuration(ms) {
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (h > 0) return h + '小时' + (m > 0 ? m + '分' : '');
    if (m > 0) return m + '分' + (s % 60 > 0 ? (s % 60) + '秒' : '');
    return s + '秒';
  }

  window.TP_StatsView = {
    name: 'StatsView',
    template: `
<div class="stats-view">

  <!-- 空态引导 -->
  <div v-if="!records.length" class="stats-empty">
    <div class="stats-empty-icon" aria-hidden="true">📊</div>
    <p class="stats-empty-title">暂无练习记录</p>
    <p class="stats-empty-desc">完成一篇打字练习（或中途输入满 20 字后切换视图 / 换文），记录将自动保存在这里。</p>
    <button class="btn primary" type="button" @click="goTyping">开始练习</button>
  </div>

  <template v-else>

    <!-- 汇总卡 -->
    <div class="stats-summary">
      <div class="stat-card">
        <span class="stat-label">累计字数</span>
        <span class="stat-value">{{ summary.totalChars }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">累计时长</span>
        <span class="stat-value stat-value-sm">{{ summary.totalTime }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">平均速度</span>
        <span class="stat-value accent">{{ summary.avgCpm }}<small>字/分</small></span>
      </div>
      <div class="stat-card">
        <span class="stat-label">最佳纪录</span>
        <span class="stat-value correct">{{ summary.bestCpm }}<small>字/分</small></span>
      </div>
    </div>

    <!-- 趋势折线（≥2 条时展示，原生 SVG，速度蓝实线 + 准确率绿虚线） -->
    <div v-if="trendData.length >= 2" class="stats-chart">
      <h3 class="stats-section-title">近 {{ trendData.length }} 次趋势</h3>
      <div class="chart-legend">
        <span class="legend-item">
          <span class="legend-line speed-line"></span>速度（字/分）
        </span>
        <span class="legend-item">
          <span class="legend-line accuracy-line"></span>准确率（%）
        </span>
      </div>
      <svg
        class="trend-svg"
        :viewBox="'0 0 ' + cw + ' ' + ch"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="练习趋势折线图"
      >
        <!-- 水平网格线（5 条） -->
        <line
          v-for="(gy, gi) in gridYs" :key="'g' + gi"
          :x1="cl" :x2="cr" :y1="gy" :y2="gy"
          class="svg-grid"
        />
        <!-- 右轴标注（准确率 100%→0%） -->
        <text
          v-for="(lb, li) in yLabels" :key="'y' + li"
          :x="cr + 5" :y="lb.y + 4"
          class="svg-axis-label"
        >{{ lb.text }}</text>
        <!-- 左轴标注（速度） -->
        <text
          v-for="(lb, li) in speedLabels" :key="'sl' + li"
          :x="cl - 4" :y="lb.y + 4"
          class="svg-axis-label svg-axis-label-left"
        >{{ lb.text }}</text>
        <!-- 速度折线（蓝实线） -->
        <polyline
          class="svg-speed-line"
          :points="speedPts"
          fill="none"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <!-- 准确率折线（绿虚线） -->
        <polyline
          class="svg-accuracy-line"
          :points="accPts"
          fill="none"
          stroke-width="2"
          stroke-dasharray="5,3"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <!-- 末点圆点 -->
        <circle v-if="lastSpeed" :cx="lastSpeed[0]" :cy="lastSpeed[1]" r="3.5" class="svg-speed-dot" />
        <circle v-if="lastAcc"   :cx="lastAcc[0]"   :cy="lastAcc[1]"   r="3.5" class="svg-accuracy-dot" />
      </svg>
      <p class="chart-hint">左轴：速度（字/分）· 右轴：准确率（%）· 近 {{ trendData.length }} 次练习趋势</p>
    </div>

    <!-- 历史列表 -->
    <div class="stats-list">
      <div class="stats-list-header">
        <h3 class="stats-section-title">练习历史（共 {{ records.length }} 条）</h3>
        <div class="stats-list-actions">
          <!-- #33：返回书库分类首页（用户追加需求，样式复用 .btn ghost 体系） -->
          <button type="button" class="btn ghost" @click="goHomeCat">返回</button>
          <!-- #27 错字本简约化：平铺区块改为按钮（计数角标）+ 模态弹窗 -->
          <button v-if="wrongBook.length" type="button" class="btn ghost wb-open" @click="openWb">
            错字本<span class="wb-badge">{{ wrongBook.length }}</span>
          </button>
          <button
            type="button"
            class="btn ghost btn-danger"
            :class="{ 'btn-danger-confirm': confirmClear }"
            @click="toggleClear"
          >{{ confirmClear ? '再次点击确认清空' : '清空全部' }}</button>
        </div>
      </div>
      <div class="list-wrap">
        <!-- 表头 -->
        <div class="list-row list-head">
          <span class="lc-time">时间</span>
          <span class="lc-art">文章</span>
          <span class="lc-num">字数</span>
          <span class="lc-num">字/分</span>
          <span class="lc-num">准确率</span>
          <span class="lc-tag">状态</span>
          <span class="lc-del"></span>
        </div>
        <!-- 数据行（最新在前） -->
        <div class="list-row" v-for="rec in displayRecords" :key="rec.id">
          <span class="lc-time">{{ fmtTs(rec.ts) }}</span>
          <span class="lc-art">{{ artLabel(rec) }}</span>
          <span class="lc-num">{{ rec.chars }}</span>
          <span class="lc-num">{{ rec.cpm }}</span>
          <span class="lc-num">{{ rec.accuracy }}%</span>
          <span class="lc-tag">
            <span v-if="rec.mode === 'review'" class="tag-review">复练</span>
            <span v-else-if="rec.mode === 'timed'" class="tag-timed">限时</span>
            <span v-else :class="rec.abandoned ? 'tag-abandoned' : 'tag-complete'">{{
              rec.abandoned ? '放弃' : '完成'
            }}</span>
          </span>
          <span class="lc-del">
            <button
              type="button"
              class="btn-icon"
              title="删除此记录"
              @click="deleteRec(rec.id)"
            >✕</button>
          </span>
        </div>
      </div>
    </div>

  </template>

  <!-- #27 错字本模态弹窗：仅「错字 + 错误次数」两列（次数降序）；Esc / 遮罩点击可关；
       置于 template v-else 外部，确保删空记录后弹窗仍可渲染空态 -->
  <div v-if="wbOpen" class="modal-mask" @click.self="closeWb">
    <div class="modal-card wb-modal" role="dialog" aria-modal="true" aria-label="错字本">
      <h2 class="modal-title wb-modal-title">错字本</h2>
      <div v-if="!wrongBook.length" class="wb-empty">还没有错字，继续练习吧</div>
      <div v-else class="wb-list">
        <div class="wb-item wb-item-head">
          <span class="wb-ch">错字</span>
          <span class="wb-cnt">错误次数</span>
        </div>
        <div class="wb-item" v-for="it in wrongBook" :key="it.ch">
          <span class="wb-ch">{{ it.ch }}</span>
          <span class="wb-cnt">{{ it.count }}</span>
        </div>
      </div>
      <div class="modal-actions">
        <button v-if="wrongBook.length" class="btn primary" type="button" @click="goReview">去复练</button>
        <button class="btn outline" type="button" @click="closeWb">关闭</button>
      </div>
    </div>
  </div>

</div>
`,
    setup: function () {
      /* inject 由 app.js provide('switchTab') 提供；降级为空函数 */
      var switchTab = inject('switchTab', function () {});
      var startReview = inject('startReview', function () {});   /* F2：进复练模式 */
      var goHome = inject('goHome', null);                       /* #33：返回书库首页 */

      /* #26：setup 即读一次 + onMounted 再读，双保险消除挂载时序空窗导致空态 */
      var records      = ref((window.TP_Store && window.TP_Store.getAll) ? window.TP_Store.getAll() : []);
      var confirmClear = ref(false);
      var clearTimer   = null;

      onMounted(function () {
        records.value = (window.TP_Store && window.TP_Store.getAll)
          ? window.TP_Store.getAll()
          : [];
        window.addEventListener('keydown', onWbKey);          /* #27 Esc 关闭错字本弹窗 */
      });
      onUnmounted(function () {
        if (clearTimer !== null) { clearTimeout(clearTimer); clearTimer = null; }
        window.removeEventListener('keydown', onWbKey);
      });

      /* ---------- 汇总卡 ---------- */
      var summary = computed(function () {
        var recs = records.value.filter(function (r) { return r.mode !== 'review'; });  /* F2：review 隔离 */
        if (!recs.length) return { totalChars: 0, totalTime: '0秒', avgCpm: 0, bestCpm: 0 };
        var tc = 0, tm = 0, bs = 0, cpmSum = 0;
        for (var i = 0; i < recs.length; i++) {
          tc     += (recs[i].chars      || 0);
          tm     += (recs[i].durationMs || 0);
          var c   = (recs[i].cpm        || 0);
          cpmSum += c;
          if (c > bs) bs = c;
        }
        return {
          totalChars: tc,
          totalTime:  formatDuration(tm),
          avgCpm:     Math.round(cpmSum / recs.length),
          bestCpm:    bs
        };
      });

      /* ---------- 趋势数据（取最近 20 条） ---------- */
      var trendData = computed(function () {
        var recs = records.value.filter(function (r) { return r.mode !== 'review'; });  /* F2：review 隔离 */
        return recs.length > 20 ? recs.slice(recs.length - 20) : recs.slice();
      });

      /* ---------- 错字本（F2/#27）：依赖 records 以便删/清后重算 ---------- */
      var wrongBook = computed(function () {
        void records.value;
        return (window.TP_Store && window.TP_Store.getWrongBook) ? window.TP_Store.getWrongBook() : [];
      });
      /* #27 错字本模态开关；展示层仅取 ch/count 两列（getWrongBook 不动） */
      var wbOpen = ref(false);
      function openWb()  { wbOpen.value = true; }
      function closeWb() { wbOpen.value = false; }
      function onWbKey(e) { if (e.key === 'Escape') wbOpen.value = false; }
      function goReview() { closeWb(); startReview(wrongBook.value); }

      /* #33：返回按钮回分类首页（不清当前分类，首页可「继续上次」） */
      function goHomeCat() { if (typeof goHome === 'function') goHome(); }
      /* #33：历史标签——复练→「复练」；有 cat→分类名；旧记录无 cat→「历史」 */
      function artLabel(rec) {
        if (rec.mode === 'review') return '复练';
        if (rec.cat && window.TP_DataLoader) {
          var e = window.TP_DataLoader.getEntry(rec.cat);
          if (e) return e.name;
        }
        return '历史';
      }

      /* SVG 尺寸常量（直接暴露给模板） */
      var cw = CW, ch = CH, cl = CL, cr = CR;

      /* 网格线 Y 坐标（5 条等距） */
      var gridYs = computed(function () {
        var ys = [];
        for (var i = 0; i <= 4; i++) ys.push(CT + (CB - CT) * i / 4);
        return ys;
      });

      /* 右轴标注（准确率 100→0%） */
      var yLabels = computed(function () {
        var out = [];
        for (var i = 0; i <= 4; i++) {
          out.push({ y: CT + (CB - CT) * i / 4, text: (100 - i * 25) + '%' });
        }
        return out;
      });

      /* 速度轴最大值（动态，+15% 余量） */
      var maxCpm = computed(function () {
        var td = trendData.value;
        var mx = 1;
        for (var i = 0; i < td.length; i++) {
          if ((td[i].cpm || 0) > mx) mx = td[i].cpm;
        }
        return Math.ceil(mx * 1.15) || 1;
      });

      /* 左轴标注（速度，5 等份） */
      var speedLabels = computed(function () {
        var mx = maxCpm.value;
        var out = [];
        for (var i = 0; i <= 4; i++) {
          out.push({
            y:    CT + (CB - CT) * i / 4,
            text: Math.round(mx * (1 - i / 4))
          });
        }
        return out;
      });

      /* X 坐标：等间距分布，单点时居中 */
      function toX(i, n) { return CL + (CR - CL) * (n > 1 ? i / (n - 1) : 0.5); }
      function cpmToY(v)  { return CB - (v / maxCpm.value) * (CB - CT); }
      function accToY(v)  { return CB - (v / 100)          * (CB - CT); }

      var speedPts = computed(function () {
        var td = trendData.value;
        if (td.length < 2) return '';
        var pts = [];
        for (var i = 0; i < td.length; i++) {
          pts.push(toX(i, td.length).toFixed(1) + ',' + cpmToY(td[i].cpm || 0).toFixed(1));
        }
        return pts.join(' ');
      });

      var accPts = computed(function () {
        var td = trendData.value;
        if (td.length < 2) return '';
        var pts = [];
        for (var i = 0; i < td.length; i++) {
          pts.push(toX(i, td.length).toFixed(1) + ',' + accToY(td[i].accuracy || 0).toFixed(1));
        }
        return pts.join(' ');
      });

      var lastSpeed = computed(function () {
        var td = trendData.value;
        if (td.length < 2) return null;
        var i = td.length - 1;
        return [toX(i, td.length), cpmToY(td[i].cpm || 0)];
      });

      var lastAcc = computed(function () {
        var td = trendData.value;
        if (td.length < 2) return null;
        var i = td.length - 1;
        return [toX(i, td.length), accToY(td[i].accuracy || 0)];
      });

      /* ---------- 历史列表（最新在前） ---------- */
      var displayRecords = computed(function () {
        return records.value.slice().reverse();
      });

      /* ---------- 操作 ---------- */
      function refreshRecords() {
        records.value = (window.TP_Store && window.TP_Store.getAll)
          ? window.TP_Store.getAll() : [];
      }

      function deleteRec(id) {
        if (window.TP_Store) window.TP_Store.removeRecord(id);
        refreshRecords();
      }

      /* 清空需二次确认：第一次点击显示确认文案（3 秒内有效），第二次才执行 */
      function toggleClear() {
        if (!confirmClear.value) {
          confirmClear.value = true;
          clearTimer = setTimeout(function () {
            confirmClear.value = false;
            clearTimer = null;
          }, 3000);
        } else {
          if (clearTimer !== null) { clearTimeout(clearTimer); clearTimer = null; }
          if (window.TP_Store) window.TP_Store.clearAll();
          records.value = [];
          confirmClear.value = false;
        }
      }

      function goTyping() { switchTab('typing'); }

      function fmtTs(ts) { return formatTs(ts); }

      return {
        records:        records,
        summary:        summary,
        trendData:      trendData,
        displayRecords: displayRecords,
        confirmClear:   confirmClear,
        cw: cw, ch: ch, cl: cl, cr: cr,
        gridYs:       gridYs,
        yLabels:      yLabels,
        speedLabels:  speedLabels,
        speedPts:     speedPts,
        accPts:       accPts,
        lastSpeed:    lastSpeed,
        lastAcc:      lastAcc,
        deleteRec:    deleteRec,
        toggleClear:  toggleClear,
        goTyping:     goTyping,
        goHomeCat:    goHomeCat,
        artLabel:     artLabel,
        wrongBook:    wrongBook,
        goReview:     goReview,
        wbOpen:       wbOpen,
        openWb:       openWb,
        closeWb:      closeWb,
        fmtTs:        fmtTs
      };
    }
  };
})();
