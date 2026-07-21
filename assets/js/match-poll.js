/* MatchStruct — visitor strategy poll for today's matches (research demo, not betting advice)
 * Global counts: CounterAPI v1 (public). Falls back to local-only if network fails.
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
  var counts = {}; // key -> number
  var myVotes = {}; // matchId -> { r,h,g,s }

  function dayKey() {
    var t = (matches[0] && matches[0].time) || '';
    var m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + m[2] + m[3];
    // batch key when times are labels like「晚」— avoid colliding with older polls
    var d0 = matches[0] && matches[0].day;
    return d0 ? ('batch_' + d0 + '_' + matches.length) : 'day';
  }
  function matchKey(m) {
    return String(m.day || '') + String(m.id);
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
        id: 'h', title: '让球胜平负',
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
          { v: '5p', label: '5+球' }
        ]
      },
      {
        id: 's', title: '比分（七比分池）',
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
    var set = {};
    marketsFor(m).forEach(function (mk) {
      mk.opts.forEach(function (o) {
        var n = counts[ckey(matchId, mk.id, o.v)] || 0;
        // approximate unique voters ~ max market total
        set[mk.id] = Math.max(set[mk.id] || 0, n);
      });
    });
    var max = 0;
    Object.keys(set).forEach(function (k) { if (set[k] > max) max = set[k]; });
    // better: sum of result market
    var r = marketsFor(m)[0];
    return marketTotal(matchId, 'r', r.opts);
  }

  function renderBars(matchId, mk) {
    var total = marketTotal(matchId, mk.id, mk.opts) || 0;
    var mine = (myVotes[matchId] || {})[mk.id];
    return mk.opts.map(function (o) {
      var n = counts[ckey(matchId, mk.id, o.v)] || 0;
      var pct = total ? Math.round(100 * n / total) : 0;
      var sel = mine === o.v ? ' selected' : '';
      return '<button type="button" class="poll-opt' + sel + '" data-match="' + matchId + '" data-market="' + mk.id + '" data-opt="' + o.v + '">' +
        '<div class="poll-opt-top"><span class="lab">' + o.label + '</span><span class="cnt"><b>' + n + '</b>人 · ' + pct + '%</span></div>' +
        '<div class="poll-bar"><i style="width:' + pct + '%"></i></div>' +
        '</button>';
    }).join('');
  }

  function render() {
    var root = document.getElementById('pollBoard');
    if (!root) return;
    root.innerHTML = matches.map(function (m) {
      var id = matchKey(m);
      var n = participants(id, m);
      var mkHtml = marketsFor(m).map(function (mk) {
        return '<div class="poll-market"><div class="poll-m-title">' + mk.title + '</div><div class="poll-opts">' + renderBars(id, mk) + '</div></div>';
      }).join('');
      return '<article class="poll-card" data-id="' + id + '">' +
        '<div class="poll-head">' +
          '<div><b>' + id + ' · ' + m.league + '</b><span>' + m.home + ' vs ' + m.away + '</span></div>' +
          '<div class="poll-meta">约 <b>' + n + '</b> 人已选胜平负 · 模型参考 ' + m.pick + '</div>' +
        '</div>' + mkHtml + '</article>';
    }).join('');

    root.querySelectorAll('.poll-opt').forEach(function (btn) {
      btn.onclick = function () {
        castVote(btn.dataset.match, btn.dataset.market, btn.dataset.opt);
      };
    });
  }

  function castVote(matchId, market, opt) {
    if (!myVotes[matchId]) myVotes[matchId] = {};
    var prev = myVotes[matchId][market];
    if (prev === opt) return; // already selected

    var newKey = ckey(matchId, market, opt);
    var oldKey = prev ? ckey(matchId, market, prev) : null;

    myVotes[matchId][market] = opt;
    saveVotes();

    // optimistic
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
            setStatus('全局计数暂不可用，已保存你的本机选择；联网后将继续同步人数。', false);
          });
      }).then(function () {
        if (online) setStatus('已同步到全局计数 · 约每 20 秒刷新他人选择', true);
      });
    } else {
      setStatus('离线本机模式：只保存你的选择；全局人数需联网后显示。', false);
    }
  }

  function keysForMatch(m) {
    var keys = [];
    marketsFor(m).forEach(function (mk) {
      mk.opts.forEach(function (o) {
        keys.push(ckey(m.id, mk.id, o.v));
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
      if (online) setStatus('已连接全局计数 · 正在轮询刷新「' + matchKey(m) + '」人数', true);
      else setStatus('全局计数暂不可用，已切换本机缓存。', false);
    });
  }

  function warmStart() {
    // Refresh first match quickly for immediate feedback
    if (!matches[0]) return;
    setStatus('正在拉取全局选择人数…', true);
    refreshMatch(matches[0]).then(function () {
      if (online) setStatus('已连接全局计数 · 选择后实时计入，并定期刷新他人选择', true);
      else setStatus('无法连接全局计数，当前为本机模式（选择仍会保存在本浏览器）。', false);
      render();
    });
  }

  function init(list) {
    matches = list || [];
    loadLocal();
    render();
    warmStart();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(rotateRefresh, 20000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) rotateRefresh();
    });
  }

  window.MS_Poll = { init: init, refresh: rotateRefresh };
})();
