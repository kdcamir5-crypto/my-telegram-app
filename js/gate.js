/* Force-join gate: 4 channels/groups (checked via Cloudflare Worker) */

const GATE_CONFIG = {
  workerUrl: 'https://freelancing-gate.kdcamir5.workers.dev/',
  appName: 'FREELANCING WITH MINI APP',
  logoUrl: 'img/logo.png',
  trustMinutes: 10,      // সফল চেকের পর এত মিনিট অ্যাপ সঙ্গে সঙ্গে খুলবে, চেক ব্যাকগ্রাউন্ডে হবে
  timeoutMs: 8000,       // Worker এর উত্তরের জন্য সর্বোচ্চ অপেক্ষা (এরপর আবার চেষ্টা)
  items: [
    { key: 'c1', color: 'teal',   icon: 'fa-bullhorn',           title: 'Official Channel',        label: 'Official Channel',        url: 'https://t.me/bechelor_point_season' },
    { key: 'c2', color: 'purple', icon: 'fa-money-check-dollar', title: 'Payment Channel',         label: 'Payment Channel',         url: 'https://t.me/ALLSEASONBC' },
    { key: 'c3', color: 'orange', icon: 'fa-users',              title: 'Community Channel',       label: 'Community Channel',       url: 'https://t.me/community_freelancing' },
    { key: 'c4', color: 'pink',   icon: 'fa-receipt',            title: 'Community Payment Proof', label: 'Community Payment Proof', url: 'https://t.me/communitytask_payment' }
  ]
};

let gatePassed = false;
let gateLastCheck = 0;
const GATE_LS_KEY = 'gate_ok_at';

function gateBuild() {
  if (document.getElementById('gate-overlay')) return;
  const rows = GATE_CONFIG.items.map(it => `
      <button class="gate-btn gate-join gate-${it.color}" id="gate-join-${it.key}">
        <i class="fa-solid ${it.icon}"></i><span>${it.label}</span><i class="fa-solid fa-circle-check gate-tick"></i>
      </button>
      <div class="gate-err" id="gate-err-${it.key}">You have not joined the ${it.title}</div>`).join('');

  const el = document.createElement('div');
  el.id = 'gate-overlay';
  el.className = 'gate-checking';
  el.innerHTML = `
    <div class="gate-spin"></div>
    <div class="gate-card">
      <img class="gate-logo" src="${GATE_CONFIG.logoUrl}" alt="">
      <div class="gate-title">${GATE_CONFIG.appName}</div>
      <p class="gate-text">🤝 <b>Welcome!</b> Earn money by completing small tasks in this app — easy, fast, real income 😎</p>
      <p class="gate-text">▶ Join the channels below to get started, then tap <b>Verify</b>.</p>
      ${rows}
      <button class="gate-btn gate-verify" id="gate-verify"><i class="fa-solid fa-check"></i><span>Verify</span></button>
      <div class="gate-msg" id="gate-msg"></div>
      <p class="gate-note">Verify will not work unless you join. If you leave, this notice will appear again.</p>
    </div>`;
  document.body.appendChild(el);

  const open = (url) => {
    if (tg && tg.openTelegramLink && url.startsWith('https://t.me/')) tg.openTelegramLink(url);
    else window.open(url, '_blank');
  };
  GATE_CONFIG.items.forEach(it => {
    document.getElementById('gate-join-' + it.key).onclick = () => open(it.url);
  });
  document.getElementById('gate-verify').onclick = () => gateVerify(true);
}

/* তিনটা অবস্থা: ঢাকা (শুধু লোডিং স্পিনার) → কার্ড দেখানো → পুরো লুকানো */
function gateCover()    { const e = document.getElementById('gate-overlay'); if (e) { e.style.display = 'flex'; e.classList.add('gate-checking'); } }
function gateShowCard() { const e = document.getElementById('gate-overlay'); if (e) { e.style.display = 'flex'; e.classList.remove('gate-checking'); } }
function gateHide()     { const e = document.getElementById('gate-overlay'); if (e) { e.style.display = 'none'; } }

function gateSetMsg(text) {
  const m = document.getElementById('gate-msg');
  if (m) m.textContent = text || '';
}

function gateSetStatus(res) {
  GATE_CONFIG.items.forEach(it => {
    const joined = !!(res.results && res.results[it.key]);
    document.getElementById('gate-err-' + it.key).style.display = joined ? 'none' : 'block';
    document.getElementById('gate-join-' + it.key).classList.toggle('joined', joined);
  });
}

function gateTrusted() {
  try {
    const t = Number(localStorage.getItem(GATE_LS_KEY) || 0);
    return t && (Date.now() - t) < GATE_CONFIG.trustMinutes * 60000;
  } catch (e) { return false; }
}
function gateRemember(ok) {
  try { ok ? localStorage.setItem(GATE_LS_KEY, String(Date.now())) : localStorage.removeItem(GATE_LS_KEY); } catch (e) {}
}

/* preflight ছাড়া (text/plain) + টাইমআউট + ১ বার আবার চেষ্টা */
async function gateCheck() {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GATE_CONFIG.timeoutMs);
    try {
      const r = await fetch(GATE_CONFIG.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ initData: tg.initData }),
        signal: ctrl.signal
      });
      return await r.json();
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

async function gateVerify(manual) {
  const btn = document.getElementById('gate-verify');
  if (manual) { btn.disabled = true; gateSetMsg('Checking...'); }
  try {
    const res = await gateCheck();
    gateLastCheck = Date.now();
    if (res.error) { gateShowCard(); gateSetMsg('Could not verify. Please try again.'); return; }
    gateSetStatus(res);
    if (res.ok) {
      gateRemember(true);
      gateSetMsg('');
      gateHide();
      if (!gatePassed) { gatePassed = true; initializeUserAccount(); }
    } else {
      gateRemember(false);
      gateShowCard();
      gateSetMsg(manual ? 'Please join all channels first, then tap Verify.' : '');
    }
  } catch (e) {
    gateShowCard();
    gateSetMsg('Network problem. Please tap Verify to try again.');
  } finally {
    btn.disabled = false;
  }
}

function startGate() {
  gateBuild();
  if (!tg || !tg.initData) {
    gateShowCard();
    gateSetMsg('Please open this app from Telegram.');
    document.getElementById('gate-verify').style.display = 'none';
    return;
  }

  // Firebase কানেকশন আগেভাগে গরম করে রাখা (চেকের সময়ই কানেক্ট হতে থাকবে)
  try { db.ref('.info/connected').once('value'); } catch (e) {}

  if (gateTrusted()) {
    // সম্প্রতি চেক পাস করেছে: অ্যাপ সঙ্গে সঙ্গে খুলবে, চেক চলবে ব্যাকগ্রাউন্ডে
    gateHide();
    gatePassed = true;
    initializeUserAccount();
    gateVerify(false);
  } else {
    gateCover();          // শুধু স্পিনার, কার্ড নয় (ঝিলিক বন্ধ)
    gateVerify(false);
  }

  // ইউজার চ্যানেল ছেড়ে অ্যাপে ফিরে এলে আবার চেক (১৫ সেকেন্ডে একবার)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && gatePassed && Date.now() - gateLastCheck > 15000) {
      gateVerify(false);
    }
  });
}
