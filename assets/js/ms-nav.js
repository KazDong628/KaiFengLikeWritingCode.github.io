(function () {
  var parts = location.pathname.split('/').filter(Boolean);
  var BASE = parts[0] === 'KaiFengLikeWritingCode.github.io' ? '/KaiFengLikeWritingCode.github.io' : '';
  function abs(path) {
    if (!path || path === './') return BASE ? (BASE + '/') : './';
    return BASE + '/' + String(path).replace(/^\//, '');
  }

  document.querySelectorAll('[data-link]').forEach(function (a) {
    a.setAttribute('href', abs(a.getAttribute('data-link')));
  });

  var switcher = document.getElementById('productSwitch');
  if (switcher) {
    var file = (parts[parts.length - 1] || '').toLowerCase();
    var cur = 'football';
    if (file.indexOf('worldcup') >= 0) cur = 'worldcup';
    else if (file.indexOf('qixingcai') >= 0) cur = 'qixing';
    else if (file.indexOf('dlt') >= 0) cur = 'dlt';
    else if (!file || file === 'index.html' || file.indexOf('football') >= 0) cur = 'football';

    var items = [
      { id: 'football', href: './', k: 'LIVE', t: '竞彩足球', s: '复盘研究台 · 已上线演示' },
      { id: 'worldcup', href: 'worldcup86.html', k: 'ARCHIVE', t: '世界杯86场', s: '七比分官方复盘 · 已归档' },
      { id: 'qixing', href: 'qixingcai.html', k: 'LAB', t: '七星彩', s: '待开发 · 待验证' },
      { id: 'dlt', href: 'dlt.html', k: 'LAB', t: '超级大乐透', s: '待开发 · 待验证' }
    ];
    switcher.style.gridTemplateColumns = 'repeat(' + items.length + ', minmax(0, 1fr))';
    switcher.innerHTML = items.map(function (it) {
      return '<a class="' + (it.id === cur ? 'active' : '') + '" href="' + abs(it.href) + '">' +
        '<div class="k">' + it.k + '</div><div class="t">' + it.t + '</div><div class="s">' + it.s + '</div></a>';
    }).join('');
  }
})();
