/* Compact sequential notifications from real, approved withdrawals only. */
(function () {
  'use strict';
  if (window.__activityNotificationsStarted || !window.db) return;
  window.__activityNotificationsStarted = true;

  const host = document.createElement('div');
  host.id = 'activity-notification-host';
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-label', 'সফল উত্তোলনের বিজ্ঞপ্তি');
  document.body.appendChild(host);

  let approved = [];
  let active = false;
  let timer = null;
  let lastId = '';

  const numberFormat = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 0 });
  function maskPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length < 7) return '';
    return digits.slice(0, 5) + '****' + digits.slice(-2);
  }

  function scheduleNext(delay) {
    if (timer) clearTimeout(timer);
    if (active || !approved.length) return;
    timer = setTimeout(showNext, delay);
  }

  function showNext() {
    if (active || !approved.length) return;
    const choices = approved.filter(item => item.id !== lastId);
    const item = choices[Math.floor(Math.random() * (choices.length || approved.length))] || approved[0];
    if (!item) return;

    const card = document.createElement('div');
    card.className = 'activity-notification';
    card.setAttribute('role', 'status');

    const mark = document.createElement('span');
    mark.className = 'activity-notification-mark';
    mark.textContent = '✓';

    const content = document.createElement('span');
    content.className = 'activity-notification-content';

    const title = document.createElement('span');
    title.className = 'activity-notification-title';
    title.textContent = 'উত্তোলন সফল';

    const amount = document.createElement('strong');
    amount.className = 'activity-notification-amount';
    amount.textContent = '৳' + numberFormat.format(Number(item.amount));

    const detail = document.createElement('span');
    detail.className = 'activity-notification-detail';
    const phone = maskPhone(item.phone);
    const method = item.method ? ' · ' + String(item.method) : '';
    detail.textContent = (phone ? phone : 'সফল উত্তোলন') + method;

    const close = document.createElement('button');
    close.className = 'activity-notification-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'বন্ধ করুন');
    close.textContent = '×';

    content.append(title, amount, detail);
    card.append(mark, content, close);
    host.replaceChildren(card);
    active = true;
    lastId = item.id;
    requestAnimationFrame(() => card.classList.add('is-visible'));

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      card.classList.remove('is-visible');
      card.classList.add('is-leaving');
      setTimeout(() => {
        card.remove();
        active = false;
        scheduleNext(3000);
      }, 260);
    }
    close.addEventListener('click', dismiss);
    timer = setTimeout(dismiss, 4200);
  }

  // Read only completed withdrawals; pending or denied requests are never shown.
  window.db.ref('withdrawRequests')
    .orderByChild('status')
    .equalTo('approved')
    .limitToLast(100)
    .on('value', snapshot => {
      const records = [];
      snapshot.forEach(child => {
        const item = child.val() || {};
        const amount = Number(item.amount);
        if (item.status === 'approved' && amount >= 1000 && Number.isFinite(amount)) {
          records.push({
            id: child.key,
            amount,
            phone: item.phone || '',
            method: item.method || ''
          });
        }
      });
      approved = records;
      if (!active && approved.length) scheduleNext(1800);
      if (!approved.length && timer) {
        clearTimeout(timer);
        timer = null;
      }
    });
})();