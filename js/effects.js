/* Dynamic effects: তারা, রশ্মি, ঝলক, ভাসমান আলো — ফোন ধীর হলে নিজে থেকে হালকা/বন্ধ হয়ে যায় */
(function () {
  // ====== সেটিংস ======
  // 'auto' = ফোন বুঝে নিজে ঠিক করবে (সুপারিশ), 'full' = সব এফেক্ট, 'lite' = হালকা, 'off' = বন্ধ
  var FX_LEVEL = 'auto';
  // =====================

  var root = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  function applyLevel(level) {
    root.classList.remove('fx-lite', 'fx-off');
    if (level === 'lite') root.classList.add('fx-lite');
    if (level === 'off') root.classList.add('fx-off');
    root.setAttribute('data-fx', level);
  }

  function pickStartLevel() {
    if (FX_LEVEL !== 'auto') return FX_LEVEL;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return 'off';
    var saved = store.get('fxLevel');          // আগের বার ফোন যতটা টানতে পেরেছিল
    if (saved === 'off' || saved === 'lite') return saved;
    var mem = navigator.deviceMemory || 4;
    var cores = navigator.hardwareConcurrency || 4;
    if (mem <= 2 || cores <= 4) return 'lite';
    return 'full';
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function buildStars(cls, count, w, h, colors) {
    var el = document.createElement('i');
    el.className = 'fx-stars ' + cls;
    var shadows = [];
    for (var i = 0; i < count; i++) {
      shadows.push(Math.round(rand(0, w)) + 'px ' + Math.round(rand(0, h)) + 'px 0 0 ' + colors[i % colors.length]);
    }
    el.style.boxShadow = shadows.join(',');
    return el;
  }

  function buildLayer() {
    if (document.getElementById('fx-layer')) return;
    var layer = document.createElement('div');
    layer.id = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');

    var w = Math.min(window.innerWidth || 400, 480);
    var h = window.innerHeight || 800;
    var colors = ['#ffffff', '#cfe6ff', '#9fd0ff', '#ffffff', '#ffe9a8'];

    layer.appendChild(buildStars('s1', 30, w, h, colors));
    layer.appendChild(buildStars('s2', 18, w, h, colors));
    layer.appendChild(buildStars('s3', 9, w, h, colors));

    var b1 = document.createElement('i'); b1.className = 'fx-beam b1'; layer.appendChild(b1);
    var b2 = document.createElement('i'); b2.className = 'fx-beam b2'; layer.appendChild(b2);

    var orbColors = [
      'rgba(90,170,255,0.55)', 'rgba(0,209,143,0.45)', 'rgba(168,85,247,0.45)',
      'rgba(251,191,36,0.40)', 'rgba(120,200,255,0.50)', 'rgba(0,209,143,0.40)'
    ];
    for (var i = 0; i < 6; i++) {
      var o = document.createElement('i');
      var size = Math.round(rand(46, 110));
      o.className = 'fx-orb';
      o.style.width = size + 'px';
      o.style.height = size + 'px';
      o.style.left = Math.round(rand(0, 92)) + '%';
      o.style.background = 'radial-gradient(circle, ' + orbColors[i] + ' 0%, rgba(255,255,255,0) 68%)';
      o.style.animationDuration = Math.round(rand(20, 34)) + 's';
      o.style.animationDelay = '-' + Math.round(rand(0, 30)) + 's';
      o.style.setProperty('--fx-sway', Math.round(rand(-40, 40)) + 'px');
      layer.appendChild(o);
    }

    for (var j = 0; j < 6; j++) {
      var s = document.createElement('i');
      s.className = 'fx-spark';
      s.style.left = Math.round(rand(4, 92)) + '%';
      s.style.top = Math.round(rand(6, 88)) + '%';
      s.style.animationDelay = '-' + (j * 0.9 + rand(0, 1.5)).toFixed(1) + 's';
      s.style.animationDuration = rand(4.2, 6.5).toFixed(1) + 's';
      layer.appendChild(s);
    }
    document.body.insertBefore(layer, document.body.firstChild);
  }

  // কার্ডের ওপর ঝলক বসানো
  var SHINE_TARGETS = [
    ['.ahero-card', false], ['.wallet-hero', false], ['.earning-summary-hero', false],
    ['.profile-card', false], ['.referral-box-card', false], ['.feature-card', false],
    ['.stat-mini-card', false], ['.tcard', true]
  ];
  function addShine() {
    var d = 0;
    SHINE_TARGETS.forEach(function (t) {
      var nodes = document.querySelectorAll(t[0]);
      for (var i = 0; i < nodes.length; i++) {
        var host = nodes[i];
        if (host.querySelector(':scope > .fx-shine')) continue;
        if (getComputedStyle(host).position === 'static') host.classList.add('fx-host');
        var sh = document.createElement('span');
        sh.className = 'fx-shine' + (t[1] ? ' on-light' : '');
        sh.style.setProperty('--fx-d', (d % 7 * 0.8).toFixed(1) + 's');
        host.appendChild(sh);
        d++;
      }
    });
  }

  // ফোন কতটা টানতে পারছে মাপা: ধীর হলে এফেক্ট কমানো
  function watchPerformance(level) {
    if (FX_LEVEL !== 'auto' || level === 'off') return;
    function measure(ms, done) {
      var frames = 0, start = 0;
      function tick(t) {
        if (!start) start = t;
        frames++;
        if (t - start < ms) requestAnimationFrame(tick);
        else done(frames * 1000 / (t - start));
      }
      requestAnimationFrame(tick);
    }
    function check(current, attempt) {
      if (document.hidden) { setTimeout(function () { check(current, attempt); }, 3000); return; }
      measure(2000, function (fps) {
        var next = current;
        if (current === 'full' && fps < 38) next = 'lite';
        else if (current === 'lite' && fps < 26) next = 'off';
        if (next !== current) {
          applyLevel(next);
          store.set('fxLevel', next);
          current = next;
        }
        if (attempt < 2 && current !== 'off') setTimeout(function () { check(current, attempt + 1); }, 2500);
      });
    }
    setTimeout(function () { check(level, 0); }, 3500); // অ্যাপ লোড শেষ হওয়ার পর মাপা শুরু
  }

  function init() {
    var level = pickStartLevel();
    buildLayer();
    addShine();
    applyLevel(level);
    watchPerformance(level);
    document.addEventListener('visibilitychange', function () {
      root.classList.toggle('fx-paused', document.hidden);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
