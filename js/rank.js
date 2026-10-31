/* Rank / Leaderboard — রেফার সংখ্যা অনুযায়ী Top 50 (Firebase: leaderboard/) */
const RANK_LIMIT = 50;
let rankCache = [];
let lastSyncedSig = '';

function rankBn(n) { return String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]); }
function rankMaskId(id) {
  const n = String(id || '').replace('USR-', '');
  return 'USR-' + (n.length > 4 ? n.slice(0, 2) + '••••' + n.slice(-2) : n);
}
// বড় base64 ছবি leaderboard-এ রাখা হয় না; শুধু URL থাকলে সেটা, নইলে ডিফল্ট অ্যাভাটার
function rankAvatar(photo, id) {
  return (typeof photo === 'string' && photo.indexOf('http') === 0 && photo.length < 500)
    ? photo : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(id || 'user');
}
function rkEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// নিজের তথ্য leaderboard-এ লিখে রাখে (বদলালেই কেবল)। ui.js থেকে ডাকা হয়।
function syncLeaderboardEntry() {
  if (!currentUser || !currentUserId) return;
  const entry = {
    userId: currentUserId,
    name: String(currentUser.name || 'User').slice(0, 30),
    referrals: Number(currentUser.referrals || 0),
    photo: rankAvatar(currentUser.profilePhoto, currentUserId)
  };
  const sig = JSON.stringify(entry);
  if (sig === lastSyncedSig) return;
  lastSyncedSig = sig;
  db.ref('leaderboard/' + currentUserId).set(entry).catch(() => { lastSyncedSig = ''; });
}

function loadLeaderboard() {
  const list = document.getElementById('rankList');
  if (!list) return;
  list.replaceChildren(rkEl('div', 'rank-empty', 'লোড হচ্ছে...'));

  db.ref('leaderboard').orderByChild('referrals').limitToLast(RANK_LIMIT).once('value').then((snap) => {
    const arr = [];
    snap.forEach((c) => { const v = c.val(); if (v) arr.push(v); });
    arr.sort((a, b) => Number(b.referrals) - Number(a.referrals));
    rankCache = arr;
    renderPodium();
    renderRankList();
  }).catch(() => {
    list.replaceChildren(rkEl('div', 'rank-empty', 'লিডারবোর্ড লোড করা যায়নি, আবার চেষ্টা করুন।'));
  });
  loadMyRank();
}

function loadMyRank() {
  if (!currentUser) return;
  const mine = Number(currentUser.referrals || 0);
  document.getElementById('rankMeName').textContent = currentUser.name || 'User';
  document.getElementById('rankMeSub').textContent = rankMaskId(currentUserId) + ' • ' + mine + ' রেফার';
  document.getElementById('rankMeImg').src = rankAvatar(currentUser.profilePhoto, currentUserId);
  db.ref('leaderboard').orderByChild('referrals').startAt(mine + 1).once('value').then((s) => {
    document.getElementById('rankMeBadge').textContent = '#' + (s.numChildren() + 1);
  }).catch(() => {});
}

function renderPodium() {
  const box = document.getElementById('rankPodium');
  box.replaceChildren();
  [[1, 'p2'], [0, 'p1'], [2, 'p3']].forEach(([i, cls]) => {
    const u = rankCache[i];
    if (!u) return;
    const card = rkEl('div', 'pod ' + cls);
    if (i === 0) card.appendChild(rkEl('i', 'fa-solid fa-crown pod-crown'));
    card.appendChild(rkEl('span', 'pod-tag', i === 0 ? '#1 CHAMPION' : '#' + (i + 1)));
    card.appendChild(document.createElement('br'));
    const img = rkEl('img'); img.src = rankAvatar(u.photo, u.userId); img.alt = '';
    card.appendChild(img);
    card.appendChild(rkEl('div', 'pod-name', u.name));
    card.appendChild(rkEl('div', 'pod-id', rankMaskId(u.userId)));
    card.appendChild(rkEl('span', 'pod-pill', u.referrals + ' রেফার'));
    box.appendChild(card);
  });
}

function renderRankList() {
  const list = document.getElementById('rankList');
  const q = (document.getElementById('rankSearch').value || '').trim().toLowerCase();
  const rows = [];
  rankCache.forEach((u, i) => {
    if (q && (u.name || '').toLowerCase().indexOf(q) < 0 && String(u.userId || '').toLowerCase().indexOf(q) < 0) return;
    rows.push([u, i + 1]);
  });
  list.replaceChildren();
  if (!rows.length) {
    list.appendChild(rkEl('div', 'rank-empty', q ? 'কাউকে খুঁজে পাওয়া যায়নি।' : 'লিডারবোর্ডে এখনো কেউ নেই।'));
    return;
  }
  rows.forEach(([u, pos]) => {
    const row = rkEl('div', 'rank-row' + (pos <= 3 ? ' top' + pos : '') + (u.userId === currentUserId ? ' me' : ''));
    row.appendChild(rkEl('span', 'rank-no', '#' + pos));
    const img = rkEl('img'); img.src = rankAvatar(u.photo, u.userId); img.alt = '';
    row.appendChild(img);
    row.appendChild(rkEl('span', 'rank-row-name', u.name));
    row.appendChild(rkEl('span', 'rank-pill', u.referrals + ' রেফার'));
    list.appendChild(row);
  });
}

// একবারের কাজ: সব পুরনো ইউজারকে leaderboard-এ তুলে দেয়
// ব্যবহার: অ্যাপের লিংকের শেষে ?backfill=1 দিয়ে ব্রাউজারে খুলুন (অথবা console-এ backfillLeaderboard())
function backfillLeaderboard() {
  return db.ref('users').once('value').then((snap) => {
    const all = {};
    snap.forEach((c) => {
      const u = c.val() || {};
      all[c.key] = {
        userId: c.key,
        name: String(u.name || 'User').slice(0, 30),
        referrals: Number(u.referrals || 0),
        photo: rankAvatar(u.profilePhoto, c.key)
      };
    });
    const keys = Object.keys(all);
    let chain = Promise.resolve();
    for (let i = 0; i < keys.length; i += 300) {
      const part = {};
      keys.slice(i, i + 300).forEach((k) => { part[k] = all[k]; });
      chain = chain.then(() => db.ref('leaderboard').update(part));
    }
    return chain.then(() => {
      showToast('Backfill সম্পন্ন: ' + keys.length + ' জন ইউজার leaderboard-এ যোগ হয়েছে।');
      return keys.length;
    });
  }).catch((e) => { console.error(e); showToast('Backfill ব্যর্থ হয়েছে।'); });
}
if (new URLSearchParams(location.search).get('backfill') === '1') {
  window.addEventListener('load', () => setTimeout(backfillLeaderboard, 2500));
}

// র‍্যাঙ্ক পেজ খুললেই লিডারবোর্ড লোড হবে
(function () {
  const baseSwitch = window.switchView;
  window.switchView = function (view) {
    baseSwitch(view);
    if (view === 'rank') loadLeaderboard();
  };
})();
