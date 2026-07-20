/* MatchStruct — competition-scoped review boards (research demo only) */
(function () {
  var COLORS = ['#0c6b61', '#1a8f7a', '#b07a22', '#c4923a', '#3a6f8c', '#4a7fa0', '#8a5f6a', '#9a4540'];
  var chartRates = null;
  var chartSide = null;
  var current = 'round';

  var LEAGUE_NOTES = {
    '韩职': {
      good: ['让球范围 5/6，容错判断较好', '江原主胜、首尔客胜方向清晰', '安养防平与过热标签有效'],
      bad: ['主客方向主选仅 2/6', '部分场次总进球上冲到 4 球', '名气队客场低比分冷门偏多']
    },
    '挪超': {
      good: ['普通胜平负主选 4/6', '莫尔德过热反例兑现', '维京主胜与 -2 防守拆分正确'],
      bad: ['让球净胜幅度不稳定', '开放局尾部进球（如汉坎 1-4）', '过热热门仍需保留平局']
    },
    '芬超': {
      good: ['总进球区间 3/4', '赫尔辛基 / 库奥皮奥方向可用', '让负在轻优势局更清晰'],
      bad: ['AC 奥卢主选方向失误', '国际图尔库密防 0-0 被低估', '主胜热门与伤停冲突需加强']
    },
    '瑞超': {
      good: ['普通胜平负 4/4 全中', '哈马比主胜为本轮强观察档', '天狼星 / 赫根方向正确'],
      bad: ['让球穿盘判断偏弱（1/4 主选）', '过热客胜未下调完整性', '-2 与普通主胜置信度需拆分']
    },
    '世界杯': {
      good: ['决赛 90 分钟防平命中', '让球两端均覆盖', '七比分池覆盖决赛 0-0'],
      bad: ['季军赛法国方向未中', '大比分尾部（4-6）未前置', '轮换/战意方差建模不足']
    }
  };

  function pct(n, d) {
    if (!d) return 0;
    return Math.round((1000 * n) / d) / 10;
  }
  function hitbar(k) {
    return '<div class="kpi"><b>' + k.hit + '</b><span>' + k.label + ' · ' + k.pct + '%</span>' +
      '<div class="bar"><i style="width:' + k.pct + '%;background:linear-gradient(90deg,' + k.color + ',#7dffd6)"></i></div></div>';
  }
  function countRes(matches, key, mode) {
    var n = 0;
    matches.forEach(function (m) {
      var v = m.res[key];
      if (mode === 'hit' && v === 'hit') n++;
      if (mode === 'cover' && (v === 'hit' || v === 'partial')) n++;
    });
    return n;
  }
  function leagueKpis(matches) {
    var n = matches.length;
    var items = [
      { label: '胜平负第一选择', hit: countRes(matches, 'r', 'hit') + '/' + n, pct: pct(countRes(matches, 'r', 'hit'), n), color: COLORS[0] },
      { label: '胜平负含防守', hit: countRes(matches, 'r', 'cover') + '/' + n, pct: pct(countRes(matches, 'r', 'cover'), n), color: COLORS[1] },
      { label: '让球第一选择', hit: countRes(matches, 'h', 'hit') + '/' + n, pct: pct(countRes(matches, 'h', 'hit'), n), color: COLORS[2] },
      { label: '让球含第二选', hit: countRes(matches, 'h', 'cover') + '/' + n, pct: pct(countRes(matches, 'h', 'cover'), n), color: COLORS[3] },
      { label: '总进球区间', hit: countRes(matches, 'g', 'cover') + '/' + n, pct: pct(countRes(matches, 'g', 'cover'), n), color: COLORS[4] },
      { label: '七比分池覆盖', hit: countRes(matches, 's', 'cover') + '/' + n, pct: pct(countRes(matches, 's', 'cover'), n), color: COLORS[5] }
    ];
    return items;
  }

  function initials(n) {
    return String(n || '').replace(/FC|SK|市民|现代|制铁|联/g, '').slice(0, 2);
  }
  function resClass(x) { return x === 'hit' ? 'hit' : x === 'partial' ? 'partial' : 'miss'; }
  function resMark(x) { return x === 'hit' ? '✓' : x === 'partial' ? '◐' : '✕'; }
  function resText(x) { return x === 'hit' ? '主选命中' : x === 'partial' ? '防守命中' : '未覆盖'; }
  function cleanLabel(s) {
    var t = String(s || '').replace(/^[✅◐❌✓✕]\s*/, '').trim();
    return t || (s && String(s).includes('◐') ? '第二选择' : s && /^[✅✓]/.test(String(s)) ? '命中' : '未覆盖');
  }
  function verdictCell(state, title, label) {
    var st = resClass(state);
    return '<div class="verdict ' + st + '"><span class="v-ico">' + resMark(state) + '</span><div><small>' + title + '</small><b>' + cleanLabel(label) + '</b></div></div>';
  }
  function probBars(m, key) {
    var v = (key && m[key]) || m.model;
    return '<div class="prob">' +
      '<div class="prob-row"><span>主胜</span><div class="pbar"><i class="h" style="width:' + v[0] + '%"></i></div><b>' + v[0] + '%</b></div>' +
      '<div class="prob-row"><span>平局</span><div class="pbar"><i class="d" style="width:' + v[1] + '%"></i></div><b>' + v[1] + '%</b></div>' +
      '<div class="prob-row"><span>客胜</span><div class="pbar"><i class="a" style="width:' + v[2] + '%"></i></div><b>' + v[2] + '%</b></div>' +
      '</div>';
  }
  function reviewCard(m) {
    var rc = resClass(m.res.r);
    return '<article class="match ' + rc + '" data-state="' + m.res.r + '" data-day="' + m.day + '" data-league="' + m.league + '" data-search="' + (m.day + m.id + m.home + m.away).toLowerCase() + '">' +
      '<div class="match-head">' +
      '<div class="meta"><span>' + m.day + m.id + '</span><span class="dot"></span><b>' + m.league + '</b>' +
      '<span class="chip">置信 ' + m.conf + '</span>' +
      '<span class="stamp ' + rc + '"><span class="ico">' + resMark(m.res.r) + '</span>' + resText(m.res.r) + '</span></div>' +
      '<div class="teams-row"><div class="teams"><span class="crest">' + initials(m.home) + '</span>' + m.home +
      '<span class="score">' + m.score + (m.extra ? '<small>' + m.extra + '</small>' : '') + '</span>' +
      m.away + '<span class="crest">' + initials(m.away) + '</span></div></div>' +
      '<div class="section-label">赛前预测</div>' +
      '<div class="predline"><span class="chip key">' + m.pick + '</span><span class="chip key">' + m.hc + '</span><span class="chip">' + m.goals + '</span></div>' +
      '<div class="section-label">复盘结果 · 绿命中 / 黄防守 / 红未中</div>' +
      '<div class="verdicts">' +
      verdictCell(m.res.r, '胜平负', m.res.rl) +
      verdictCell(m.res.h, '让球', m.res.hl) +
      verdictCell(m.res.g, '总进球', m.res.gl) +
      verdictCell(m.res.s, '七比分', m.res.sl) +
      '</div><span class="toggle"></span></div>' +
      '<div class="detail"><div class="grid2">' +
      '<div class="box"><h4>模型胜平负</h4>' + probBars(m) + '<p style="margin:8px 0 0;font-size:12px;color:#667">' + m.summary + '</p></div>' +
      '<div class="box"><h4>七比分池</h4><div class="scores">' + m.scores.map(function (s, i) {
        return '<span class="sc ' + (i < 3 ? 'top' : '') + '">' + s + '</span>';
      }).join('') + '</div></div></div>' +
      '<div class="grid2">' +
      '<div class="box"><h4>逐场分析要点</h4><ul>' + m.analysis.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' +
      '<div class="box"><h4>风险与修正</h4><ul>' + m.risks.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' +
      '</div></div></article>';
  }

  function wcDetail(d) {
    if (!d) return '';
    var keys = [['pred', '核心候选'], ['pool', '完整比分池'], ['direction', '方向'], ['goals', '总进球'], ['strictDir', '严格方向'], ['goalsCover', '球数覆盖']];
    return '<div class="wc-detail">' + keys.map(function (p) {
      if (!d[p[0]]) return '';
      return '<div><small>' + p[1] + '</small><b>' + d[p[0]] + '</b></div>';
    }).join('') + '</div>';
  }
  function wcCard(m) {
    var st = m.status || 'miss';
    var statusText = { core: '核心3命中', pool: '比分池命中', dir: '方向命中', miss: '未覆盖' };
    var statusMark = { core: '✓', pool: '◐', dir: '→', miss: '✕' };
    var tags = (m.tags || []).map(function (t) { return '<span class="chip">' + t + '</span>'; }).join('');
    var hasDetail = !!m.detail;
    var search = (m.home + m.away + m.score + (m.analysis || '') + (m.tags || []).join('')).toLowerCase();
    return '<article class="match wc-' + st + '" data-stage="' + m.stage + '" data-status="' + st + '" data-search="' + search + '">' +
      '<div class="match-head"><div class="meta">' +
      '<span>#' + m.n + '</span><span class="dot"></span><span>' + m.date + '</span><span class="dot"></span><b>' + m.stage + '</b>' +
      '<span class="stamp wc-' + st + '"><span class="ico">' + (statusMark[st] || '·') + '</span>' + (statusText[st] || m.statusLabel) + '</span></div>' +
      '<div class="teams-row"><div class="teams"><span class="crest">' + String(m.home).slice(0, 2) + '</span>' + m.home +
      '<span class="score">' + m.score + '</span>' + m.away + '<span class="crest">' + String(m.away).slice(0, 2) + '</span></div></div>' +
      '<p class="wc-note">' + (m.analysis || m.note || '') + '</p>' +
      (tags ? '<div class="predline">' + tags + '</div>' : '') +
      (hasDetail ? '<span class="toggle"></span>' : '') +
      '</div>' +
      (hasDetail ? '<div class="detail"><div class="box"><h4>淘汰赛明细</h4>' + wcDetail(m.detail) + '</div></div>' : '') +
      '</article>';
  }

  function destroyCharts() {
    if (chartRates) { chartRates.destroy(); chartRates = null; }
    if (chartSide) { chartSide.destroy(); chartSide = null; }
  }
  function paintBar(labels, data, colors) {
    if (typeof Chart === 'undefined') return;
    var cv = document.getElementById('chartRates');
    if (!cv) return;
    chartRates = new Chart(cv, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: '命中率 %', data: data, backgroundColor: colors, borderRadius: 8, maxBarThickness: 36 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: function (v) { return v + '%'; } } } } }
    });
  }
  function paintRadar(D) {
    if (typeof Chart === 'undefined') return;
    var cv = document.getElementById('chartLeague');
    if (!cv) return;
    chartSide = new Chart(cv, {
      type: 'radar',
      data: {
        labels: D.leagueStats.map(function (l) { return l.league; }),
        datasets: [
          { label: '胜平负主选', data: D.leagueStats.map(function (l) { return +(100 * l.r1 / l.n).toFixed(1); }), borderColor: '#0b7a6c', backgroundColor: 'rgba(11,122,108,.2)' },
          { label: '让球范围', data: D.leagueStats.map(function (l) { return +(100 * l.hc / l.n).toFixed(1); }), borderColor: '#b8862b', backgroundColor: 'rgba(184,134,43,.15)' },
          { label: '七比分池', data: D.leagueStats.map(function (l) { return +(100 * l.pool / l.n).toFixed(1); }), borderColor: '#3f7fa0', backgroundColor: 'rgba(63,127,160,.12)' }
        ]
      },
      options: { responsive: true, scales: { r: { beginAtZero: true, max: 100 } } }
    });
  }
  function paintStageBars(W) {
    if (typeof Chart === 'undefined') return;
    var cv = document.getElementById('chartLeague');
    if (!cv) return;
    var labels = W.stages.map(function (s) { return s.name; });
    var core = W.stages.map(function (s) {
      var c = s.stats['核心3'];
      return c ? +String(c.pct).replace('%', '') : 0;
    });
    var pool = W.stages.map(function (s) {
      var c = s.stats['完整池'];
      return c ? +String(c.pct).replace('%', '') : 0;
    });
    chartSide = new Chart(cv, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: '核心3 %', data: core, backgroundColor: '#1f9a62', borderRadius: 6 },
          { label: '完整池 %', data: pool, backgroundColor: '#2a8fad', borderRadius: 6 }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, max: 100 } } }
    });
  }

  function setConclusions(title, good, bad, sub) {
    document.getElementById('conclTitle').textContent = title;
    document.getElementById('conclSub').textContent = sub || '';
    document.getElementById('conclGood').innerHTML = good.map(function (x) { return '<li>' + x + '</li>'; }).join('');
    document.getElementById('conclBad').innerHTML = bad.map(function (x) { return '<li>' + x + '</li>'; }).join('');
  }

  function showWcExtra(W, on) {
    var el = document.getElementById('wcExtra');
    var stages = document.getElementById('wcStages');
    var notice = document.getElementById('boardNotice');
    if (!on) {
      el.hidden = true;
      stages.hidden = true;
      notice.hidden = true;
      return;
    }
    el.hidden = false;
    stages.hidden = false;
    notice.hidden = false;
    notice.textContent = (W.meta.correction || '').replace(/\s+/g, ' ').trim();
    stages.innerHTML = W.stages.map(function (s) {
      var st = s.stats || {};
      function line(key) {
        var x = st[key];
        if (!x) return '';
        return '<div>' + key + ' <b>' + x.count + '</b>' + (x.pct ? '（' + x.pct + '）' : '') + '</div>';
      }
      return '<div class="wc-stage"><div class="name">' + s.name + '</div><div class="n">' + s.n + '场</div><div class="lines">' +
        line('核心3') + line('完整池') + line('方向/比分覆盖') + line('未中') + '</div></div>';
    }).join('');
    document.getElementById('wcMisses').innerHTML = (W.misses || []).map(function (m) {
      return '<div class="hot bad"><b>' + m.date + ' · ' + m.stage + ' · ' + m.home + ' vs ' + m.away + ' ' + m.score +
        '</b><div class="res">' + (m.note || '') + '</div></div>';
    }).join('');
    document.getElementById('wcLessons').innerHTML = (W.lessons || []).map(function (L) {
      return '<div class="box"><h4>' + L.title + '</h4><p style="margin:0;font-size:13px;color:#445;line-height:1.7">' + L.body + '</p></div>';
    }).join('');
    document.getElementById('wcSummary').textContent = (W.meta.summaryNote || '').replace(/\s+/g, ' ').trim();
  }

  function roundWcMatches(D) {
    return D.matches.filter(function (m) { return m.league === '世界杯'; });
  }

  function overviewStats(D, W) {
    var types = [
      { id: '世界杯', label: '本轮世界杯' },
      { id: '韩职', label: '韩职' },
      { id: '挪超', label: '挪超' },
      { id: '芬超', label: '芬超' },
      { id: '瑞超', label: '瑞超' }
    ];
    return types.map(function (t) {
      if (t.id === '世界杯') {
        var round = roundWcMatches(D);
        var cover = countRes(round, 'r', 'cover');
        return {
          id: t.id,
          label: t.label,
          big: W.meta.poolPct + '%',
          line1: '档案完整池 ' + W.meta.pool + '/86',
          line2: '本轮收官覆盖 ' + cover + '/' + round.length + ' · 共 ' + (86 + round.length) + ' 场明细'
        };
      }
      var ms = D.matches.filter(function (m) { return m.league === t.id; });
      var cover = countRes(ms, 'r', 'cover');
      var hit = countRes(ms, 'r', 'hit');
      return {
        id: t.id,
        label: t.label,
        big: pct(cover, ms.length) + '%',
        line1: '胜平负覆盖 ' + cover + '/' + ms.length,
        line2: '主选命中 ' + hit + '/' + ms.length
      };
    });
  }

  function renderOverview(activeId) {
    var D = window.MS_DATA;
    var W = window.WC86_DATA;
    var el = document.getElementById('typeOverview');
    if (!el || !D || !W) return;
    var rows = overviewStats(D, W);
    el.innerHTML = rows.map(function (r) {
      return '<button type="button" class="type-ov' + (r.id === activeId ? ' active' : '') + '" data-comp="' + r.id + '">' +
        '<div class="lab">' + r.label + '</div><div class="big">' + r.big + '</div>' +
        '<div class="mini">' + r.line1 + '<br>' + r.line2 + '</div></button>';
    }).join('');
    el.querySelectorAll('.type-ov').forEach(function (b) {
      b.onclick = function () { selectBoard(b.dataset.comp); };
    });
  }

  function selectBoard(id) {
    current = id;
    var D = window.MS_DATA;
    var W = window.WC86_DATA;
    document.querySelectorAll('#compSwitch .comp').forEach(function (b) {
      b.classList.toggle('active', b.dataset.comp === id);
    });
    renderOverview(id);
    destroyCharts();
    var chartH3a = document.querySelector('#boardCharts .chart-box:nth-child(1) h3');
    var chartH3b = document.querySelector('#boardCharts .chart-box:nth-child(2) h3');

    // —— 本轮世界杯：86 场档案 + 本轮三四名/决赛 ——
    if (id === '世界杯') {
      var roundWc = roundWcMatches(D);
      document.getElementById('boardTitle').textContent = '本轮世界杯 · 命中审计（86 场档案 + ' + roundWc.length + ' 场收官）';
      document.getElementById('ruleLine').textContent =
        '七比分档案按开赛顺序核验（90′）；本轮收官（三四名/决赛）沿用竞彩口径复盘，已并入本看板明细。';
      var roundK = leagueKpis(roundWc);
      document.getElementById('kpis').innerHTML =
        W.meta.kpis.map(function (k) {
          return '<div class="kpi"><b>' + k.value + '</b><span>档案 · ' + k.label + '</span></div>';
        }).join('') +
        roundK.slice(0, 4).map(function (k) {
          return '<div class="kpi"><b>' + k.hit + '</b><span>本轮收官 · ' + k.label + ' · ' + k.pct + '%</span>' +
            '<div class="bar"><i style="width:' + k.pct + '%;background:linear-gradient(90deg,' + k.color + ',#7dffd6)"></i></div></div>';
        }).join('');

      document.getElementById('detailTitle').textContent = '世界杯逐场明细（本轮收官 + 86 场档案）';
      document.getElementById('boardLegend').innerHTML =
        '<span><i class="l-hit"></i>本轮：主选/防守</span>' +
        '<span><i class="l-core"></i>档案：核心3</span><span><i class="l-pool"></i>比分池</span>' +
        '<span><i class="l-dir"></i>方向</span><span><i class="l-miss"></i>未覆盖</span>';

      document.getElementById('boardList').innerHTML =
        '<div class="board-sec">一、本轮收官（竞彩口径 · 原 22 场中的世界杯）</div>' +
        roundWc.map(reviewCard).join('') +
        '<div class="board-sec">二、七比分官方档案（86 场 · 按开赛顺序）</div>' +
        W.matches.map(wcCard).join('');

      buildBoardFilters('wc-mixed');
      showWcExtra(W, true);
      var note = LEAGUE_NOTES['世界杯'];
      setConclusions('世界杯结论（档案 + 本轮收官）',
        ['完整比分池覆盖 57/86（66.3%）', '方向或比分覆盖 78/86（90.7%）', note.good[0], note.good[1]],
        ['核心3排序偏弱（41.9%）', '大比分尾部压缩', note.bad[0], note.bad[1]],
        '档案未原含三四名/决赛；现已把本轮 2 场收官复盘并入本看板。');
      if (chartH3a) chartH3a.textContent = '世界杯档案分层命中';
      if (chartH3b) chartH3b.textContent = '分阶段核心3 / 完整池';
      paintBar(['核心3', '完整池', '方向覆盖', '未中'], [W.meta.corePct, W.meta.poolPct, W.meta.coverPct, W.meta.missPct], [COLORS[0], COLORS[5], COLORS[2], COLORS[7]]);
      paintStageBars(W);
      return;
    }

    // —— 联赛：韩职 / 挪超 / 芬超 / 瑞超 ——
    showWcExtra(null, false);
    document.getElementById('boardLegend').innerHTML =
      '<span><i class="l-hit"></i>主选命中</span><span><i class="l-partial"></i>防守命中</span><span><i class="l-miss"></i>未覆盖</span>';

    var matches = D.matches.filter(function (m) { return m.league === id; });
    var kpis = leagueKpis(matches);
    document.getElementById('boardTitle').textContent = id + ' · 命中审计（' + matches.length + '场）';
    document.getElementById('ruleLine').textContent = '仅统计本轮「' + id + '」样本；口径：竞彩 90 分钟及伤停补时。';
    document.getElementById('kpis').innerHTML = kpis.map(hitbar).join('');
    document.getElementById('detailTitle').textContent = id + '逐场明细（' + matches.length + '）';
    document.getElementById('boardList').innerHTML = matches.map(reviewCard).join('');
    buildBoardFilters('league');

    var note = LEAGUE_NOTES[id] || { good: ['见上表分层命中'], bad: ['样本较小，仅供结构研究'] };
    setConclusions(id + ' 结论', note.good, note.bad, '共 ' + matches.length + ' 场可核验复盘。');
    if (chartH3a) chartH3a.textContent = id + ' 分层命中率';
    if (chartH3b) chartH3b.textContent = id + ' 胜平负结构';
    paintBar(kpis.map(function (k) { return k.label; }), kpis.map(function (k) { return k.pct; }), kpis.map(function (k) { return k.color; }));
    if (typeof Chart !== 'undefined') {
      var cv = document.getElementById('chartLeague');
      var rHit = countRes(matches, 'r', 'hit');
      var rCover = countRes(matches, 'r', 'cover') - rHit;
      var rMiss = matches.length - countRes(matches, 'r', 'cover');
      chartSide = new Chart(cv, {
        type: 'doughnut',
        data: {
          labels: ['主选命中', '防守命中', '未覆盖'],
          datasets: [{ data: [rHit, rCover, rMiss], backgroundColor: ['#1f9a62', '#e0a01e', '#d4544c'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }

  function buildBoardFilters(mode) {
    var wrap = document.getElementById('boardFilters');
    var bulk = '<span class="bulk-sep"></span><button class="bulk expand" type="button" data-bulk="open">一键展开</button>' +
      '<button class="bulk collapse" type="button" data-bulk="close">一键收起</button>' +
      '<input class="search" placeholder="搜索球队/编号/结论">';
    if (mode === 'wc' || mode === 'wc-mixed') {
      wrap.innerHTML =
        '<button class="filter active" data-f="all" type="button">全部</button>' +
        (mode === 'wc-mixed' ? '<button class="filter" data-f="round" type="button">仅本轮收官</button><button class="filter" data-f="archive" type="button">仅86档案</button>' : '') +
        '<button class="filter" data-f="小组赛" type="button">小组赛</button>' +
        '<button class="filter" data-f="32强" type="button">32强</button>' +
        '<button class="filter" data-f="16强" type="button">16强</button>' +
        '<button class="filter" data-f="1/4决赛" type="button">1/4</button>' +
        '<button class="filter" data-f="半决赛" type="button">半决赛</button>' +
        '<span class="bulk-sep"></span>' +
        '<button class="filter" data-f="core" type="button">核心3</button>' +
        '<button class="filter" data-f="pool" type="button">比分池</button>' +
        '<button class="filter" data-f="dir" type="button">方向</button>' +
        '<button class="filter" data-f="miss" type="button">未中</button>' +
        '<button class="filter" data-f="hit" type="button">本轮主选</button>' +
        '<button class="filter" data-f="partial" type="button">本轮防守</button>' + bulk;
    } else {
      wrap.innerHTML =
        '<button class="filter active" data-f="all" type="button">全部</button>' +
        '<button class="filter" data-f="hit" type="button">主选命中</button>' +
        '<button class="filter" data-f="partial" type="button">防守命中</button>' +
        '<button class="filter" data-f="miss" type="button">未覆盖</button>' +
        '<button class="filter" data-f="周六" type="button">周六</button>' +
        '<button class="filter" data-f="周日" type="button">周日</button>' + bulk;
    }
    function apply() {
      var f = wrap.querySelector('.filter.active').dataset.f;
      var q = (wrap.querySelector('.search').value || '').toLowerCase();
      var list = document.getElementById('boardList');
      var inArchive = false;
      list.childNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.classList && node.classList.contains('board-sec')) {
          inArchive = (node.textContent || '').indexOf('86') >= 0;
          node.style.display = '';
          return;
        }
        if (!node.classList || !node.classList.contains('match')) return;
        var ok = true;
        var isRound = !node.className.includes('wc-');
        if (f === 'round') ok = isRound;
        else if (f === 'archive') ok = !isRound;
        else if (f === 'core' || f === 'pool' || f === 'dir') ok = !isRound && node.dataset.status === f;
        else if (f === 'miss') ok = isRound ? node.dataset.state === 'miss' : node.dataset.status === 'miss';
        else if (f === 'hit' || f === 'partial') ok = isRound && node.dataset.state === f;
        else if (f === '周六' || f === '周日') ok = isRound && node.dataset.day === f;
        else if (f !== 'all') ok = !isRound && node.dataset.stage === f;
        if (q && !(node.dataset.search || '').includes(q)) ok = false;
        node.style.display = ok ? '' : 'none';
      });
    }
    wrap.querySelectorAll('.filter').forEach(function (b) {
      b.onclick = function () {
        wrap.querySelectorAll('.filter').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        apply();
      };
    });
    wrap.querySelector('.search').oninput = apply;
    wrap.querySelectorAll('[data-bulk]').forEach(function (b) {
      b.onclick = function () {
        var open = b.dataset.bulk === 'open';
        document.querySelectorAll('#boardList .match').forEach(function (card) {
          if (card.style.display === 'none') return;
          if (!card.querySelector('.detail')) return;
          card.classList.toggle('open', open);
        });
      };
    });
  }

  function init() {
    var D = window.MS_DATA;
    var W = window.WC86_DATA;
    if (!D || !W) return;

    var chips = [
      { id: '世界杯', label: '本轮世界杯', sub: (86 + roundWcMatches(D).length) + '场' },
      { id: '韩职', label: '韩职', sub: D.matches.filter(function (m) { return m.league === '韩职'; }).length + '场' },
      { id: '挪超', label: '挪超', sub: D.matches.filter(function (m) { return m.league === '挪超'; }).length + '场' },
      { id: '芬超', label: '芬超', sub: D.matches.filter(function (m) { return m.league === '芬超'; }).length + '场' },
      { id: '瑞超', label: '瑞超', sub: D.matches.filter(function (m) { return m.league === '瑞超'; }).length + '场' }
    ];

    var wrap = document.getElementById('compSwitch');
    if (!wrap) return;
    wrap.innerHTML = chips.map(function (c) {
      return '<button type="button" class="comp" data-comp="' + c.id + '"><b>' + c.label + '</b><span>' + c.sub + '</span></button>';
    }).join('');
    wrap.querySelectorAll('.comp').forEach(function (b) {
      b.onclick = function () { selectBoard(b.dataset.comp); };
    });
    selectBoard('世界杯');
  }

  window.MS_ReviewBoards = { init: init, select: selectBoard };
})();
