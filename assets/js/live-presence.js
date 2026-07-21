/* MatchStruct — live visitor presence (approx concurrent browsers)
 * Join: +1 when first tab of this browser opens. Leave: -1 when last tab closes.
 * Counts synced via CounterAPI; drifts possible if browser crashes without unload.
 */
(function () {
  var NS = 'matchstructkf';
  var API = 'https://api.counterapi.dev/v1/' + NS + '/';
  var TAB_KEY = 'ms_live_tabs_v1';
  var JOINED_KEY = 'ms_live_joined_v1';
  var timer = null;
  var left = false;
  var online = true;
  var live = 0;
  var views = 0;

  function dayKey() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return '' + y + m + day;
  }
  function liveKey() { return 'online_' + dayKey(); }
  function viewKey() { return 'views_' + dayKey(); }

  function parseCount(j) {
    if (j == null) return 0;
    if (typeof j === 'number') return j;
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
      .then(parseCount);
  }
  function apiUp(name, keepalive) {
    return fetch(API + encodeURIComponent(name) + '/up', {
      method: 'GET', mode: 'cors', keepalive: !!keepalive
    }).then(function (r) {
      if (!r.ok) throw new Error('up ' + r.status);
      return r.json();
    }).then(parseCount);
  }
  function apiDown(name, keepalive) {
    return fetch(API + encodeURIComponent(name) + '/down', {
      method: 'GET', mode: 'cors', keepalive: !!keepalive
    }).then(function (r) {
      if (!r.ok) throw new Error('down ' + r.status);
      return r.json();
    }).then(parseCount);
  }

  function tabCount(delta) {
    var n = Number(localStorage.getItem(TAB_KEY) || 0) + delta;
    if (n < 0) n = 0;
    localStorage.setItem(TAB_KEY, String(n));
    return n;
  }

  function paint() {
    var liveEl = document.getElementById('liveCount');
    var viewEl = document.getElementById('viewCount');
    if (liveEl) liveEl.textContent = String(Math.max(1, live || 1));
    if (viewEl) viewEl.textContent = String(Math.max(views, live, 1));
    var wrap = document.getElementById('livePill');
    if (wrap) {
      wrap.classList.toggle('is-offline', !online);
      wrap.title = online
        ? '近实时在线人数（按打开中的浏览器估算；异常关闭可能导致短暂偏差）'
        : '计数服务暂不可用，显示本机估算';
    }
  }

  function refresh() {
    return Promise.all([apiGet(liveKey()), apiGet(viewKey())]).then(function (arr) {
      online = true;
      live = Math.max(0, arr[0]);
      views = Math.max(0, arr[1]);
      // Never show 0 while this page is open
      if (live < 1) live = 1;
      paint();
    }).catch(function () {
      online = false;
      if (live < 1) live = 1;
      paint();
    });
  }

  function join() {
    var tabs = tabCount(1);
    if (tabs !== 1) {
      // another tab already representing this browser
      refresh();
      return Promise.resolve();
    }
    sessionStorage.setItem(JOINED_KEY, '1');
    return apiUp(liveKey()).then(function (v) {
      live = Math.max(1, v);
      return apiUp(viewKey());
    }).then(function (v) {
      views = Math.max(1, v);
      online = true;
      paint();
    }).catch(function () {
      online = false;
      live = Math.max(live, 1);
      views = Math.max(views, 1);
      paint();
    });
  }

  function leave() {
    if (left) return;
    var tabs = tabCount(-1);
    if (tabs > 0) return; // other tabs still open
    if (sessionStorage.getItem(JOINED_KEY) !== '1') return;
    left = true;
    sessionStorage.removeItem(JOINED_KEY);
    // keepalive so request survives page close
    apiDown(liveKey(), true).catch(function () {});
  }

  function init() {
    paint();
    join().then(refresh);
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 12000);
    window.addEventListener('pagehide', leave);
    window.addEventListener('beforeunload', leave);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh();
    });
  }

  window.MS_Live = { init: init, refresh: refresh };
})();
