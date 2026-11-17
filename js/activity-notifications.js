/* Random upcoming withdrawal activity preview. One compact toast at a time. */
(function () {
  'use strict';
  if (window.__activityNotificationsStarted) return;
  window.__activityNotificationsStarted = true;

  const host = document.createElement('div');
  host.id = 'activity-notification-host';
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);

  const operators = [
    { name: 'Grameenphone', prefixes: ['017', '013'] },
    { name: 'Banglalink', prefixes: ['019', '014'] },
    { name: 'Robi', prefixes: ['018'] },
    { name: 'Airtel', prefixes: ['016'] },
    { name: 'Teletalk', prefixes: ['015'] }
  ];
  const amounts = [1000, 1200, 1500, 2000, 2500, 3000, 5000, 10000];
  const digits = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 0 });
  let active = false;
  let timer = null;

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }
  function randomPhone(operator) {
    const prefix = randomItem(operator.prefixes);
    let tail = '';
    for (let i = 0; i < 8; i++) tail += Math.floor(Math.random() * 10);
    return prefix + tail.slice(0, 2) + '****' + tail.slice(-2);
  }
  function schedule(delay) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(showNotification, delay);
  }
  function showNotification() {
    if (active) return;
    active = true;

    const operator = randomItem(operators);
    const amount = randomItem(amounts);
    const card = document.createElement('div');
    card.className = 'activity-notification';
    card.setAttribute('role', 'status');

    const symbol = document.createElement('span');
    symbol.className = 'activity-notification-mark';
    symbol.textContent = '৳';

    const content = document.createElement('span');
    content.className = 'activity-notification-content';

    const title = document.createElement('span');
    title.className = 'activity-notification-title';
    title.textContent = 'উত্তোলন সফল';

    const value = document.createElement('strong');
    value.className = 'activity-notification-amount';
    value.textContent = digits.format(amount) + ' টাকা';

    const details = document.createElement('span');
    details.className = 'activity-notification-detail';
    details.textContent = operator.name + ' · ' + randomPhone(operator);

    const upcoming = document.createElement('span');
    upcoming.className = 'activity-notification-upcoming';
    upcoming.textContent = 'Upcoming';

    const close = document.createElement('button');
    close.className = 'activity-notification-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'বন্ধ করুন');
    close.textContent = '×';

    content.append(title, value, details, upcoming);
    card.append(symbol, content, close);
    host.replaceChildren(card);
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
        schedule(600);
      }, 220);
    }
    close.addEventListener('click', dismiss);
    timer = setTimeout(dismiss, 2180);
  }

  schedule(1800);
})();