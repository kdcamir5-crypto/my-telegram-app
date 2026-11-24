/* Sponsorship টাস্ক — অ্যাডমিন প্যানেল থেকে যোগ হয়। ইউজারের ধাপ: Join → Verify → Claim
   কাউন্ট ও টাকা শুধু Cloudflare Worker লেখে; এই ফাইল শুধু দেখায় ও Worker-কে অনুরোধ পাঠায়। */

const SPONSOR_WORKER_URL = 'https://freelancing-gate.kdcamir5.workers.dev';

let sponsorTasks = {};          // sponsorships/
let sponsorCounts = {};         // sponsorCounts/
let sponsorProgress = {};       // sponsorProgress/<আমার uid>/
let sponsorBusy = {};           // taskId -> অনুরোধ চলছে
let sponsorPendingJoin = null;  // Join চাপা হয়েছে, ফিরে এলে নিজে নিজে Verify হবে
let sponsorGlobalBound = false;
let sponsorProgressRef = null;

function sponsorEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// user.js থেকে ডাকা হয় (একাউন্ট লোড হলে)। বারবার ডাকলেও ডুপ্লিকেট listener জমে না।
function initSponsorships() {
  if (!sponsorGlobalBound) {
    sponsorGlobalBound = true;
    db.ref('sponsorships').on('value', (s) => { sponsorTasks = s.val() || {}; renderSponsorList(); });
    db.ref('sponsorCounts').on('value', (s) => { sponsorCounts = s.val() || {}; renderSponsorList(); });
    document.addEventListener('visibilitychange', sponsorAutoVerifyOnReturn);
    try { tg && tg.onEvent && tg.onEvent('activated', sponsorAutoVerifyOnReturn); } catch (e) { /* পুরনো Telegram */ }
  }
  if (sponsorProgressRef) sponsorProgressRef.off();
  sponsorProgress = {};
  sponsorProgressRef = db.ref('sponsorProgress/' + currentUserId);
  sponsorProgressRef.on('value', (s) => { sponsorProgress = s.val() || {}; renderSponsorList(); });
}

function sponsorSortedIds() {
  return Object.keys(sponsorTasks)
    .filter((id) => {
      const t = sponsorTasks[id];
      if (!t || typeof t !== 'object') return false;
      const p = sponsorProgress[id] || {};
      // বন্ধ টাস্ক শুধু তাদেরই দেখায় যারা ভেরিফাই করেছে কিন্তু এখনো Claim করেনি
      return t.active === true || (p.verifiedAt && !p.claimedAt);
    })
    .sort((a, b) => (Number(sponsorTasks[a].order) || 0) - (Number(sponsorTasks[b].order) || 0));
}

function renderSponsorList() {
  const box = document.getElementById('sponsorList');
  if (!box) return;
  const ids = sponsorSortedIds();
  box.replaceChildren();

  if (!ids.length) {
    box.appendChild(sponsorEl('div', 'sp-empty', 'এখন কোনো স্পনসরশিপ টাস্ক নেই। কিছুক্ষণ পর আবার দেখুন।'));
    return;
  }

  ids.forEach((id) => {
    const t = sponsorTasks[id];
    const p = sponsorProgress[id] || {};
    const target = Number(t.target) || 0;
    const count = Number(sponsorCounts[id]) || 0;
    const reward = Number(t.reward) || 0;
    const full = target > 0 && count >= target;
    const busy = !!sponsorBusy[id];

    const card = sponsorEl('div', 'tcard sp-card');
    card.appendChild(Object.assign(sponsorEl('div', 'tcard-icon tc-sky'), { innerHTML: '<i class="fa-brands fa-telegram"></i>' }));

    const info = sponsorEl('div', 'tcard-info');
    info.appendChild(sponsorEl('span', 'tcard-name', String(t.title || 'Sponsor')));
    const rw = sponsorEl('span', 'tcard-reward', '৳' + reward.toFixed(2));
    rw.appendChild(sponsorEl('span', 'sp-count', ' (' + count + '/' + (target || '∞') + ')'));
    info.appendChild(rw);
    if (target > 0) {
      const bar = sponsorEl('div', 'sp-bar');
      const fill = sponsorEl('div', 'sp-bar-fill');
      fill.style.width = Math.min(100, Math.round((count / target) * 100)) + '%';
      bar.appendChild(fill);
      info.appendChild(bar);
    }
    card.appendChild(info);

    const actions = sponsorEl('div', 'sp-actions');
    if (p.claimedAt) {
      const b = sponsorEl('button', 'tcard-btn tcard-btn-done', 'সম্পন্ন ✅');
      b.disabled = true;
      actions.appendChild(b);
    } else if (p.verifiedAt) {
      const b = sponsorEl('button', 'tcard-btn sp-btn-claim', busy ? 'অপেক্ষা করুন...' : 'Claim ৳' + reward);
      b.disabled = busy;
      b.addEventListener('click', () => sponsorClaimTask(id));
      actions.appendChild(b);
    } else if (full) {
      const b = sponsorEl('button', 'tcard-btn', 'টার্গেট পূর্ণ');
      b.disabled = true;
      actions.appendChild(b);
    } else {
      const join = sponsorEl('button', 'tcard-btn sp-btn-join', 'Join');
      join.addEventListener('click', () => sponsorOpenLink(id));
      const ver = sponsorEl('button', 'tcard-btn', busy ? 'চেক হচ্ছে...' : 'Verify');
      ver.disabled = busy;
      ver.addEventListener('click', () => sponsorVerifyTask(id, false));
      actions.append(join, ver);
    }
    card.appendChild(actions);
    box.appendChild(card);
  });
}

function sponsorOpenLink(id) {
  const t = sponsorTasks[id];
  const url = String((t && t.url) || '');
  if (!/^https:\/\/(t|telegram)\.me\//i.test(url)) {
    showToast('এই টাস্কের লিংকটি সঠিক নয়। অ্যাডমিনকে জানান।');
    return;
  }
  sponsorPendingJoin = id;
  if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}

// Join করে অ্যাপে ফিরে এলে নিজে নিজেই Verify চেষ্টা করে
function sponsorAutoVerifyOnReturn() {
  if (document.visibilityState === 'hidden') return;
  const id = sponsorPendingJoin;
  if (!id) return;
  sponsorPendingJoin = null;
  sponsorVerifyTask(id, true);
}

async function sponsorCall(path, taskId) {
  if (!tg || !tg.initData) throw new Error('no_tg');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(SPONSOR_WORKER_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ initData: tg.initData, taskId: taskId }),
      signal: ctrl.signal
    });
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const SPONSOR_MSG = {
  not_member: 'আপনি এখনো চ্যানেল/গ্রুপে জয়েন করেননি। আগে Join করে তারপর Verify দিন।',
  full: 'এই টাস্কের টার্গেট পূর্ণ হয়ে গেছে।',
  inactive: 'এই টাস্কটি এখন বন্ধ আছে।',
  not_found: 'টাস্কটি পাওয়া যায়নি।',
  bot_error: 'এই মুহূর্তে চেক করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।',
  busy: 'এখন অনেক চাপ, একটু পরে আবার চেষ্টা করুন।',
  not_verified: 'আগে Verify করুন।',
  already_claimed: 'এই টাস্কের টাকা আগেই নিয়েছেন।',
  left: 'আপনি চ্যানেল/গ্রুপ থেকে বেরিয়ে গেছেন। আবার জয়েন করে Claim করুন।',
  no_account: 'আপনার একাউন্ট পাওয়া যায়নি। অ্যাপটি আবার খুলুন।',
  credit_failed: 'টাকা যোগ করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।',
  bad_reward: 'এই টাস্কের রিওয়ার্ড ঠিক নেই। অ্যাডমিনকে জানান।'
};

function sponsorErrorToast(res) {
  if (res && res.error === 'invalid_init_data') return showToast('অ্যাপটি বন্ধ করে Telegram থেকে আবার খুলুন।');
  if (res && res.reason && SPONSOR_MSG[res.reason]) return showToast(SPONSOR_MSG[res.reason]);
  showToast('কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।');
}

async function sponsorVerifyTask(id, auto) {
  if (sponsorBusy[id] || !currentUserId) return;
  const p0 = sponsorProgress[id] || {};
  if (p0.verifiedAt) return;
  sponsorBusy[id] = true;
  renderSponsorList();
  try {
    const res = await sponsorCall('/sponsor/verify', id);
    if (res && res.ok) {
      sponsorProgress[id] = Object.assign({}, sponsorProgress[id], { verifiedAt: Date.now() });
      showToast(res.already ? 'আগেই ভেরিফাই হয়েছে। এখন Claim করুন।' : 'ভেরিফাই সফল! এখন Claim করুন।');
    } else if (auto && res && res.reason === 'not_member') {
      showToast('জয়েন সম্পূর্ণ হলে Verify বাটন চাপুন।');
    } else {
      sponsorErrorToast(res);
    }
  } catch (e) {
    showToast('নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।');
  } finally {
    sponsorBusy[id] = false;
    renderSponsorList();
  }
}

async function sponsorClaimTask(id) {
  if (sponsorBusy[id] || !currentUserId) return;
  sponsorBusy[id] = true;
  renderSponsorList();
  try {
    const res = await sponsorCall('/sponsor/claim', id);
    if (res && res.ok) {
      sponsorProgress[id] = Object.assign({}, sponsorProgress[id], { claimedAt: Date.now() });
      showToast('অভিনন্দন! ৳' + res.reward + ' ব্যালেন্সে যোগ হয়েছে।');
      try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('success'); } catch (e) { /* ignore */ }
    } else {
      if (res && res.reason === 'already_claimed') sponsorProgress[id] = Object.assign({}, sponsorProgress[id], { claimedAt: Date.now() });
      sponsorErrorToast(res);
    }
  } catch (e) {
    showToast('নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।');
  } finally {
    sponsorBusy[id] = false;
    renderSponsorList();
  }
}
