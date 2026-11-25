/* Sponsorship পেজ — ৩টি ট্যাব: টাস্ক • প্রমোট করুন • আমার স্পনসরশিপ
   (১) টাস্ক: অ্যাডমিনের যোগ করা টাস্কে Join → Verify → Claim
   (২) প্রমোট করুন: প্ল্যান কিনে নিজের চ্যানেলের জন্য সাবস্ক্রাইবার নেওয়া (বিকাশ/নগদ Send Money)
   (৩) আমার স্পনসরশিপ: নিজের অর্ডারের অবস্থা ও প্রগ্রেস
   কাউন্ট, টাকা ও অর্ডার শুধু Cloudflare Worker লেখে; এই ফাইল শুধু দেখায় ও অনুরোধ পাঠায়। */

const SPONSOR_WORKER_URL = 'https://freelancing-gate.kdcamir5.workers.dev';

// প্ল্যান (Worker-এর SPONSOR_PLANS-এর সাথে হুবহু মিলতে হবে; আসল দাম Worker-ই ঠিক করে)
const SPONSOR_PLANS = [
  { id: 'starter', name: 'Starter', price: 199, members: 310, btn: 'buy-blue' },
  { id: 'growth', name: 'Growth', price: 399, members: 810, btn: 'buy-green', popular: true },
  { id: 'pro', name: 'Pro', price: 699, members: 1510, btn: 'buy-purple' },
  { id: 'vip', name: 'VIP', price: 999, members: 2510, btn: 'buy-gold', crown: true }
];

// পেমেন্ট নম্বর (hardcode)। logo-তে ছবির পথ দিলে (যেমন 'img/bkash.png') ব্যাজের বদলে লোগো দেখাবে।
const SPONSOR_PAY = {
  bkash: { label: 'bKash', number: '01720236858', cls: 'bkash', logo: '' },
  nagad: { label: 'Nagad', number: '01683312033', cls: 'nagad', logo: '' }
};

let sponsorTasks = {};          // sponsorships/
let sponsorCounts = {};         // sponsorCounts/
let sponsorProgress = {};       // sponsorProgress/<আমার uid>/
let sponsorBusy = {};           // taskId -> অনুরোধ চলছে
let sponsorPendingJoin = null;  // Join চাপা হয়েছে, ফিরে এলে নিজে নিজে Verify হবে
let sponsorGlobalBound = false;
let sponsorProgressRef = null;
let sponsorActiveTab = 'tasks';
let sponsorOrdersState = { loading: false, error: false, list: null };
let sponsorOrderPlan = null;
let sponsorOrderBusy = false;

function sponsorEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function sponsorIcon(cls) { const i = document.createElement('i'); i.className = cls; return i; }
function sponsorMoney(n) { n = Number(n) || 0; return '৳' + (n % 1 ? n.toFixed(2) : String(n)); }

/* ------------------------------------------------------------------ */
/*  শুরু: user.js থেকে ডাকা হয় (একাউন্ট লোড হলে)। বারবার ডাকলেও ডুপ্লিকেট listener জমে না। */
function initSponsorships() {
  if (!sponsorGlobalBound) {
    sponsorGlobalBound = true;
    renderSponsorPlans();
    db.ref('sponsorships').on('value', (s) => { sponsorTasks = s.val() || {}; renderSponsorList(); });
    db.ref('sponsorCounts').on('value', (s) => { sponsorCounts = s.val() || {}; renderSponsorList(); sponsorRenderOrders(); });
    document.addEventListener('visibilitychange', sponsorAutoVerifyOnReturn);
    try { tg && tg.onEvent && tg.onEvent('activated', sponsorAutoVerifyOnReturn); } catch (e) { /* পুরনো Telegram */ }
  }
  if (sponsorProgressRef) sponsorProgressRef.off();
  sponsorProgress = {};
  sponsorProgressRef = db.ref('sponsorProgress/' + currentUserId);
  sponsorProgressRef.on('value', (s) => { sponsorProgress = s.val() || {}; renderSponsorList(); });
}

/* ------------------------------------------------------------------ */
/*  ট্যাব */
function spShowTab(name) {
  sponsorActiveTab = name;
  ['tasks', 'promote', 'mine'].forEach((t) => {
    const b = document.getElementById('spTab-' + t);
    const p = document.getElementById('spPane-' + t);
    if (b) b.classList.toggle('active', t === name);
    if (p) p.classList.toggle('active', t === name);
  });
  if (name === 'mine') sponsorLoadOrders();
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  ট্যাব ১: টাস্ক */
function sponsorTaskInfo(id) {
  const t = sponsorTasks[id] || {};
  const p = sponsorProgress[id] || {};
  const target = Number(t.target) || 0;
  const count = Number(sponsorCounts[id]) || 0;
  return {
    t, p, target, count,
    reward: Number(t.reward) || 0,
    full: target > 0 && count >= target,
    claimed: !!p.claimedAt,
    verified: !!p.verifiedAt,
    active: t.active === true
  };
}

function sponsorVisibleIds() {
  return Object.keys(sponsorTasks).filter((id) => {
    const t = sponsorTasks[id];
    if (!t || typeof t !== 'object') return false;
    const i = sponsorTaskInfo(id);
    // বন্ধ টাস্ক শুধু তাদেরই দেখায় যারা ভেরিফাই করেছে কিন্তু এখনো Claim করেনি
    return i.active || (i.verified && !i.claimed);
  });
}

function sponsorRank(id) {
  const i = sponsorTaskInfo(id);
  if (i.verified && !i.claimed) return 0;            // Claim করার মতো — সবার উপরে
  if (!i.claimed && !i.full) return 1;               // নতুন
  if (!i.claimed && i.full) return 2;                // টার্গেট পূর্ণ
  return 3;                                          // সম্পন্ন — সবার নিচে
}

function renderSponsorStats(ids) {
  let todo = 0, claim = 0;
  ids.forEach((id) => {
    const i = sponsorTaskInfo(id);
    if (i.verified && !i.claimed) claim++;
    else if (!i.claimed && !i.verified && !i.full) todo++;
  });
  const done = Object.keys(sponsorProgress).filter((k) => sponsorProgress[k] && sponsorProgress[k].claimedAt).length;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = String(v); };
  set('spStatTodo', todo); set('spStatDone', done); set('spStatClaim', claim);
  const chip = document.getElementById('spRemainChip');
  if (chip) {
    const left = todo + claim;
    chip.textContent = !ids.length ? 'কোনো টাস্ক নেই' : (left ? left + 'টি টাস্ক বাকি' : 'সব সম্পন্ন');
  }
}

function renderSponsorList() {
  const box = document.getElementById('sponsorList');
  if (!box) return;
  const ids = sponsorVisibleIds().sort((a, b) => {
    const d = sponsorRank(a) - sponsorRank(b);
    return d || (Number(sponsorTasks[a].order) || 0) - (Number(sponsorTasks[b].order) || 0);
  });
  renderSponsorStats(ids);
  box.replaceChildren();

  if (!ids.length) {
    box.appendChild(sponsorEl('div', 'sp-empty', 'এখন কোনো স্পনসর টাস্ক নেই। কিছুক্ষণ পর আবার দেখুন।'));
    return;
  }

  ids.forEach((id) => {
    const i = sponsorTaskInfo(id);
    const busy = !!sponsorBusy[id];
    const card = sponsorEl('div', 'sp-card' + (i.claimed ? ' is-done' : (i.verified ? ' is-claim' : '')));

    const ic = sponsorEl('div', 'sp-ic');
    ic.appendChild(sponsorIcon('fa-brands fa-telegram'));
    card.appendChild(ic);

    const info = sponsorEl('div', 'sp-info');
    info.appendChild(sponsorEl('span', 'sp-name', String(i.t.title || 'Sponsor')));
    info.appendChild(sponsorEl('span', 'sp-reward', sponsorMoney(i.reward) + ' Reward'));
    if (i.target > 0) {
      const prog = sponsorEl('div', 'sp-prog');
      const track = sponsorEl('div', 'sp-track');
      const fill = sponsorEl('div', 'sp-fill');
      fill.style.width = Math.min(100, Math.round((i.count / i.target) * 100)) + '%';
      track.appendChild(fill);
      prog.append(track, sponsorEl('span', 'sp-num', i.count + '/' + i.target));
      info.appendChild(prog);
    }
    card.appendChild(info);

    const actions = sponsorEl('div', 'sp-actions');
    if (i.claimed) {
      const b = sponsorEl('button', 'sp-btn done', 'সম্পন্ন ✅'); b.disabled = true; actions.appendChild(b);
    } else if (i.verified) {
      const b = sponsorEl('button', 'sp-btn claim', busy ? 'অপেক্ষা করুন...' : 'Claim ' + sponsorMoney(i.reward));
      b.disabled = busy; b.addEventListener('click', () => sponsorClaimTask(id)); actions.appendChild(b);
    } else if (i.full) {
      const b = sponsorEl('button', 'sp-btn verify', 'টার্গেট পূর্ণ'); b.disabled = true; actions.appendChild(b);
    } else {
      const join = sponsorEl('button', 'sp-btn join', 'Join');
      join.addEventListener('click', () => sponsorOpenLink(id));
      const ver = sponsorEl('button', 'sp-btn verify', busy ? 'চেক হচ্ছে...' : 'Verify');
      ver.disabled = busy; ver.addEventListener('click', () => sponsorVerifyTask(id, false));
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

/* ------------------------------------------------------------------ */
/*  Worker-এ অনুরোধ */
async function sponsorPost(path, extra) {
  if (!tg || !tg.initData) throw new Error('no_tg');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(SPONSOR_WORKER_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(Object.assign({ initData: tg.initData }, extra || {})),
      signal: ctrl.signal
    });
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}
function sponsorCall(path, taskId) { return sponsorPost(path, { taskId: taskId }); }

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
  bad_reward: 'এই টাস্কের রিওয়ার্ড ঠিক নেই। অ্যাডমিনকে জানান।',
  // অর্ডার
  bad_plan: 'প্ল্যানটি পাওয়া যায়নি।',
  bad_method: 'কোন মাধ্যমে পাঠিয়েছেন (bKash/Nagad) বেছে নিন।',
  bad_link: 'চ্যানেল/গ্রুপের লিংক ঠিক নয়। https://t.me/... লিংক দিন।',
  bad_number: 'যে নম্বর থেকে টাকা পাঠিয়েছেন সেটা ঠিকভাবে লিখুন (যেমন 01XXXXXXXXX)।',
  bad_trx: 'TrxID ঠিক নেই। মেসেজে যা এসেছে হুবহু লিখুন।',
  trx_used: 'এই TrxID আগেই ব্যবহার হয়েছে। সঠিক TrxID দিন।',
  too_many: 'আপনার ৩টি অর্ডার এখনো যাচাইয়ের অপেক্ষায় আছে। আগে সেগুলো শেষ হোক।'
};

function sponsorErrorToast(res) {
  if (res && res.error === 'invalid_init_data') return showToast('অ্যাপটি বন্ধ করে Telegram থেকে আবার খুলুন।');
  if (res && res.reason && SPONSOR_MSG[res.reason]) return showToast(SPONSOR_MSG[res.reason]);
  showToast('কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।');
}

async function sponsorVerifyTask(id, auto) {
  if (sponsorBusy[id] || !currentUserId) return;
  if ((sponsorProgress[id] || {}).verifiedAt) return;
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
      showToast('অভিনন্দন! ' + sponsorMoney(res.reward) + ' ব্যালেন্সে যোগ হয়েছে।');
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

/* ------------------------------------------------------------------ */
/*  ট্যাব ২: প্ল্যান */
function renderSponsorPlans() {
  const box = document.getElementById('spPlans');
  if (!box) return;
  box.replaceChildren();
  SPONSOR_PLANS.forEach((p) => {
    const card = sponsorEl('div', 'sp-plan ' + p.id);
    if (p.popular) card.appendChild(sponsorEl('span', 'sp-pop', '🔥 Popular'));
    const h = sponsorEl('h3');
    if (p.crown) h.appendChild(sponsorIcon('fa-solid fa-crown'));
    h.appendChild(document.createTextNode(p.name));
    card.appendChild(h);
    card.appendChild(sponsorEl('div', 'sp-price', '৳' + p.price));

    const f1 = sponsorEl('div', 'sp-feat big');
    f1.append(sponsorIcon('fa-solid fa-check'), document.createTextNode(p.members + ' মেম্বার'));
    const f2 = sponsorEl('div', 'sp-feat');
    f2.append(sponsorIcon('fa-solid fa-check'), document.createTextNode('বট দিয়ে যাচাই'));
    card.append(f1, f2);

    const buy = sponsorEl('button', 'sp-btn ' + p.btn, 'Buy Now');
    buy.type = 'button';
    buy.addEventListener('click', () => spOpenSheet(p.id));
    card.appendChild(buy);
    box.appendChild(card);
  });
}

/* ------------------------------------------------------------------ */
/*  কেনার শিট */
function spCloseSheet() {
  const o = document.getElementById('spSheet');
  if (o) o.classList.remove('open');
  sponsorOrderPlan = null;
}

function sponsorPayRow(key) {
  const p = SPONSOR_PAY[key];
  const row = sponsorEl('div', 'sp-pay');
  if (p.logo) {
    const img = document.createElement('img');
    img.src = p.logo; img.alt = p.label; img.style.cssText = 'height:34px;width:auto;border-radius:8px;flex:0 0 auto';
    row.appendChild(img);
  } else {
    row.appendChild(sponsorEl('span', 'sp-pay-badge ' + p.cls, p.label));
  }
  const num = sponsorEl('div', 'sp-pay-num', p.number);
  num.appendChild(sponsorEl('span', 'sp-pay-type', 'Personal • শুধু Send Money'));
  row.appendChild(num);
  const copy = sponsorEl('button', 'sp-copy', 'Copy');
  copy.type = 'button';
  copy.addEventListener('click', () => copyTextToClipboard(p.number, p.label + ' নম্বর কপি হয়েছে।'));
  row.appendChild(copy);
  return row;
}

function sponsorField(id, label, placeholder, type, hint) {
  const wrap = sponsorEl('div', 'sp-field');
  const lb = sponsorEl('label', '', label); lb.htmlFor = id;
  const inp = document.createElement('input');
  inp.id = id; inp.type = type || 'text'; inp.placeholder = placeholder; inp.autocomplete = 'off';
  wrap.append(lb, inp);
  if (hint) wrap.appendChild(sponsorEl('p', 'sp-hint', hint));
  return wrap;
}

function spOpenSheet(planId) {
  const plan = SPONSOR_PLANS.find((p) => p.id === planId);
  const body = document.getElementById('spSheetBody');
  const overlay = document.getElementById('spSheet');
  if (!plan || !body || !overlay) return;
  sponsorOrderPlan = plan;
  sponsorOrderBusy = false;
  body.replaceChildren();

  const head = sponsorEl('div', 'sp-sheet-head');
  head.appendChild(sponsorIcon('fa-solid fa-crown crown'));
  const h3 = sponsorEl('h3', '', plan.name + ' Plan');
  h3.appendChild(sponsorEl('small', '', plan.members + ' মেম্বার'));
  head.appendChild(h3);
  head.appendChild(sponsorEl('span', 'price', '৳' + plan.price));
  const x = sponsorEl('button', 'sp-x'); x.type = 'button'; x.appendChild(sponsorIcon('fa-solid fa-xmark'));
  x.addEventListener('click', spCloseSheet);
  head.appendChild(x);
  body.appendChild(head);

  const warn = sponsorEl('div', 'sp-warn');
  warn.appendChild(sponsorIcon('fa-solid fa-triangle-exclamation'));
  const wt = sponsorEl('div');
  const wb = sponsorEl('b', '', 'শুধুমাত্র Send Money করুন।');
  wt.append(wb, document.createTextNode(' Payment, Cash Out বা Mobile Recharge করলে অর্ডার গ্রহণ করা হবে না।'));
  warn.appendChild(wt);
  body.appendChild(warn);

  const amt = sponsorEl('div', 'sp-amount', 'যেকোনো একটি নম্বরে ');
  amt.appendChild(sponsorEl('b', '', '৳' + plan.price));
  amt.appendChild(document.createTextNode(' Send Money করুন'));
  body.appendChild(amt);

  body.appendChild(sponsorPayRow('bkash'));
  body.appendChild(sponsorPayRow('nagad'));

  const seg = sponsorEl('div', 'sp-field');
  seg.style.marginTop = '12px';
  seg.appendChild(sponsorEl('label', '', 'কোন মাধ্যমে পাঠিয়েছেন?'));
  const segRow = sponsorEl('div', 'sp-seg');
  ['bkash', 'nagad'].forEach((k) => {
    const b = sponsorEl('button', 'sp-seg-btn' + (k === 'bkash' ? ' on' : ''), SPONSOR_PAY[k].label);
    b.type = 'button'; b.dataset.m = k;
    b.addEventListener('click', () => { segRow.querySelectorAll('.sp-seg-btn').forEach((e) => e.classList.toggle('on', e === b)); });
    segRow.appendChild(b);
  });
  seg.appendChild(segRow);
  body.appendChild(seg);

  body.appendChild(sponsorField('spfUrl', 'আপনার চ্যানেল/গ্রুপের লিংক', 'https://t.me/yourchannel', 'url'));
  body.appendChild(sponsorField('spfFrom', 'যে নম্বর থেকে টাকা পাঠিয়েছেন', '01XXXXXXXXX', 'tel'));
  body.appendChild(sponsorField('spfTrx', 'TrxID', 'যেমন 8N7A6D5EF4', 'text', 'পেমেন্টের মেসেজে যে TrxID এসেছে হুবহু লিখুন।'));

  const note = sponsorEl('div', 'sp-botnote');
  note.appendChild(sponsorIcon('fa-solid fa-robot'));
  note.appendChild(sponsorEl('div', '', 'আমাদের বট @freelancingapp_bot-কে আপনার চ্যানেল/গ্রুপে অ্যাডমিন বানান। না বানালে মেম্বার যাচাই কাজ করবে না।'));
  body.appendChild(note);

  const submit = sponsorEl('button', 'sp-submit', 'অর্ডার জমা দিন');
  submit.type = 'button'; submit.id = 'spSubmit';
  submit.addEventListener('click', sponsorSubmitOrder);
  body.appendChild(submit);

  overlay.classList.add('open');
}

async function sponsorSubmitOrder() {
  const plan = sponsorOrderPlan;
  if (!plan || sponsorOrderBusy) return;
  const val = (id) => (document.getElementById(id) || {}).value || '';
  const methodBtn = document.querySelector('#spSheetBody .sp-seg-btn.on');
  const method = methodBtn ? methodBtn.dataset.m : '';
  const channelUrl = val('spfUrl').trim();
  const senderNumber = val('spfFrom').replace(/[\s-]/g, '');
  const trxId = val('spfTrx').trim().toUpperCase();

  if (!/^https:\/\/(t|telegram)\.me\/[A-Za-z0-9_+\/-]{3,100}$/i.test(channelUrl)) return sponsorErrorToast({ reason: 'bad_link' });
  if (!/^01[3-9]\d{8}$/.test(senderNumber)) return sponsorErrorToast({ reason: 'bad_number' });
  if (!/^[A-Z0-9]{6,20}$/.test(trxId)) return sponsorErrorToast({ reason: 'bad_trx' });

  const btn = document.getElementById('spSubmit');
  sponsorOrderBusy = true;
  if (btn) { btn.disabled = true; btn.textContent = 'জমা হচ্ছে...'; }
  try {
    const res = await sponsorPost('/sponsor/order', { planId: plan.id, method: method, channelUrl: channelUrl, senderNumber: senderNumber, trxId: trxId });
    if (res && res.ok) {
      sponsorOrdersState.list = null;
      sponsorShowOrderDone(plan, trxId, channelUrl);
    } else {
      sponsorErrorToast(res);
      if (btn) { btn.disabled = false; btn.textContent = 'অর্ডার জমা দিন'; }
    }
  } catch (e) {
    showToast('নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।');
    if (btn) { btn.disabled = false; btn.textContent = 'অর্ডার জমা দিন'; }
  } finally {
    sponsorOrderBusy = false;
  }
}

function sponsorShowOrderDone(plan, trxId, channelUrl) {
  const body = document.getElementById('spSheetBody');
  if (!body) return;
  body.replaceChildren();
  const wrap = sponsorEl('div', 'sp-success');
  const ic = sponsorEl('div', 'ic'); ic.appendChild(sponsorIcon('fa-solid fa-hourglass-half'));
  wrap.appendChild(ic);
  wrap.appendChild(sponsorEl('h3', '', 'অর্ডার জমা হয়েছে'));
  wrap.appendChild(sponsorEl('p', '', 'আপনার পেমেন্ট যাচাই চলছে। যাচাই হলে আপনার চ্যানেলের টাস্ক চালু হবে, আর "আমার স্পনসরশিপ"-এ অবস্থা দেখতে পাবেন।'));
  const box = sponsorEl('div', 'box');
  [['প্ল্যান', plan.name + ' • ' + plan.members + ' মেম্বার'], ['টাকা', '৳' + plan.price], ['TrxID', trxId], ['চ্যানেল', channelUrl]].forEach(([k, v]) => {
    const line = sponsorEl('div'); line.append(sponsorEl('b', '', k + ': '), document.createTextNode(v)); box.appendChild(line);
  });
  wrap.appendChild(box);
  const go = sponsorEl('button', 'sp-submit', 'আমার স্পনসরশিপ দেখুন');
  go.type = 'button';
  go.addEventListener('click', () => { spCloseSheet(); spShowTab('mine'); });
  wrap.appendChild(go);
  body.appendChild(wrap);
}

/* ------------------------------------------------------------------ */
/*  ট্যাব ৩: আমার স্পনসরশিপ */
async function sponsorLoadOrders() {
  if (sponsorOrdersState.loading) return;
  sponsorOrdersState.loading = true;
  sponsorOrdersState.error = false;
  sponsorRenderOrders();
  try {
    const res = await sponsorPost('/sponsor/myorders', {});
    if (res && res.ok) sponsorOrdersState.list = res.orders || [];
    else sponsorOrdersState.error = true;
  } catch (e) {
    sponsorOrdersState.error = true;
  } finally {
    sponsorOrdersState.loading = false;
    sponsorRenderOrders();
  }
}

function sponsorOrderStatus(o) {
  if (o.status === 'pending') return { cls: 'pending', label: 'যাচাই চলছে' };
  if (o.status === 'rejected') return { cls: 'rejected', label: 'বাতিল' };
  if (o.members > 0 && o.count >= o.members) return { cls: 'done', label: 'সম্পন্ন' };
  if (!o.taskActive) return { cls: 'paused', label: 'বন্ধ' };
  return { cls: 'active', label: 'চালু' };
}

function sponsorRenderOrders() {
  const box = document.getElementById('spOrders');
  if (!box) return;
  box.replaceChildren();
  const st = sponsorOrdersState;

  if (st.loading && st.list === null) { box.appendChild(sponsorEl('div', 'sp-empty', 'লোড হচ্ছে...')); return; }
  if (st.error && st.list === null) {
    const e = sponsorEl('div', 'sp-empty', 'লোড করা যায়নি।');
    const b = sponsorEl('button', 'sp-btn join', 'আবার চেষ্টা করুন'); b.type = 'button';
    b.addEventListener('click', sponsorLoadOrders); e.appendChild(b); box.appendChild(e); return;
  }
  if (!st.list || !st.list.length) {
    const e = sponsorEl('div', 'sp-empty', 'আপনি এখনো কোনো প্ল্যান কেনেননি।');
    const b = sponsorEl('button', 'sp-btn join', 'প্ল্যান দেখুন'); b.type = 'button';
    b.addEventListener('click', () => spShowTab('promote')); e.appendChild(b); box.appendChild(e); return;
  }

  st.list.forEach((o) => {
    const s = sponsorOrderStatus(o);
    const live = o.status === 'approved' && o.taskId ? Number(sponsorCounts[o.taskId]) : NaN;
    const count = isNaN(live) ? (Number(o.count) || 0) : live;
    const card = sponsorEl('div', 'sp-order' + (s.cls === 'active' ? ' is-active' : (s.cls === 'rejected' ? ' is-rejected' : '')));

    const top = sponsorEl('div', 'sp-order-top');
    top.appendChild(sponsorIcon('fa-solid fa-crown sp-order-crown'));
    const title = sponsorEl('div', 'sp-order-title', o.planName + ' Plan');
    title.appendChild(sponsorEl('small', '', '৳' + o.price + ' • ' + o.members + ' মেম্বার'));
    top.appendChild(title);
    top.appendChild(sponsorEl('span', 'sp-status ' + s.cls, s.label));
    card.appendChild(top);

    let meta = String(o.channelUrl || '');
    if (o.createdAt) meta += '\n' + new Date(o.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
    const m = sponsorEl('div', 'sp-order-meta', meta); m.style.whiteSpace = 'pre-line';
    card.appendChild(m);

    if (o.status === 'approved') {
      const prog = sponsorEl('div', 'sp-prog');
      const track = sponsorEl('div', 'sp-track');
      const fill = sponsorEl('div', 'sp-fill');
      fill.style.width = (o.members > 0 ? Math.min(100, Math.round((count / o.members) * 100)) : 0) + '%';
      track.appendChild(fill);
      prog.append(track, sponsorEl('span', 'sp-num', count + '/' + o.members + ' মেম্বার'));
      card.appendChild(prog);
    } else if (o.status === 'pending') {
      card.appendChild(sponsorEl('div', 'sp-order-meta', 'পেমেন্ট যাচাই হলে টাস্ক নিজে থেকে চালু হবে।'));
    } else if (o.status === 'rejected') {
      card.appendChild(sponsorEl('div', 'sp-order-note', (o.reason ? o.reason + ' — ' : '') + 'টাকা পাঠিয়ে থাকলে সাপোর্টে যোগাযোগ করুন।'));
    }
    box.appendChild(card);
  });
}

/* ------------------------------------------------------------------ */
/*  হেডারের উচ্চতা মাপা (উপরের স্টিকি বার ঠিক নিচে আটকানোর জন্য) + পেজ খুললে রিফ্রেশ */
function sponsorMeasureHeader() {
  const h = document.querySelector('.top-header');
  if (h && h.offsetHeight) document.documentElement.style.setProperty('--hdr-h', h.offsetHeight + 'px');
}

document.addEventListener('DOMContentLoaded', () => {
  sponsorMeasureHeader();
  window.addEventListener('resize', sponsorMeasureHeader);
  window.addEventListener('load', sponsorMeasureHeader);
  const h = document.querySelector('.top-header');
  if (h && window.ResizeObserver) new ResizeObserver(sponsorMeasureHeader).observe(h);

  // Sponsorship পেজ খুললে অবস্থা রিফ্রেশ
  const base = window.switchView;
  if (typeof base === 'function') {
    window.switchView = function (view) {
      base.apply(this, arguments);
      if (view === 'sponsor') {
        sponsorMeasureHeader();
        if (sponsorActiveTab === 'mine') sponsorLoadOrders();
      }
    };
  }
});
