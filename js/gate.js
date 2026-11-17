/* Force-join gate: 4 channels/groups (checked via Cloudflare Worker) */

const GATE_CONFIG = {
  workerUrl: 'https://freelancing-gate.kdcamir5.workers.dev/',
  bannerUrl: 'https://i.ibb.co.com/WWtRtxzt/image-77692b74.jpg',
  items: [
    { key: 'c1', icon: 'fa-bullhorn',        title: 'Official Channel',          label: 'Join Our Official Channel',        url: 'https://t.me/bechelor_point_season' },
    { key: 'c2', icon: 'fa-money-check-dollar', title: 'Payment Proof Channel',  label: 'Join Our Payment Proof Channel',   url: 'https://t.me/ALLSEASONBC' },
    { key: 'c3', icon: 'fa-users',           title: 'Big Community',             label: 'Join Our Big Community',           url: 'https://t.me/community_freelancing' },
    { key: 'c4', icon: 'fa-receipt',         title: 'Community Payment Proof',   label: 'Join Our Community Payment Proof', url: 'https://t.me/communitytask_payment' }
  ]
};

let gatePassed = false;
let gateLastCheck = 0;

function gateBuild() {
  if (document.getElementById('gate-overlay')) return;
  const rows = GATE_CONFIG.items.map(it => `
      <button class="gate-btn gate-join" id="gate-join-${it.key}">
        <i class="fa-solid ${it.icon}"></i><span>${it.label}</span><i class="fa-solid fa-circle-check gate-tick"></i>
      </button>
      <div class="gate-err" id="gate-err-${it.key}">You have not joined the ${it.title}</div>`).join('');

  const el = document.createElement('div');
  el.id = 'gate-overlay';
  el.innerHTML = `
    <div class="gate-card">
      <img class="gate-banner" src="${GATE_CONFIG.bannerUrl}" alt="">
      <div class="gate-title">Welcome!</div>
      <p class="gate-text">Earn money by completing small tasks in this app — easy, fast, real income.</p>
      <p class="gate-text">▶ Join all 4 channels below to get started, then tap <b>Verify</b>.</p>
      ${rows}
      <button class="gate-btn gate-verify" id="gate-verify"><i class="fa-solid fa-check"></i><span>Verify</span></button>
      <div class="gate-msg" id="gate-msg"></div>
      <p class="gate-note">Verify will not work unless you join all 4. If you leave any of them, this notice will appear again.</p>
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

function gateShow(show) {
  const el = document.getElementById('gate-overlay');
  if (el) el.style.display = show ? 'flex' : 'none';
}

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

async function gateCheck() {
  const r = await fetch(GATE_CONFIG.workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: tg.initData })
  });
  return r.json();
}

async function gateVerify(manual) {
  const btn = document.getElementById('gate-verify');
  if (manual) { btn.disabled = true; gateSetMsg('Checking...'); }
  try {
    const res = await gateCheck();
    gateLastCheck = Date.now();
    if (res.error) { gateShow(true); gateSetMsg('Could not verify. Please try again.'); return; }
    gateSetStatus(res);
    if (res.ok) {
      gateSetMsg('');
      gateShow(false);
      if (!gatePassed) { gatePassed = true; initializeUserAccount(); }
    } else {
      gateShow(true);
      gateSetMsg(manual ? 'Please join all 4 first, then tap Verify.' : '');
    }
  } catch (e) {
    gateShow(true);
    gateSetMsg('Network problem. Please try again.');
  } finally {
    btn.disabled = false;
  }
}

function startGate() {
  gateBuild();
  gateShow(true);
  if (!tg || !tg.initData) {
    gateSetMsg('Please open this app from Telegram.');
    document.getElementById('gate-verify').style.display = 'none';
    return;
  }
  gateSetMsg('Checking...');
  gateVerify(false);

  // ইউজার চ্যানেল ছেড়ে অ্যাপে ফিরে এলে আবার চেক (১৫ সেকেন্ডে একবার)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && gatePassed && Date.now() - gateLastCheck > 15000) {
      gateVerify(false);
    }
  });
}
