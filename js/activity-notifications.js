/* Simulated recharge activity notifications — presentation only.
   No Firebase, wallet, balance, or transaction data is read or changed. */
(function () {
  'use strict';
  if (window.__activityNotificationsStarted) return;
  window.__activityNotificationsStarted = true;

  const operators = [
    { name: 'Grameenphone', short: 'GP', className: 'gp' },
    { name: 'Banglalink', short: 'BL', className: 'banglalink' },
    { name: 'Robi', short: 'robi', className: 'robi' },
    { name: 'Airtel', short: 'airtel', className: 'airtel' },
    { name: 'Teletalk', short: 'TT', className: 'teletalk' }
  ];
  const prefixes = ['013', '014', '015', '016', '017', '018', '019'];
  const amounts = [50, 100, 150, 200, 250, 300, 500, 700, 1000];
  const host = document.createElement('div');
  host.id = 'sim-activity-host';
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-label', 'নমুনা রিচার্জ কার্যকলাপ');
  document.body.appendChild(host);

  const pick = list => list[Math.floor(Math.random() * list.length)];
  function maskedNumber() {
    const prefix = pick(prefixes);
    const middle = String(Math.floor(10000 + Math.random() * 90000));
    return prefix + middle.slice(0, 2) + '****' + middle.slice(-1) + String(Math.floor(Math.random() * 10));
  }

  function showActivity() {
    const op = pick(operators);
    const amount = pick(amounts);
    const card = document.createElement('article');
    card.className = 'sim-activity-card';
    card.setAttribute('role', 'status');

    const brand = document.createElement('div');
    brand.className = 'sim-activity-brand ' + op.className;
    brand.textContent = op.short;

    const copy = document.createElement('div');
    copy.className = 'sim-activity-copy';
    const title = document.createElement('div');
    title.className = 'sim-activity-title';
    title.textContent = 'রিচার্জ সম্পন্ন';
    const detail = document.createElement('div');
    detail.className = 'sim-activity-detail';
    detail.textContent = maskedNumber() + ' · ' + op.name;
    const amountLine = document.createElement('div');
    amountLine.className = 'sim-activity-amount';
    amountLine.textContent = '৳' + amount + ' রিচার্জ';
    const demo = document.createElement('span');
    demo.className = 'sim-activity-demo';
    demo.textContent = 'নমুনা কার্যকলাপ';

    const close = document.createElement('button');
    close.className = 'sim-activity-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'বন্ধ করুন');
    close.textContent = '×';

    copy.append(title, detail, amountLine, demo);
    card.append(brand, copy, close);
    host.appendChild(card);
    requestAnimationFrame(() => card.classList.add('is-visible'));

    let removed = false;
    function dismiss() {
      if (removed) return;
      removed = true;
      card.classList.remove('is-visible');
      card.classList.add('is-leaving');
      setTimeout(() => card.remove(), 420);
    }
    close.addEventListener('click', dismiss);
    setTimeout(dismiss, 5700);

    // Keep the stack compact on small screens and slower devices.
    while (host.children.length > 2) host.firstElementChild.remove();
  }

  // First popup appears after a short pause; then one arrives every 3 seconds.
  setTimeout(() => {
    showActivity();
    window.setInterval(showActivity, 3000);
  }, 1800);
})();
