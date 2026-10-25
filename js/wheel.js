/* Lucky Wheel — স্পিনের আগে বিজ্ঞাপন, ২৪ ঘণ্টায় ২টি স্পিন (section 6b) */

    // ====== সেটিংস ======
    const WHEEL_SLICES = [2, 4, 2, 6, 4, 2, 8, 4, 6, 10];   // চাকার ১০টি ঘর (পাশাপাশি একই অঙ্ক নেই)
    const WHEEL_PRIZES = [                                   // পুরস্কার ও সম্ভাবনা (মোট ১০০%)
      { v: 2, w: 50 },
      { v: 4, w: 30 },
      { v: 6, w: 13 },
      { v: 8, w: 6.5 },
      { v: 10, w: 0.5 }                                      // ২০০ স্পিনে গড়ে ১টি
    ];
    const WHEEL_COLORS = { 2: '#2563eb', 4: '#059669', 6: '#9333ea', 8: '#ea580c', 10: '#fbbf24' };
    const WHEEL_MAX_SPINS = 2;                               // প্রতি ২৪ ঘণ্টায় সর্বোচ্চ স্পিন
    const WHEEL_WINDOW_MS = 24 * 60 * 60 * 1000;             // প্রথম স্পিন থেকে ২৪ ঘণ্টা
    const WHEEL_SPIN_MS = 4800;                              // wheel.css-এর transition-এর সমান
    // =====================

    let wheelRotation = 0;
    let isWheelBusy = false;       // বিজ্ঞাপন চলছে বা রিওয়ার্ড লেখা হচ্ছে
    let isWheelSpinning = false;   // চাকা ঘুরছে
    let wheelBuilt = false;
    let wheelCountdownTimer = null;
    let wheelWatchdog = null;

    function wheelBn(n) {
      return String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
    }

    function wheelRandom() {
      try {
        const a = new Uint32Array(1);
        window.crypto.getRandomValues(a);
        return a[0] / 4294967296;
      } catch (e) {
        return Math.random();
      }
    }

    function pickWheelPrize() {
      const total = WHEEL_PRIZES.reduce((s, p) => s + p.w, 0);
      let r = wheelRandom() * total;
      for (const p of WHEEL_PRIZES) {
        if (r < p.w) return p.v;
        r -= p.w;
      }
      return WHEEL_PRIZES[0].v;
    }

    function getWheelState() {
      const u = currentUser || {};
      const now = serverNow();
      const start = Number(u.wheelWindowStart || 0);
      const active = start > 0 && (now - start) < WHEEL_WINDOW_MS;
      const used = active ? Number(u.wheelSpinsUsed || 0) : 0;
      return {
        used: used,
        left: Math.max(0, WHEEL_MAX_SPINS - used),
        resetAt: active ? start + WHEEL_WINDOW_MS : 0
      };
    }

    function buildWheel() {
      const disc = document.getElementById('wheelDisc');
      if (!disc || wheelBuilt) return;
      const step = 360 / WHEEL_SLICES.length;
      const stops = WHEEL_SLICES.map((v, i) => WHEEL_COLORS[v] + ' ' + (i * step) + 'deg ' + ((i + 1) * step) + 'deg');
      disc.style.background = 'conic-gradient(from 0deg, ' + stops.join(', ') + ')';
      WHEEL_SLICES.forEach((v, i) => {
        const el = document.createElement('span');
        el.className = 'wheel-label' + (v === 10 ? ' is-gold' : '');
        el.style.setProperty('--a', ((i + 0.5) * step) + 'deg');
        el.textContent = '৳' + v;   // ঘুরন্ত চাকায় ইংরেজি অঙ্কই বেশি স্পষ্ট পড়া যায়
        disc.appendChild(el);
      });
      wheelBuilt = true;
    }

    function wheelSetText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function formatWheelCountdown(ms) {
      const total = Math.max(0, Math.ceil(ms / 1000));
      const h = String(Math.floor(total / 3600)).padStart(2, '0');
      const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
      const s = String(total % 60).padStart(2, '0');
      return wheelBn(h + ':' + m + ':' + s);
    }

    function renderWheel() {
      buildWheel();
      if (isWheelSpinning) return;
      const btn = document.getElementById('wheelBtn');
      if (!btn) return;

      if (wheelCountdownTimer) {
        clearInterval(wheelCountdownTimer);
        wheelCountdownTimer = null;
      }

      if (!currentUser) {
        btn.disabled = true;
        btn.classList.add('is-wait');
        btn.innerHTML = '<i class="fa-solid fa-spinner"></i> লোড হচ্ছে...';
        return;
      }

      const st = getWheelState();
      wheelSetText('wheelLeft', wheelBn(st.left) + '/' + wheelBn(WHEEL_MAX_SPINS));
      wheelSetText('wheelTotal', wheelBn(Number(currentUser.wheelEarning || 0)));
      btn.classList.remove('is-wait');

      if (isWheelBusy || isWatchingAd) {
        btn.disabled = true;
        btn.classList.add('is-wait');
        btn.innerHTML = '<i class="fa-solid fa-spinner"></i> বিজ্ঞাপন চলছে...';
      } else if (st.left > 0) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> বিজ্ঞাপন দেখে স্পিন করুন (' + wheelBn(st.left) + 'টি বাকি)';
      } else {
        btn.disabled = true;
        btn.classList.add('is-wait');
        const tick = () => {
          const left = st.resetAt - serverNow();
          if (left <= 0) {
            clearInterval(wheelCountdownTimer);
            wheelCountdownTimer = null;
            renderWheel();
            return;
          }
          btn.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> পরের স্পিন ' + formatWheelCountdown(left) + ' পর';
        };
        tick();
        wheelCountdownTimer = setInterval(tick, 1000);
      }
    }

    function endWheelAttempt() {
      if (wheelWatchdog) {
        clearTimeout(wheelWatchdog);
        wheelWatchdog = null;
      }
      isWheelBusy = false;
      isWheelSpinning = false;
      finishWatching();   // ads.js: isWatchingAd = false এবং বিজ্ঞাপন বাটন রিফ্রেশ
      renderWheel();
    }

    function startWheelSpin() {
      if (isWheelBusy || isWheelSpinning || isWatchingAd) return;
      if (!currentUser || !currentUserId) return;

      const st = getWheelState();
      if (st.left <= 0) {
        showToast('আজকের স্পিন শেষ। পরের স্পিনের জন্য অপেক্ষা করুন।');
        return;
      }
      if (typeof window.show_11981233 !== 'function') {
        showToast('বিজ্ঞাপন লোড হয়নি, কিছুক্ষণ পর আবার চেষ্টা করুন।');
        return;
      }

      wheelSetText('wheelResult', '');
      isWheelBusy = true;
      isWatchingAd = true;   // একসঙ্গে দুটো বিজ্ঞাপন যেন না চলে
      renderWheel();
      renderAdHero();
      wheelWatchdog = setTimeout(endWheelAttempt, 120000);

      window.show_11981233().then(() => {
        awardWheelSpin();
      }).catch((err) => {
        console.warn('Wheel ad error:', err);
        endWheelAttempt();
        showToast('বিজ্ঞাপন দেখানো যায়নি, আবার চেষ্টা করুন।');
      });
    }

    function awardWheelSpin() {
      if (wheelWatchdog) {
        clearTimeout(wheelWatchdog);
        wheelWatchdog = null;
      }
      if (!currentUser || !currentUserId) {
        endWheelAttempt();
        return;
      }

      const prize = pickWheelPrize();
      let result = 'none';

      db.ref('users/' + currentUserId).transaction((data) => {
        result = 'none';
        if (data) {
          const now = serverNow();
          let used = Number(data.wheelSpinsUsed || 0);
          let start = Number(data.wheelWindowStart || 0);
          if (!start || (now - start) >= WHEEL_WINDOW_MS) {   // নতুন ২৪ ঘণ্টার জানালা
            used = 0;
            start = now;
          }
          if (used >= WHEEL_MAX_SPINS) {
            result = 'limit';
            return data;
          }
          data.wheelSpinsUsed = used + 1;
          data.wheelWindowStart = start;
          data.lastWheelPrize = prize;
          data.wheelEarning = (Number(data.wheelEarning) || 0) + prize;
          data.bonusEarning = (Number(data.bonusEarning) || 0) + prize;
          data.balance = (Number(data.balance) || 0) + prize;
          result = 'ok';
        }
        return data;
      }, (error, committed) => {
        if (committed && result === 'ok') {
          animateWheelTo(prize);
        } else {
          endWheelAttempt();
          showToast(committed && result === 'limit'
            ? 'আজকের স্পিন শেষ।'
            : 'স্পিন রিওয়ার্ড যোগ করতে সমস্যা হয়েছে, পুনরায় চেষ্টা করুন।');
        }
      });
    }

    function animateWheelTo(prize) {
      const disc = document.getElementById('wheelDisc');
      if (!disc) {
        endWheelAttempt();
        return;
      }
      isWheelSpinning = true;

      const step = 360 / WHEEL_SLICES.length;
      const candidates = [];
      WHEEL_SLICES.forEach((v, i) => { if (v === prize) candidates.push(i); });
      const idx = candidates[Math.floor(wheelRandom() * candidates.length)];
      const jitter = (wheelRandom() - 0.5) * (step * 0.55);   // ঘরের ভেতরেই থামবে
      const target = ((360 - (idx + 0.5) * step + jitter) % 360 + 360) % 360;
      const current = ((wheelRotation % 360) + 360) % 360;
      const delta = (target - current + 360) % 360;
      wheelRotation += 360 * 5 + delta;
      disc.style.transform = 'rotate(' + wheelRotation + 'deg)';
      try { tg?.HapticFeedback?.impactOccurred?.('medium'); } catch (e) { /* ignore */ }

      setTimeout(() => {
        isWheelSpinning = false;
        isWheelBusy = false;
        wheelSetText('wheelResult', '🎉 অভিনন্দন! আপনি ৳' + wheelBn(prize) + ' জিতেছেন');
        showToast('লাকি হুইল থেকে ' + wheelBn(prize) + ' টাকা ব্যালেন্সে যোগ হয়েছে।');
        try { tg?.HapticFeedback?.notificationOccurred?.('success'); } catch (e) { /* ignore */ }
        endWheelAttempt();
      }, WHEEL_SPIN_MS + 150);
    }

    document.addEventListener('DOMContentLoaded', buildWheel);
