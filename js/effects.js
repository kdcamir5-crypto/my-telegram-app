/* Dynamic effects: তারা, রশ্মি, ঝলক, ভাসমান আলো
   চার স্তর: full (সব) → mid (সাধারণ ফোন, কম এফেক্ট) → lite (হালকা) → off (বন্ধ)
   'auto' মোডে ফোন বুঝে নিজে ঠিক করে, ধীর হলে ধাপে ধাপে কমায়। */
(function () {
  // ====== সেটিংস ======
  // 'auto' = ফোন বুঝে নিজে ঠিক করবে (সুপারিশ)
  // 'full' = সব এফেক্ট, 'mid' = মাঝারি, 'lite' = হালকা, 'off' = বন্ধ
  var FX_LEVEL = 'auto';
  // =====================

  var root = document.documentElement;

  // প্রতিটি স্তরে কতগুলো উপাদান থাকবে
  var PROFILE = {
    full: { s1: 30, s2: 18, s3: 9, beams: true,  orbs: 6, sparks: 6, shine: 'all'  },
    mid:  { s1: 14, s2: 8,  s3: 3, beams: false, orbs: 3, sparks: 3, shine: 'main' },
    lite: { s1: 10, s2: 5,  s3: 0, beams: false, orbs: 0, sparks: 0, shine: 'none' },
    off:  { s1: 0,  s2: 0,  s3: 0, beams: false, orbs: 0, sparks: 0, shine: 'none' }
  };

  var ORDER = ['full', 'mid', 'lite', 'off'];
  var currentLevel = 'mid';

  function rand(a, b) { return a + Math.random() * (b - a); }

  function applyLevelClass(level) {
    root.classList.remove('fx-mid', 'fx-lite', 'fx-off');
    if (level === 'mid') root.classList.add('fx-mid');
    if (level === 'lite') root.classList.add('fx-lite');
    if (level === 'off') root.classList.add('fx-off');
    root.setAttribute('data-fx', level);
  }

  function pickStartLevel() {
    if (FX_LEVEL !== 'auto') return FX_LEVEL;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return 'off';
    var mem = navigator.deviceMemory || 4;
    var cores = navigator.hardwareConcurrency || 4;
    if (mem <= 2 || cores <= 2) return 'lite';
    if (mem >= 8 && cores >= 8) return 'full';
    return 'mid';
  }

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

  function buildLayer(level) {
    var old = document.getElementById('fx-layer');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var p = PROFILE[level] || PROFILE.mid;
    var layer = document.createElement('div');
    layer.id = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');

    var w = Math.min(window.innerWidth || 400, 480);
    var h = window.innerHeight || 800;
    var colors = ['#ffffff', '#cfe6ff', '#9fd0ff', '#ffffff', '#ffe9a8'];

    if (p.s1 > 0) layer.appendChild(buildStars('s1', p.s1, w, h, colors));
    if (p.s2 > 0) layer.appendChild(buildStars('s2', p.s2, w, h, colors));
    if (p.s3 > 0) layer.appendChild(buildStars('s3', p.s3, w, h, colors));

    if (p.beams) {
      var b1 = document.createElement('i'); b1.className = 'fx-beam b1'; layer.appendChild(b1);
      var b2 = document.createElement('i'); b2.className = 'fx-beam b2'; layer.appendChild(b2);
    }

    var orbColors = [
      'rgba(90,170,255,0.55)', 'rgba(0,209,143,0.45)', 'rgba(168,85,247,0.45)',
      'rgba(251,191,36,0.40)', 'rgba(120,200,255,0.50)', 'rgba(0,209,143,0.40)'
    ];
    for (var i = 0; i < p.orbs; i++) {
      var o = document.createElement('i');
      var size = Math.round(rand(46, 110));
      o.className = 'fx-orb';
      o.style.width = size + 'px';
      o.style.height = size + 'px';
      o.style.left = Math.round(rand(0, 92)) + '%';
      o.style.background = 'radial-gradient(circle, ' + orbColors[i % orbColors.length] + ' 0%, rgba(255,255,255,0) 68%)';
      o.style.animationDuration = Math.round(rand(20, 34)) + 's';
      o.style.animationDelay = '-' + Math.round(rand(0, 30)) + 's';
      o.style.setProperty('--fx-sway', Math.round(rand(-40, 40)) + 'px');
      layer.appendChild(o);
    }

    for (var j = 0; j < p.sparks; j++) {
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

  // কার্ডের ওপর ঝলক বসানো: full এ সব কার্ডে, mid এ শুধু মূল কার্ডে, বাকি স্তরে কোথাও না
  var SHINE_ALL = [
    ['.ahero-card', false], ['.wallet-hero', false], ['.earning-summary-hero', false],
    ['.profile-card', false], ['.referral-box-card', false], ['.feature-card', false],
    ['.stat-mini-card', false], ['.tcard', true]
  ];
  var SHINE_MAIN = [
    ['.ahero-card', false], ['.wallet-hero', false], ['.earning-summary-hero', false]
  ];

  function removeShines() {
    var old = document.querySelectorAll('.fx-shine');
    for (var i = 0; i < old.length; i++) {
      if (old[i].parentNode) old[i].parentNode.removeChild(old[i]);
    }
  }

  function addShine(level) {
    removeShines();
    var mode = (PROFILE[level] || PROFILE.mid).shine;
    if (mode === 'none') return;
    var targets = mode === 'all' ? SHINE_ALL : SHINE_MAIN;
    var d = 0;
    targets.forEach(function (t) {
      var nodes = document.querySelectorAll(t[0]);
      for (var i = 0; i < nodes.length; i++) {
        var host = nodes[i];
        if (getComputedStyle(host).position === 'static') host.classList.add('fx-host');
        var sh = document.createElement('span');
        sh.className = 'fx-shine' + (t[1] ? ' on-light' : '');
        sh.style.setProperty('--fx-d', (d % 7 * 0.8).toFixed(1) + 's');
        host.appendChild(sh);
        d++;
      }
    });
  }

  function setLevel(level) {
    currentLevel = level;
    applyLevelClass(level);
    buildLayer(level);
    addShine(level);
  }

  // ফোন কতটা টানতে পারছে মাপা: ধীর হলে এক ধাপ নামানো (শুধু 'auto' মোডে, সেভ করা হয় না)
  function watchPerformance() {
    if (FX_LEVEL !== 'auto' || currentLevel === 'off') return;
    var MIN_FPS = { full: 32, mid: 24, lite: 15 };

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

    function check(attempt) {
      if (document.hidden || root.classList.contains('fx-modal')) {
        setTimeout(function () { check(attempt); }, 3000);
        return;
      }
      measure(2000, function (fps) {
        var min = MIN_FPS[currentLevel];
        if (min && fps < min) {
          var next = ORDER[ORDER.indexOf(currentLevel) + 1];
          if (next) setLevel(next);
        }
        if (attempt < 2 && currentLevel !== 'off') {
          setTimeout(function () { check(attempt + 1); }, 2500);
        }
      });
    }
    setTimeout(function () { check(0); }, 5000); // অ্যাপ পুরো লোড হওয়ার পর মাপা শুরু
  }

  // পপআপ খোলা থাকলে পেছনের অ্যানিমেশন থামানো (ব্যাটারি ও ফোন বাঁচে)
  function watchModals() {
    var modals = document.querySelectorAll('.modal-overlay');
    if (!modals.length || !window.MutationObserver) return;
    function update() {
      root.classList.toggle('fx-modal', !!document.querySelector('.modal-overlay.show'));
    }
    var obs = new MutationObserver(update);
    for (var i = 0; i < modals.length; i++) {
      obs.observe(modals[i], { attributes: true, attributeFilter: ['class', 'style'] });
    }
    update();
  }

  function init() {
    setLevel(pickStartLevel());
    watchModals();
    watchPerformance();
    document.addEventListener('visibilitychange', function () {
      root.classList.toggle('fx-paused', document.hidden);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
