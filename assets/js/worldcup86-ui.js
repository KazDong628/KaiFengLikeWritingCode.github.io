/* World Cup 86 panel — MatchStruct desk style */
(function () {
  function bootWc86() {
    var W = window.WC86_DATA;
    if (!W) return;
    var list = document.getElementById('wcList');
    if (!list) return;

    var statusText = {
      core: '核心3命中',
      pool: '比分池命中',
      dir: '方向命中',
      miss: '未覆盖'
    };
    var statusMark = { core: '✓', pool: '◐', dir: '→', miss: '✕' };

    document.getElementById('wcKpis').innerHTML = W.meta.kpis.map(function (k) {
      return '<div class="kpi"><b>' + k.value + '</b><span>' + k.label + '</span></div>';
    }).join('');

    document.getElementById('wcStages').innerHTML = W.stages.map(function (s) {
      var st = s.stats || {};
      function line(key) {
        var x = st[key];
        if (!x) return '';
        return '<div>' + key + ' <b>' + x.count + '</b>' + (x.pct ? '（' + x.pct + '）' : '') + '</div>';
      }
      return '<div class="wc-stage">' +
        '<div class="name">' + s.name + '</div>' +
        '<div class="n">' + s.n + '场</div>' +
        '<div class="lines">' +
          line('核心3') + line('完整池') + line('方向/比分覆盖') + line('未中') +
        '</div></div>';
    }).join('');

    if (W.meta.correction) {
      document.getElementById('wcNotice').textContent = W.meta.correction.replace(/\s+/g, ' ').trim();
    }

    function detailHtml(d) {
      if (!d) return '';
      var keys = [
        ['pred', '核心候选'],
        ['pool', '完整比分池'],
        ['direction', '方向'],
        ['goals', '总进球'],
        ['strictDir', '严格方向'],
        ['goalsCover', '球数覆盖']
      ];
      return '<div class="wc-detail">' + keys.map(function (pair) {
        if (!d[pair[0]]) return '';
        return '<div><small>' + pair[1] + '</small><b>' + d[pair[0]] + '</b></div>';
      }).join('') + '</div>';
    }

    function card(m) {
      var st = m.status || 'miss';
      var tags = (m.tags || []).map(function (t) {
        return '<span class="chip">' + t + '</span>';
      }).join('');
      var hasDetail = !!m.detail;
      var search = (m.home + m.away + m.score + (m.analysis || '') + (m.tags || []).join('')).toLowerCase();
      return '<article class="match wc-' + st + '" data-stage="' + m.stage + '" data-status="' + st + '" data-search="' + search + '">' +
        '<div class="match-head">' +
          '<div class="meta">' +
            '<span>#' + m.n + '</span><span class="dot"></span><span>' + m.date + '</span><span class="dot"></span><b>' + m.stage + '</b>' +
            '<span class="stamp wc-' + st + '"><span class="ico">' + (statusMark[st] || '·') + '</span>' + (statusText[st] || m.statusLabel || st) + '</span>' +
          '</div>' +
          '<div class="teams-row"><div class="teams">' +
            '<span class="crest">' + String(m.home).slice(0, 2) + '</span>' + m.home +
            '<span class="score">' + m.score + '</span>' +
            m.away + '<span class="crest">' + String(m.away).slice(0, 2) + '</span>' +
          '</div></div>' +
          '<p class="wc-note">' + (m.analysis || m.note || '') + '</p>' +
          (tags ? '<div class="predline">' + tags + '</div>' : '') +
          (hasDetail ? '<span class="toggle"></span>' : '') +
        '</div>' +
        (hasDetail ? '<div class="detail"><div class="box"><h4>淘汰赛明细</h4>' + detailHtml(m.detail) + '</div></div>' : '') +
      '</article>';
    }

    list.innerHTML = W.matches.map(card).join('');

    document.getElementById('wcMisses').innerHTML = (W.misses || []).map(function (m) {
      return '<div class="hot bad"><b>' + m.date + ' · ' + m.stage + ' · ' + m.home + ' vs ' + m.away + ' ' + m.score +
        '</b><div class="res">' + (m.note || '') + '</div></div>';
    }).join('');

    document.getElementById('wcLessons').innerHTML = (W.lessons || []).map(function (L) {
      return '<div class="box"><h4>' + L.title + '</h4><p style="margin:0;font-size:13px;color:#445;line-height:1.7">' + L.body + '</p></div>';
    }).join('');

    var sum = document.getElementById('wcSummary');
    if (sum && W.meta.summaryNote) sum.textContent = W.meta.summaryNote.replace(/\s+/g, ' ').trim();

    var wrap = document.getElementById('wcFilters');
    wrap.innerHTML =
      '<button class="filter active" data-f="all" type="button">全部 86</button>' +
      '<button class="filter" data-f="小组赛" type="button">小组赛</button>' +
      '<button class="filter" data-f="32强" type="button">32强</button>' +
      '<button class="filter" data-f="16强" type="button">16强</button>' +
      '<button class="filter" data-f="1/4决赛" type="button">1/4决赛</button>' +
      '<button class="filter" data-f="半决赛" type="button">半决赛</button>' +
      '<span class="bulk-sep" aria-hidden="true"></span>' +
      '<button class="filter" data-f="core" type="button">核心3</button>' +
      '<button class="filter" data-f="pool" type="button">比分池</button>' +
      '<button class="filter" data-f="dir" type="button">方向</button>' +
      '<button class="filter" data-f="miss" type="button">未中</button>' +
      '<span class="bulk-sep" aria-hidden="true"></span>' +
      '<button class="bulk expand" type="button" data-bulk="open">一键展开</button>' +
      '<button class="bulk collapse" type="button" data-bulk="close">一键收起</button>' +
      '<input class="search" placeholder="搜索球队/比分/结论">';

    function apply() {
      var f = wrap.querySelector('.filter.active').dataset.f;
      var q = (wrap.querySelector('.search').value || '').toLowerCase();
      list.querySelectorAll('.match').forEach(function (card) {
        var ok = true;
        if (f === 'core' || f === 'pool' || f === 'dir' || f === 'miss') ok = card.dataset.status === f;
        else if (f !== 'all') ok = card.dataset.stage === f;
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
        list.querySelectorAll('.match').forEach(function (card) {
          if (card.style.display === 'none') return;
          if (!card.querySelector('.detail')) return;
          card.classList.toggle('open', open);
        });
      };
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWc86);
  } else {
    bootWc86();
  }
  window.bootWc86 = bootWc86;
})();
