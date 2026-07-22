/* MatchStruct — competition-scoped review boards (research demo only) */
(function () {
  var COLORS = ['#0c6b61', '#1a8f7a', '#b07a22', '#c4923a', '#3a6f8c', '#4a7fa0', '#8a5f6a', '#9a4540'];
  var chartRates = null;
  var chartSide = null;
  var current = 'round';
  var viewMode = 'league'; // league | day
  var currentDay = '';

  /** Weekday label → calendar stamp (aligned with 2026-07 snapshot) */
  var DAY_META = {
    '周五': { md: '07-17', name: '周五' },
    '周六': { md: '07-18', name: '周六' },
    '周日': { md: '07-19', name: '周日' },
    '周一': { md: '07-20', name: '周一' },
    '周二': { md: '07-21', name: '周二' },
    '周三': { md: '07-22', name: '周三' },
    '周四': { md: '07-23', name: '周四' }
  };
  var DAY_ORDER = ['周五', '周六', '周日', '周一', '周二', '周三', '周四'];

  var LEAGUE_NOTES = {
    '韩职': {
      good: ['周二让球强：全北/蔚山-1与济州+1均中', '防平覆盖有效（济州1-1、全北0-0）', '过热标签对全北有效'],
      bad: ['普通主选偏弱；蔚山内部冲突（-1让负59%仍推主胜）', '全北平局情景未纳入0-0', '低概率场次仍被包装成单选']
    },
    '挪超': {
      good: ['普通胜平负主选 4/6', '莫尔德过热反例兑现', '维京主胜与 -2 防守拆分正确'],
      bad: ['让球净胜幅度不稳定', '开放局尾部进球（如汉坎 1-4）', '过热热门仍需保留平局']
    },
    '芬超': {
      good: ['周一玛丽港 0-2 拉赫蒂完整命中', '总进球防守（含防4球）可用', '让负在轻优势 / 客胜清晰局更稳'],
      bad: ['周一 TPS 大幅逆市场修正失败（1-3）', '国际图尔库密防 0-0 被低估', '逆市场>10pt 不得列为让球强方向']
    },
    '瑞超': {
      good: ['周末主选方向扎实；周一防平有效（0-0 / 2-2）', '卡尔马-1 让负结构清晰', '风险防守标签可保留'],
      bad: ['周一客胜单选与开放球数误判', '高平局+双方进球须强制纳入 2-2', '低位封锁场景须抬 0-0 / 压低 3+ 球']
    },
    '巴甲': {
      good: ['米竞技1-1：防平/让负/低比分/1-1第2位完整', '正确识别创造点缺阵压低净胜', '让负核心方向清晰'],
      bad: ['主胜43%仍写成明确主胜，宜改为胜/平', '样本仅1场']
    },
    '欧冠': {
      good: ['萨巴赫主胜+1-0场景正确', '格风暴主胜方向正确且防4球命中', '让球整体识别强队难穿盘'],
      bad: ['奥胡斯1-4：节奏差/欧战经验严重低估', '格风暴净胜幅度与崩溃尾部不足', '首回合总球易偏高']
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
    notice.textContent = ((W.meta.correction || '') + ' 三四名决赛与决赛已并入本「2026世界杯」全程复盘。').replace(/\s+/g, ' ').trim();
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

  /** Convert round WC matches into the same World Cup detail stream (三四名/决赛). */
  function finalStageCards(D) {
    var round = roundWcMatches(D);
    return round.map(function (m, i) {
      var stage = (m.home === '法国' || m.away === '英格兰' || (m.home === '法国' && m.away === '英格兰'))
        ? '三四名决赛' : '决赛';
      // Prefer explicit mapping by known fixtures
      if (m.home === '法国' && m.away === '英格兰') stage = '三四名决赛';
      if (m.home === '西班牙' && m.away === '阿根廷') stage = '决赛';
      var st = m.res.r === 'hit' ? 'core' : m.res.r === 'partial' ? 'dir' : 'miss';
      if (m.res.s === 'hit' && st === 'miss') st = 'pool';
      if (m.res.s === 'hit' && st === 'dir') { /* keep dir or upgrade */ }
      // Better: if score in top3 of pool → core; if in pool → pool; else if direction partial/hit
      if (m.res.s === 'hit' && /第[123]位/.test(m.res.sl || '')) st = 'core';
      else if (m.res.s === 'hit') st = 'pool';
      else if (m.res.r === 'hit') st = 'dir';
      else if (m.res.r === 'partial') st = 'dir';
      else st = 'miss';

      var score = String(m.score || '').replace(':', '-');
      return {
        n: 86 + i + 1,
        date: m.day === '周六' ? '07-18' : m.day === '周日' ? '07-19' : m.day === '周一' ? '07-20' : m.day === '周二' ? '07-21' : '07-22',
        stage: stage,
        home: m.home,
        away: m.away,
        score: score,
        status: st,
        statusLabel: st === 'core' ? '核心3命中' : st === 'pool' ? '比分池命中' : st === 'dir' ? '方向命中' : '未命中',
        analysis: m.summary || '',
        tags: [m.pick, m.hc, m.goals].filter(Boolean),
        detail: {
          pred: (m.scores || []).slice(0, 3).join(' / '),
          pool: (m.scores || []).join(' · '),
          direction: m.res.rl || m.pick,
          goals: m.res.gl || m.goals,
          strictDir: m.res.rl,
          goalsCover: m.res.gl
        },
        _fromRound: true,
        _raw: m
      };
    });
  }

  function allWorldCupMatches(D, W) {
    return W.matches.concat(finalStageCards(D));
  }

  function overviewStats(D, W) {
    var types = [
      { id: '世界杯', label: '2026世界杯' },
      { id: '韩职', label: '韩职' },
      { id: '挪超', label: '挪超' },
      { id: '芬超', label: '芬超' },
      { id: '瑞超', label: '瑞超' },
      { id: '巴甲', label: '巴甲' },
      { id: '欧冠', label: '欧冠' }
    ];
    return types.map(function (t) {
      if (t.id === '世界杯') {
        var total = 86 + roundWcMatches(D).length;
        return {
          id: t.id,
          label: t.label,
          big: W.meta.poolPct + '%',
          line1: '完整池覆盖 ' + W.meta.pool + '/86',
          line2: '核心3 ' + W.meta.corePct + '% · 明细 ' + total + ' 场'
        };
      }
      var ms = D.matches.filter(function (m) { return m.league === t.id; });
      if (!ms.length) return null;
      var cover = countRes(ms, 'r', 'cover');
      var hit = countRes(ms, 'r', 'hit');
      return {
        id: t.id,
        label: t.label,
        big: pct(cover, ms.length) + '%',
        line1: '胜平负覆盖 ' + cover + '/' + ms.length,
        line2: '主选命中 ' + hit + '/' + ms.length
      };
    }).filter(Boolean);
  }

  function renderDeskPulse() {
    var D = window.MS_DATA;
    var W = window.WC86_DATA;
    var el = document.getElementById('deskPulse');
    if (!el || !D || !W) return;
    var leagueN = D.matches.filter(function (m) { return m.league !== '世界杯'; }).length;
    var wcN = 86 + roundWcMatches(D).length;
    var cover22 = countRes(D.matches, 'r', 'cover');
    var leagueTypes = ['韩职', '挪超', '芬超', '瑞超', '巴甲', '欧冠'].filter(function (L) {
      return D.matches.some(function (m) { return m.league === L; });
    });
    el.innerHTML =
      '<div class="pulse"><b>' + (leagueN + wcN) + '</b><span>可浏览复盘场次<br>世界杯 ' + wcN + ' + 联赛 ' + leagueN + '</span></div>' +
      '<div class="pulse"><b>' + (1 + leagueTypes.length) + '</b><span>赛事类型看板<br>世界杯 / ' + leagueTypes.join(' / ') + '</span></div>' +
      '<div class="pulse"><b>' + W.meta.poolPct + '%</b><span>世界杯完整池覆盖<br>核心3 ' + W.meta.corePct + '% · 方向覆盖 ' + W.meta.coverPct + '%</span></div>' +
      '<div class="pulse"><b>' + pct(cover22, D.matches.length) + '%</b><span>联赛样本胜平负覆盖 · ' + D.matches.length + '场<br>主选 ' + countRes(D.matches, 'r', 'hit') + '/' + D.matches.length + (D.meta.latestRound ? '<br>' + D.meta.latestRound : '') + '</span></div>';
  }

  function scoreHits(m) {
    // higher = better overall card for spotlight
    var score = 0;
    ['r', 'h', 'g', 's'].forEach(function (k) {
      if (m.res[k] === 'hit') score += 2;
      else if (m.res[k] === 'partial') score += 1;
    });
    return score;
  }

  function renderLeagueExtras(id, matches, kpis) {
    var spots = document.getElementById('boardSpots');
    var ribbon = document.getElementById('boardRibbon');
    var matrix = document.getElementById('boardMatrixWrap');
    if (!spots || !ribbon || !matrix) return;

    var sorted = matches.slice().sort(function (a, b) { return scoreHits(b) - scoreHits(a); });
    var best = sorted[0];
    var worst = sorted[sorted.length - 1];
    var hcBest = matches.filter(function (m) { return m.res.h === 'hit'; })[0] || best;
    var coverPct = pct(countRes(matches, 'r', 'cover'), matches.length);

    ribbon.innerHTML = '<strong>' + id + ' 速读：</strong>胜平负覆盖 <b>' + coverPct + '%</b>；让球含第二选 <b>' +
      pct(countRes(matches, 'h', 'cover'), matches.length) + '%</b>；七比分池 <b>' +
      pct(countRes(matches, 's', 'cover'), matches.length) + '%</b>。样本 ' + matches.length + ' 场，适合看结构而非外推到全赛季。';

    spots.innerHTML =
      '<div class="spot ok"><div class="k">结构最完整</div><div class="t">' + best.home + ' ' + best.score + ' ' + best.away +
      '</div><div class="d">' + String(best.summary || '').slice(0, 90) + (best.summary && best.summary.length > 90 ? '…' : '') + '</div></div>' +
      '<div class="spot warn"><div class="k">让球观察样本</div><div class="t">' + hcBest.home + ' ' + hcBest.score + ' ' + hcBest.away +
      '</div><div class="d">' + cleanLabel(hcBest.res.hl) + ' · ' + hcBest.hc + '</div></div>' +
      '<div class="spot bad"><div class="k">需复盘修正</div><div class="t">' + worst.home + ' ' + worst.score + ' ' + worst.away +
      '</div><div class="d">' + String(worst.summary || '').slice(0, 90) + (worst.summary && worst.summary.length > 90 ? '…' : '') + '</div></div>';

    matrix.innerHTML = '<table class="matrix"><thead><tr><th>市场</th><th>命中</th><th>覆盖</th><th>解读</th></tr></thead><tbody>' +
      kpis.map(function (k) {
        var cls = k.pct >= 66 ? 'good' : k.pct >= 45 ? 'mid' : 'bad';
        var tip = k.pct >= 66 ? '结构可用' : k.pct >= 45 ? '需防守双选' : '明显薄弱';
        return '<tr><td>' + k.label + '</td><td class="num">' + k.hit + '</td><td class="num ' + cls + '">' + k.pct + '%</td><td>' + tip + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function renderWcExtras(W, allWc) {
    var spots = document.getElementById('boardSpots');
    var ribbon = document.getElementById('boardRibbon');
    var matrix = document.getElementById('boardMatrixWrap');
    if (!spots || !ribbon || !matrix) return;
    var by = { core: 0, pool: 0, dir: 0, miss: 0 };
    allWc.forEach(function (m) { by[m.status] = (by[m.status] || 0) + 1; });
    ribbon.innerHTML = '<strong>2026世界杯速读：</strong>明细 <b>' + allWc.length + '</b> 场（含三四名/决赛）。核心3 <b>' +
      W.meta.core + '/86</b>，完整池 <b>' + W.meta.pool + '/86</b>，方向或比分覆盖 <b>' + W.meta.cover + '/86</b>。公开表述请同时披露分母与 90′ 口径。';

    var coreEx = allWc.filter(function (m) { return m.status === 'core'; })[0];
    var missEx = (W.misses && W.misses[0]) || allWc.filter(function (m) { return m.status === 'miss'; })[0];
    var ko = allWc.filter(function (m) { return m.stage && m.stage !== '小组赛'; });
    spots.innerHTML =
      '<div class="spot ok"><div class="k">核心3样本</div><div class="t">' + (coreEx ? coreEx.home + ' ' + coreEx.score + ' ' + coreEx.away : '—') +
      '</div><div class="d">' + (coreEx ? (coreEx.analysis || '').slice(0, 80) : '') + '</div></div>' +
      '<div class="spot warn"><div class="k">淘汰赛体量</div><div class="t">' + ko.length + ' 场淘汰+决赛阶段</div>' +
      '<div class="d">含 32强至决赛；淘汰赛池覆盖通常高于小组赛。</div></div>' +
      '<div class="spot bad"><div class="k">典型未中</div><div class="t">' + (missEx ? (missEx.home + ' vs ' + missEx.away + ' ' + (missEx.score || '')) : '—') +
      '</div><div class="d">' + (missEx ? (missEx.note || missEx.analysis || '') : '') + '</div></div>';

    matrix.innerHTML = '<table class="matrix"><thead><tr><th>命中层级</th><th>场次</th><th>占比</th><th>含义</th></tr></thead><tbody>' +
      [
        ['核心3', by.core, '真实比分进入前三候选'],
        ['比分池', by.pool, '进入七比分但不在前三'],
        ['方向', by.dir, '比分未中但胜平负方向对'],
        ['未中', by.miss, '比分与方向均未覆盖']
      ].map(function (row) {
        var p = pct(row[1], allWc.length);
        var cls = row[0] === '未中' ? 'bad' : p >= 30 ? 'good' : 'mid';
        return '<tr><td>' + row[0] + '</td><td class="num">' + row[1] + '</td><td class="num ' + cls + '">' + p + '%</td><td>' + row[2] + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function clearExtras() {
    ['boardSpots', 'boardRibbon', 'boardMatrixWrap'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
  }

  function dayMeta(day) {
    return DAY_META[day] || { md: day, name: day };
  }

  function snapshotTodayMd() {
    var snap = (window.MS_DATA && MS_DATA.meta && MS_DATA.meta.snapshot) || '';
    var m = String(snap).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[2] + '-' + m[3];
    return '07-22';
  }

  /** Collect date chips: reviewed days from matches + pending days from today */
  function collectDayChips(D) {
    var map = {};
    (D.matches || []).forEach(function (m) {
      if (!m.day) return;
      if (!map[m.day]) map[m.day] = { day: m.day, reviewed: [], pending: [] };
      map[m.day].reviewed.push(m);
    });
    (D.today || []).forEach(function (m) {
      if (!m.day) return;
      if (!map[m.day]) map[m.day] = { day: m.day, reviewed: [], pending: [] };
      map[m.day].pending.push(m);
    });
    var todayMd = snapshotTodayMd();
    return DAY_ORDER.filter(function (d) { return !!map[d]; }).map(function (d) {
      var row = map[d];
      var meta = dayMeta(d);
      var pendingOnly = row.pending.length && !row.reviewed.length;
      var n = pendingOnly ? row.pending.length : row.reviewed.length;
      var cover = pendingOnly ? 0 : countRes(row.reviewed, 'r', 'cover');
      return {
        day: d,
        md: meta.md,
        label: meta.md + ' ' + meta.name,
        n: n,
        cover: cover,
        pending: pendingOnly,
        isToday: meta.md === todayMd,
        reviewed: row.reviewed,
        pendingList: row.pending
      };
    });
  }

  function pendingCard(m) {
    var grade = m.grade || '观察';
    var rc = grade === '强势' ? 'hit' : grade === '平稳' ? 'partial' : 'miss';
    return '<article class="match ' + rc + '" data-grade="' + grade + '" data-day="' + m.day + '" data-league="' + m.league + '" data-search="' +
      (m.day + m.id + m.home + m.away + m.league).toLowerCase() + '">' +
      '<div class="match-head">' +
      '<div class="meta"><span>' + m.day + m.id + '</span><span class="dot"></span><b>' + m.league + '</b>' +
      (m.time ? '<span>' + m.time + '</span>' : '') +
      '<span class="tag ' + rc + '">' + grade + '</span>' +
      '<span class="chip">置信 ' + m.conf + '</span><span class="stamp partial"><span class="ico">·</span>待赛</span></div>' +
      '<div class="teams-row"><div class="teams"><span class="crest">' + initials(m.home) + '</span>' + m.home +
      '<span class="score">VS</span>' + m.away + '<span class="crest">' + initials(m.away) + '</span></div></div>' +
      '<div class="section-label">赛前推演</div>' +
      '<div class="predline"><span class="chip key">' + m.pick + '</span><span class="chip key">' + m.hc + '</span><span class="chip">' + m.goals + '</span></div>' +
      '<span class="toggle"></span></div>' +
      '<div class="detail"><div class="grid2">' +
      '<div class="box"><h4>模型胜平负</h4>' + probBars(m) + '<p style="margin:8px 0 0;font-size:12px;color:#667">' + (m.summary || '') + '</p></div>' +
      '<div class="box"><h4>七比分池</h4><div class="scores">' + (m.scores || []).map(function (s, i) {
        return '<span class="sc ' + (i < 3 ? 'top' : '') + '">' + s + '</span>';
      }).join('') + '</div></div></div>' +
      '<div class="grid2">' +
      '<div class="box"><h4>逐场分析要点</h4><ul>' + (m.analysis || []).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' +
      '<div class="box"><h4>风险点</h4><ul>' + (m.risks || []).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' +
      '</div></div></article>';
  }

  function renderDateStrip(activeDay) {
    var D = window.MS_DATA;
    var el = document.getElementById('dateStrip');
    if (!el || !D) return;
    var chips = collectDayChips(D);
    el.innerHTML = chips.map(function (c) {
      var bot = c.pending
        ? ('<span>' + c.n + '场</span>' + (c.isToday ? '<span class="today-tag">今日</span>' : ''))
        : ('<span>' + c.n + ' 中 ' + c.cover + '</span>');
      return '<button type="button" class="date-chip' +
        (c.day === activeDay ? ' active' : '') +
        (c.pending ? ' pending' : '') +
        '" data-day="' + c.day + '">' +
        '<span class="d-top">' + c.label + '</span>' +
        '<span class="d-bot">' + bot + '</span></button>';
    }).join('');
    el.querySelectorAll('.date-chip').forEach(function (b) {
      b.onclick = function () { selectDay(b.dataset.day); };
    });
    // Keep active chip in view
    var act = el.querySelector('.date-chip.active');
    if (act && act.scrollIntoView) {
      try { act.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
    }
  }

  function dayConclusions(day, matches) {
    var cover = countRes(matches, 'r', 'cover');
    var hit = countRes(matches, 'r', 'hit');
    var leagues = [];
    matches.forEach(function (m) {
      if (leagues.indexOf(m.league) < 0) leagues.push(m.league);
    });
    var good = [
      '胜平负含防守 ' + cover + '/' + matches.length + '（' + pct(cover, matches.length) + '%）',
      '主选命中 ' + hit + '/' + matches.length,
      '覆盖赛事：' + leagues.join(' / ')
    ];
    var bad = [];
    var miss = matches.filter(function (m) { return m.res.r === 'miss'; });
    if (miss.length) {
      bad.push('未覆盖 ' + miss.length + ' 场，如 ' + miss[0].home + ' vs ' + miss[0].away);
    }
    if (pct(hit, matches.length) < 40) bad.push('主选命中偏低，宜看防守双选结构');
    if (!bad.length) bad.push('样本仅单日切片，勿外推全赛季');
    return { good: good, bad: bad, sub: dayMeta(day).md + ' ' + day + ' · ' + matches.length + ' 场可核验' };
  }

  function selectDay(day) {
    currentDay = day;
    viewMode = 'day';
    var D = window.MS_DATA;
    if (!D) return;
    renderDateStrip(day);
    destroyCharts();
    showWcExtra(null, false);
    clearExtras();

    var chip = collectDayChips(D).filter(function (c) { return c.day === day; })[0];
    if (!chip) return;

    var chartH3a = document.querySelector('#boardCharts .chart-box:nth-child(1) h3');
    var chartH3b = document.querySelector('#boardCharts .chart-box:nth-child(2) h3');
    var meta = dayMeta(day);
    var titleBase = meta.md + ' ' + meta.name;

    if (chip.pending) {
      var list = chip.pendingList;
      document.getElementById('boardTitle').textContent = titleBase + ' · 待赛推演（' + list.length + '场）';
      document.getElementById('ruleLine').textContent =
        '当日场次尚未完赛，以下为赛前推演。完整策略台见「今日推演」。口径：竞彩 90′。';
      document.getElementById('kpis').innerHTML =
        '<div class="kpi"><b>' + list.length + '</b><span>待赛场次</span></div>' +
        '<div class="kpi"><b>' + list.filter(function (m) { return m.grade === '强势'; }).length + '</b><span>强势观察</span></div>' +
        '<div class="kpi"><b>—</b><span>命中待赛后入库</span></div>';
      document.getElementById('detailTitle').textContent = titleBase + '推演明细（' + list.length + '）';
      document.getElementById('boardLegend').innerHTML =
        '<span><i class="l-hit"></i>强势</span><span><i class="l-partial"></i>平稳</span><span><i class="l-miss"></i>观察</span>';
      document.getElementById('boardList').innerHTML = list.map(pendingCard).join('');
      buildBoardFilters('pending');
      var notice = document.getElementById('boardNotice');
      if (notice) {
        notice.hidden = false;
        notice.innerHTML = chip.isToday
          ? '今日场次 · 可切换到 <button type="button" class="jump-today" style="font:inherit;font-weight:800;color:#0b7a6c;background:none;border:0;cursor:pointer;text-decoration:underline">今日推演</button> 查看策略台与市场对比。'
          : '待赛日切片 · 赛果入库后将显示「场次 中 覆盖」命中条。';
        var jumpBtn = notice.querySelector('.jump-today');
        if (jumpBtn) {
          jumpBtn.onclick = function () {
            if (typeof window.activatePanel === 'function') window.activatePanel('today');
            else {
              var tab = document.querySelector('.tab[data-panel="today"]');
              if (tab) tab.click();
            }
          };
        }
      }
      var ribbon = document.getElementById('boardRibbon');
      if (ribbon) {
        ribbon.innerHTML = '<strong>' + titleBase + '：</strong>共 <b>' + list.length + '</b> 场待赛推演；' +
          (chip.isToday ? '标记为今日。' : '') + '命中情况将在完赛复盘后更新。';
      }
      setConclusions(titleBase + ' 待赛',
        ['推演 ' + list.length + ' 场已发布', '详见今日推演策略台'],
        ['尚未产生可核验命中'],
        '完赛后自动并入按日期复盘。');
      if (chartH3a) chartH3a.textContent = titleBase + ' 待赛分布';
      if (chartH3b) chartH3b.textContent = '联赛构成';
      var byL = {};
      list.forEach(function (m) { byL[m.league] = (byL[m.league] || 0) + 1; });
      var labs = Object.keys(byL);
      paintBar(labs, labs.map(function (k) { return pct(byL[k], list.length); }), COLORS);
      if (typeof Chart !== 'undefined') {
        var cv = document.getElementById('chartLeague');
        var gStrong = list.filter(function (m) { return m.grade === '强势'; }).length;
        var gMid = list.filter(function (m) { return m.grade === '平稳'; }).length;
        var gWatch = list.length - gStrong - gMid;
        chartSide = new Chart(cv, {
          type: 'doughnut',
          data: {
            labels: ['强势', '平稳', '观察'],
            datasets: [{ data: [gStrong, gMid, gWatch], backgroundColor: ['#1f9a62', '#e0a01e', '#8a969e'] }]
          },
          options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
      }
      return;
    }

    // Reviewed day
    var matches = chip.reviewed;
    var kpis = leagueKpis(matches);
    document.getElementById('boardTitle').textContent = titleBase + ' · 命中审计（' + matches.length + '场）';
    document.getElementById('ruleLine').textContent =
      '按比赛日期汇总全赛事样本；命中条口径为「场次数 中 胜平负含防守」。竞彩 90′。';
    document.getElementById('kpis').innerHTML = kpis.map(hitbar).join('');
    document.getElementById('detailTitle').textContent = titleBase + '逐场明细（' + matches.length + '）';
    document.getElementById('boardLegend').innerHTML =
      '<span><i class="l-hit"></i>主选命中</span><span><i class="l-partial"></i>防守命中</span><span><i class="l-miss"></i>未覆盖</span>';
    document.getElementById('boardList').innerHTML = matches.map(reviewCard).join('');
    buildBoardFilters('day');
    renderLeagueExtras(titleBase, matches, kpis);
    var concl = dayConclusions(day, matches);
    setConclusions(titleBase + ' 结论', concl.good, concl.bad, concl.sub);
    if (chartH3a) chartH3a.textContent = titleBase + ' 分层命中率';
    if (chartH3b) chartH3b.textContent = titleBase + ' 胜平负结构';
    paintBar(kpis.map(function (k) { return k.label; }), kpis.map(function (k) { return k.pct; }), kpis.map(function (k) { return k.color; }));
    if (typeof Chart !== 'undefined') {
      var cv2 = document.getElementById('chartLeague');
      var rHit = countRes(matches, 'r', 'hit');
      var rCover = countRes(matches, 'r', 'cover') - rHit;
      var rMiss = matches.length - countRes(matches, 'r', 'cover');
      chartSide = new Chart(cv2, {
        type: 'doughnut',
        data: {
          labels: ['主选命中', '防守命中', '未覆盖'],
          datasets: [{ data: [rHit, rCover, rMiss], backgroundColor: ['#1f9a62', '#e0a01e', '#d4544c'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }

  function setViewMode(mode) {
    viewMode = mode;
    var leagueBlock = document.getElementById('leagueViewBlock');
    var dayBlock = document.getElementById('dayViewBlock');
    if (leagueBlock) leagueBlock.hidden = mode !== 'league';
    if (dayBlock) dayBlock.hidden = mode !== 'day';
    document.querySelectorAll('#viewModes .view-mode').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    if (mode === 'day') {
      var D = window.MS_DATA;
      var chips = collectDayChips(D);
      var todayChip = chips.filter(function (c) { return c.isToday; })[0];
      var pick = todayChip || chips[chips.length - 1];
      if (pick) selectDay(pick.day);
    } else {
      var notice = document.getElementById('boardNotice');
      if (notice && current !== '世界杯') notice.hidden = true;
      selectBoard(current === 'round' ? '世界杯' : current);
    }
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
    viewMode = 'league';
    var leagueBlock = document.getElementById('leagueViewBlock');
    var dayBlock = document.getElementById('dayViewBlock');
    if (leagueBlock) leagueBlock.hidden = false;
    if (dayBlock) dayBlock.hidden = true;
    document.querySelectorAll('#viewModes .view-mode').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === 'league');
    });
    var D = window.MS_DATA;
    var W = window.WC86_DATA;
    document.querySelectorAll('#compSwitch .comp').forEach(function (b) {
      b.classList.toggle('active', b.dataset.comp === id);
    });
    renderOverview(id);
    destroyCharts();
    var chartH3a = document.querySelector('#boardCharts .chart-box:nth-child(1) h3');
    var chartH3b = document.querySelector('#boardCharts .chart-box:nth-child(2) h3');

    // —— 2026世界杯（全程：86 场 + 三四名/决赛）——
    if (id === '世界杯') {
      var allWc = allWorldCupMatches(D, W);
      document.getElementById('boardTitle').textContent = '2026世界杯 · 命中审计（' + allWc.length + ' 场）';
      document.getElementById('ruleLine').textContent =
        '2026世界杯全程复盘：七比分模型按开赛顺序核验；三四名决赛与决赛一并纳入。口径为 90 分钟常规时间（不含加时/点球进比分）。';
      document.getElementById('kpis').innerHTML = W.meta.kpis.map(function (k) {
        return '<div class="kpi"><b>' + k.value + '</b><span>' + k.label + '</span></div>';
      }).join('');

      document.getElementById('detailTitle').textContent = '2026世界杯逐场明细（' + allWc.length + '）';
      document.getElementById('boardLegend').innerHTML =
        '<span><i class="l-core"></i>核心3</span><span><i class="l-pool"></i>比分池</span>' +
        '<span><i class="l-dir"></i>方向</span><span><i class="l-miss"></i>未覆盖</span>';

      document.getElementById('boardList').innerHTML = allWc.map(wcCard).join('');

      buildBoardFilters('wc');
      showWcExtra(W, true);
      renderWcExtras(W, allWc);
      var note = LEAGUE_NOTES['世界杯'];
      setConclusions('2026世界杯结论',
        ['完整比分池覆盖 57/86（66.3%）', '方向或比分覆盖 78/86（90.7%）', '32强 / 1/4 阶段比分覆盖强', note.good[0]],
        ['核心3排序偏弱（41.9%）', '大比分尾部压缩', '小组末轮战意与晋级子模型不足', note.bad[0]],
        '三四名决赛与决赛已并入同一「2026世界杯」看板，与小组赛至半决赛连续展示。');
      if (chartH3a) chartH3a.textContent = '2026世界杯分层命中';
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
    renderLeagueExtras(id, matches, kpis);

    var note2 = LEAGUE_NOTES[id] || { good: ['见上表分层命中'], bad: ['样本较小，仅供结构研究'] };
    setConclusions(id + ' 结论', note2.good, note2.bad, '共 ' + matches.length + ' 场可核验复盘。');
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
        '<button class="filter" data-f="小组赛" type="button">小组赛</button>' +
        '<button class="filter" data-f="32强" type="button">32强</button>' +
        '<button class="filter" data-f="16强" type="button">16强</button>' +
        '<button class="filter" data-f="1/4决赛" type="button">1/4</button>' +
        '<button class="filter" data-f="半决赛" type="button">半决赛</button>' +
        '<button class="filter" data-f="三四名决赛" type="button">三四名</button>' +
        '<button class="filter" data-f="决赛" type="button">决赛</button>' +
        '<span class="bulk-sep"></span>' +
        '<button class="filter" data-f="core" type="button">核心3</button>' +
        '<button class="filter" data-f="pool" type="button">比分池</button>' +
        '<button class="filter" data-f="dir" type="button">方向</button>' +
        '<button class="filter" data-f="miss" type="button">未中</button>' + bulk;
    } else if (mode === 'pending') {
      wrap.innerHTML =
        '<button class="filter active" data-f="all" type="button">全部</button>' +
        '<button class="filter" data-f="强势" type="button">强势</button>' +
        '<button class="filter" data-f="平稳" type="button">平稳</button>' +
        '<button class="filter" data-f="观察" type="button">观察</button>' + bulk;
    } else if (mode === 'day') {
      wrap.innerHTML =
        '<button class="filter active" data-f="all" type="button">全部</button>' +
        '<button class="filter" data-f="hit" type="button">主选命中</button>' +
        '<button class="filter" data-f="partial" type="button">防守命中</button>' +
        '<button class="filter" data-f="miss" type="button">未覆盖</button>' +
        '<button class="filter" data-f="韩职" type="button">韩职</button>' +
        '<button class="filter" data-f="挪超" type="button">挪超</button>' +
        '<button class="filter" data-f="芬超" type="button">芬超</button>' +
        '<button class="filter" data-f="瑞超" type="button">瑞超</button>' +
        '<button class="filter" data-f="巴甲" type="button">巴甲</button>' +
        '<button class="filter" data-f="欧冠" type="button">欧冠</button>' +
        '<button class="filter" data-f="世界杯" type="button">世界杯</button>' + bulk;
    } else {
      wrap.innerHTML =
        '<button class="filter active" data-f="all" type="button">全部</button>' +
        '<button class="filter" data-f="hit" type="button">主选命中</button>' +
        '<button class="filter" data-f="partial" type="button">防守命中</button>' +
        '<button class="filter" data-f="miss" type="button">未覆盖</button>' +
        '<button class="filter" data-f="周六" type="button">周六</button>' +
        '<button class="filter" data-f="周日" type="button">周日</button>' +
        '<button class="filter" data-f="周一" type="button">周一</button>' +
        '<button class="filter" data-f="周二" type="button">周二</button>' + bulk;
    }
    function apply() {
      var f = wrap.querySelector('.filter.active').dataset.f;
      var q = (wrap.querySelector('.search').value || '').toLowerCase();
      document.querySelectorAll('#boardList .match').forEach(function (card) {
        var ok = true;
        if (mode === 'wc' || mode === 'wc-mixed') {
          if (f === 'core' || f === 'pool' || f === 'dir' || f === 'miss') ok = card.dataset.status === f;
          else if (f !== 'all') ok = card.dataset.stage === f;
        } else if (mode === 'pending') {
          if (f !== 'all') ok = card.dataset.grade === f;
        } else if (mode === 'day') {
          if (f === 'hit' || f === 'partial' || f === 'miss') ok = card.dataset.state === f;
          else if (f !== 'all') ok = card.dataset.league === f;
        } else {
          if (f === 'hit' || f === 'partial' || f === 'miss') ok = card.dataset.state === f;
          else if (f === '周六' || f === '周日' || f === '周一' || f === '周二') ok = card.dataset.day === f;
        }
        if (q && !(card.dataset.search || '').includes(q)) ok = false;
        card.style.display = ok ? '' : 'none';
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
      { id: '世界杯', label: '2026世界杯', sub: (86 + roundWcMatches(D).length) + '场' },
      { id: '韩职', label: '韩职', sub: D.matches.filter(function (m) { return m.league === '韩职'; }).length + '场' },
      { id: '挪超', label: '挪超', sub: D.matches.filter(function (m) { return m.league === '挪超'; }).length + '场' },
      { id: '芬超', label: '芬超', sub: D.matches.filter(function (m) { return m.league === '芬超'; }).length + '场' },
      { id: '瑞超', label: '瑞超', sub: D.matches.filter(function (m) { return m.league === '瑞超'; }).length + '场' },
      { id: '巴甲', label: '巴甲', sub: D.matches.filter(function (m) { return m.league === '巴甲'; }).length + '场' },
      { id: '欧冠', label: '欧冠', sub: D.matches.filter(function (m) { return m.league === '欧冠'; }).length + '场' }
    ].filter(function (c) {
      if (c.id === '世界杯') return true;
      return D.matches.some(function (m) { return m.league === c.id; });
    });

    var wrap = document.getElementById('compSwitch');
    if (!wrap) return;
    wrap.innerHTML = chips.map(function (c) {
      return '<button type="button" class="comp" data-comp="' + c.id + '"><b>' + c.label + '</b><span>' + c.sub + '</span></button>';
    }).join('');
    wrap.querySelectorAll('.comp').forEach(function (b) {
      b.onclick = function () { selectBoard(b.dataset.comp); };
    });

    var modes = document.getElementById('viewModes');
    if (modes) {
      modes.querySelectorAll('.view-mode').forEach(function (b) {
        b.onclick = function () { setViewMode(b.dataset.mode); };
      });
    }

    renderDeskPulse();
    selectBoard('世界杯');
  }

  window.MS_ReviewBoards = { init: init, select: selectBoard, selectDay: selectDay, setViewMode: setViewMode };
})();
