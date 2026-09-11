/* ==========================================================================
 * 书库注册表（#33 数据外部化）
 * window.TP_CATALOG：五分类注册表 [{ id, name, desc, file, count, profile }]
 *   id    分类唯一标识（short/long/code/english/poetry）
 *   name  首页卡片与历史标签展示名
 *   desc  首页卡片描述
 *   file  分类数据文件名（位于本目录，由 data-loader.js 按需注入）
 *   count 该分类篇数（与分类文件 articles 数组长度一致，首页卡片展示）
 *   profile 渲染档案（#35）：{ lineBreak, slot, font } 三旋钮
 *     lineBreak  width=镜像测宽折行 / verse=诗行硬断行+行内测宽折行
 *     slot       fixed=--ch-w 定宽槽双行 / measured=mirror 逐字测宽槽双行 / single=单行覆盖式
 *     font       step=19/17 阶梯 / same17=原文输入同 17 / en19=单行 19（窄屏 17）
 * window.TP_CATS：分类内容容器；各 cat-*.js 加载后挂 TP_CATS[id] = { id, name, articles }
 *   未加载的分类 TP_CATS[id] === undefined（按需加载语义，验收断言依据）
 * 数字符号混排分类经产品裁决作废，不收录。
 * ========================================================================== */
window.TP_CATS = window.TP_CATS || {};
window.TP_CATALOG = [
  {
    id: "short",
    name: "短文",
    desc: "日常题材短篇，150–300 字，适合热身与匀速节奏练习",
    file: "cat-short.js",
    count: 20,
    profile: { lineBreak: "width", slot: "fixed", font: "step" }
  },
  {
    id: "long",
    name: "长文",
    desc: "1000–1500 字叙事长文，耐力、专注与长行切分训练",
    file: "cat-long.js",
    count: 10,
    profile: { lineBreak: "width", slot: "fixed", font: "step" }
  },
  {
    id: "code",
    name: "程序预存字",
    desc: "Java / Python / JavaScript / C++ 关键字与高频词汇列表，空格分隔，含大小写与下划线",
    file: "cat-code.js",
    count: 32,
    profile: { lineBreak: "width", slot: "measured", font: "same17" }
  },
  {
    id: "english",
    name: "英文选段",
    desc: "80–150 词英文段落，空格节奏与单词拼写训练",
    file: "cat-english.js",
    count: 10,
    profile: { lineBreak: "width", slot: "single", font: "en19" }
  },
  {
    id: "poetry",
    name: "古诗文名句",
    desc: "经典公共版权诗文名篇选段，40–120 字，按句断行（verse）、行内随宽折行",
    file: "cat-poetry.js",
    count: 20,
    profile: { lineBreak: "verse", slot: "single", font: "en19" }
  }
];
