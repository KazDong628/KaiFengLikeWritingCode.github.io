/* MatchStruct — per-match strategy poll (research demo, not betting advice)
 * Renders into each match card; dock shows overall progress.
 * Global counts: CounterAPI v1. Falls back to local-only if network fails.
 */
(function () {
  var NS = 'matchstructkf';
  var API = 'https://api.counterapi.dev/v1/' + NS + '/';
  var STORE_KEY = 'ms_poll_votes_v1';
  var CACHE_KEY = 'ms_poll_counts_v1';
  var refreshTimer = null;
  var rotateIdx = 0;
  var online = true;
  var matches = [];
  var counts = {};
  var myVotes = {};
  var bound = false;

  function dayKey() {
    var t = (matches[0] && matches[0].time) || '';
    var m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + m[2] + m[3];
    var d0 = matches[0] && matches[0].day;
    return d0 ? ('batch_' + d0 + '_' + matches.length) : 'day';
  }
  function matchKey(m) {
    return String(m.day || '') + String(m.id);
  }
  function findMatch(id) {
    for (var i = 0; i < matches.length; i++) {
      if (matchKey(matches[i]) === id) return matches[i];
    }
    return null;
  }
  function slug(s) {
    return String(s).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  }
  function ckey(matchId, market, opt) {
    return 'd' + dayKey() + '_m' + matchId + '_' + market + '_' + slug(opt);
  }

  function loadLocal() {
    try { myVotes = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { myVotes = {}; }
    try { counts = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { counts = {}; }
  }
  function saveVotes() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(myVotes)); } catch (e) {}
  }
  function saveCounts() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(counts)); } catch (e) {}
  }

  function parseCount(j) {
    if (j == null) return 0;
    if (typeof j.value === 'number') return j.value;
    if (typeof j.count === 'number') return j.count;
    if (j.data && typeof j.data === 'number') return j.data;
    if (j.data && typeof j.data.value === 'number') return j.data.value;
    return Number(j) || 0;
  }

  function apiGet(name) {
    return fetch(API + encodeURIComponent(name) + '/', { method: 'GET', mode: 'cors' })
      .then(function (r) {
        if (r.status === 404) return 0;
        if (!r.ok) throw new Error('get ' + r.status);
        return r.json();
      })
      .then(function (j) { return typeof j === 'number' ? j : parseCount(j); });
  }
  function apiUp(name) {
    return fetch(API + encodeURIComponent(name) + '/up', { method: 'GET', mode: 'cors' })
      .then(function (r) { if (!r.ok) throw new Error('up ' + r.status); return r.json(); })
      .then(parseCount);
  }
  function apiDown(name) {
    return fetch(API + encodeURIComponent(name) + '/down', { method: 'GET', mode: 'cors' })
      .then(function (r) { if (!r.ok) throw new Error('down ' + r.status); return r.json(); })
      .then(parseCount);
  }

  function setStatus(msg, ok) {
    var el = document.getElementById('pollStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'poll-status ' + (ok ? 'ok' : 'warn');
  }

  function marketsFor(m) {
    return [
      {
        id: 'r', title: '胜平负',
        opts: [
          { v: 'H', label: '主胜' },
          { v: 'D', label: '平局' },
          { v: 'A', label: '客胜' }
        ]
      },
      {
        id: 'h', title: '让球',
        opts: [
          { v: 'HH', label: '让胜' },
          { v: 'HD', label: '让平' },
          { v: 'HA', label: '让负' }
        ]
      },
      {
        id: 'g', title: '总进球',
        opts: [
          { v: '0', label: '0球' },
          { v: '1', label: '1球' },
          { v: '2', label: '2球' },
          { v: '3', label: '3球' },
          { v: '4', label: '4球' },
          { v: '5p', label: '5+' }
        ]
      },
      {
        id: 's', title: '比分',
        opts: (m.scores || []).map(function (sc) {
          return { v: String(sc).replace(':', '-'), label: String(sc) };
        })
      }
    ];
  }

  function marketTotal(matchId, market, opts) {
    var t = 0;
    opts.forEach(function (o) {
      t += counts[ckey(matchId, market, o.v)] || 0;
    });
    return t;
  }

  function participants(matchId, m) {
    var r = marketsFor(m)[0];
    return marketTotal(matchId, 'r', r.opts);
  }

  function progress() {
    var done = 0;
    matches.forEach(function (m) {
      var id = matchKey(m);
      if (myVotes[id] && myVotes[id].r) done++;
    });
    return { done: done, total: matches.length };
  }

  function voteSummary(matchId) {
    var v = myVotes[matchId] || {};
    var parts = [];
    if (v.r === 'H') parts.push('主胜');
    if (v.r === 'D') parts.push('平局');
    if (v.r === 'A') parts.push('客胜');
    if (v.h === 'HH') parts.push('让胜');
    if (v.h === 'HD') parts.push('让平');
    if (v.h === 'HA') parts.push('让负');
    return parts.join(' · ');
  }

  function renderBars(matchId, mk) {
    var total = marketTotal(matchId, mk.id, mk.opts) || 0;
    var mine = (myVotes[matchId] || {})[mk.id];
    return mk.opts.map(function (o) {
      var n = counts[ckey(matchId, mk.id, o.v)] || 0;
      var pct = total ? Math.round(100 * n / total) : 0;
      var sel = mine === o.v ? ' selected' : '';
      return '<button type="button" class="poll-opt' + sel + '" data-match="' + matchId + '" data-market="' + mk.id + '" data-opt="' + o.v + '">' +
        '<div class="poll-opt-top"><span class="lab">' + o.label + '</span><span class="cnt"><b>' + n + '</b>·' + pct + '%</span></div>' +
        '<div class="poll-bar"><i style="width:' + pct + '%"></i></div>' +
        '</button>';
    }).join('');
  }

  function renderMatchSlot(m) {
    var id = matchKey(m);
    var slot = document.getElementById('poll-slot-' + id);
    if (!slot) return;
    var n = participants(id, m);
    var markets = marketsFor(m);
    var primary = markets.slice(0, 2);
    var extra = markets.slice(2);
    var primaryHtml = primary.map(function (mk) {
      return '<div class="poll-market"><div class="poll-m-title">' + mk.title +
        '<span class="poll-hint">模型：' + (mk.id === 'r' ? m.pick : m.hc) + '</span></div>' +
        '<div class="poll-opts">' + renderBars(id, mk) + '</div></div>';
    }).join('');
    var extraHtml = extra.map(function (mk) {
      return '<div class="poll-market"><div class="poll-m-title">' + mk.title + '</div>' +
        '<div class="poll-opts poll-opts-dense">' + renderBars(id, mk) + '</div></div>';
    }).join('');
    slot.innerHTML =
      '<div class="poll-inline-head">' +
        '<div><b>你的策略偏好</b><span>对照上方模型后再选 · 仅研究统计</span></div>' +
        '<div class="poll-meta">约 <b>' + n + '</b> 人已选胜平负</div>' +
      '</div>' +
      primaryHtml +
      '<details class="poll-more">' +
        '<summary>总进球与七比分（可选）</summary>' +
        extraHtml +
      '</details>';
  }

  function updateBadges() {
    matches.forEach(function (m) {
      var id = matchKey(m);
      var badge = document.querySelector('[data-poll-badge="' + id + '"]');
      if (!badge) return;
      var sum = voteSummary(id);
      if (sum) {
        badge.hidden = false;
        badge.textContent = '已选 ' + sum;
        badge.classList.add('on');
      } else {
        badge.hidden = true;
        badge.classList.remove('on');
      }
      var nav = document.querySelector('[data-jump="' + id + '"]');
      if (nav) nav.classList.toggle('voted', !!sum);
    });
    var prog = progress();
    var el = document.getElementById('pollProgress');
    if (el) {
      el.innerHTML = '已选胜平负 <b>' + prog.done + '</b> / ' + prog.total;
      el.classList.toggle('done', prog.total > 0 && prog.done === prog.total);
    }
    var fill = document.getElementById('pollProgressFill');
    if (fill && prog.total) {
      fill.style.width = Math.round(100 * prog.done / prog.total) + '%';
    }
  }

  function render() {
    if (!matches.length) {
      var dock = document.getElementById('todayDock');
      if (dock) dock.hidden = true;
      return;
    }
    var dockEl = document.getElementById('todayDock');
    if (dockEl) dockEl.hidden = false;
    matches.forEach(renderMatchSlot);
    updateBadges();
  }

  function castVote(matchId, market, opt) {
    if (!myVotes[matchId]) myVotes[matchId] = {};
    var prev = myVotes[matchId][market];
    if (prev === opt) return;

    var newKey = ckey(matchId, market, opt);
    var oldKey = prev ? ckey(matchId, market, prev) : null;

    myVotes[matchId][market] = opt;
    saveVotes();

    counts[newKey] = (counts[newKey] || 0) + 1;
    if (oldKey) counts[oldKey] = Math.max(0, (counts[oldKey] || 0) - 1);
    saveCounts();
    render();

    var chain = Promise.resolve();
    if (online) {
      if (oldKey) {
        chain = chain.then(function () {
          return apiDown(oldKey).then(function (v) { counts[oldKey] = Math.max(0, v); }).catch(function () { online = false; });
        });
      }
      chain = chain.then(function () {
        return apiUp(newKey).then(function (v) { counts[newKey] = v; saveCounts(); render(); })
          .catch(function () {
            online = false;
            setStatus('全局计数暂不可用，已保存本机选择。', false);
          });
      }).then(function () {
        if (online) setStatus('已同步 · 约每 20 秒刷新他人选择', true);
      });
    } else {
      setStatus('离线本机模式：选择已保存在本浏览器。', false);
    }
  }

  function keysForMatch(m) {
    var id = matchKey(m);
    var keys = [];
    marketsFor(m).forEach(function (mk) {
      mk.opts.forEach(function (o) {
        keys.push(ckey(id, mk.id, o.v));
      });
    });
    return keys;
  }

  function refreshMatch(m) {
    var keys = keysForMatch(m);
    var i = 0;
    function next() {
      if (i >= keys.length) { saveCounts(); render(); return Promise.resolve(); }
      var k = keys[i++];
      return apiGet(k).then(function (v) {
        counts[k] = v;
      }).catch(function () {
        online = false;
      }).then(next);
    }
    return next();
  }

  function rotateRefresh() {
    if (!matches.length) return;
    if (!online) {
      setStatus('离线本机模式：显示缓存人数与你的选择。', false);
      return;
    }
    var m = matches[rotateIdx % matches.length];
    rotateIdx++;
    refreshMatch(m).then(function () {
      if (online) setStatus('已连接 · 刷新「' + matchKey(m) + '」人数', true);
      else setStatus('全局计数暂不可用，已切本机缓存。', false);
    });
  }

  function warmStart() {
    if (!matches[0]) return;
    setStatus('正在拉取全局选择人数…', true);
    // warm first 3 matches for faster first paint
    var first = matches.slice(0, 3);
    var chain = Promise.resolve();
    first.forEach(function (m) {
      chain = chain.then(function () { return refreshMatch(m); });
    });
    chain.then(function () {
      if (online) setStatus('已连接全局计数 · 展开场次后可投票', true);
      else setStatus('无法连接全局计数，当前为本机模式。', false);
      render();
    });
  }

  function bindClicks() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.poll-opt');
      if (!btn || !btn.dataset.match) return;
      e.preventDefault();
      castVote(btn.dataset.match, btn.dataset.market, btn.dataset.opt);
    });
  }

  function refreshOpenMatch(matchId) {
    var m = findMatch(matchId);
    if (m) refreshMatch(m);
  }

  function init(list) {
    matches = list || [];
    loadLocal();
    bindClicks();
    render();
    warmStart();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(rotateRefresh, 20000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) rotateRefresh();
    });
  }

  window.MS_Poll = {
    init: init,
    refresh: rotateRefresh,
    refreshMatch: refreshOpenMatch,
    progress: progress,
    matchKey: matchKey
  };
})();
