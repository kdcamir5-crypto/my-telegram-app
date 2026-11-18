/* Random demo withdrawal notifications. One compact toast at a time. */
(function () {
  'use strict';
  if (window.__activityNotificationsStarted) return;
  window.__activityNotificationsStarted = true;

  /* ---------- Style ---------- */
  const style = document.createElement('style');
  style.textContent = `
  #activity-notification-host {
    position: fixed !important;
    left: 10px !important;
    right: 10px !important;
    bottom: 78px !important;
    top: auto !important;
    z-index: 99999 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    pointer-events: none !important;
  }
  #activity-notification-host .activity-notification {
    pointer-events: auto !important;
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    width: 100% !important;
    max-width: 420px !important;
    margin: 0 auto !important;
    box-sizing: border-box !important;
    padding: 8px 10px !important;
    background: #f0fdf8 !important;
    border: 1.5px solid #34d399 !important;
    border-radius: 14px !important;
    box-shadow: 0 6px 18px rgba(16, 185, 129, 0.22) !important;
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.22s ease, transform 0.22s ease;
  }
  #activity-notification-host .activity-notification.is-visible {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
  #activity-notification-host .activity-notification.is-leaving {
    opacity: 0 !important;
    transform: translateY(16px) !important;
  }
  #activity-notification-host .activity-notification-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    flex: 0 0 auto;
    min-width: 84px;
  }
  #activity-notification-host .activity-notification-logo {
    display: block !important;
    width: auto !important;
    height: 24px !important;
    max-width: 64px !important;
    object-fit: contain !important;
    background: #ffffff;
    border-radius: 6px;
    padding: 2px 4px;
    box-sizing: content-box;
  }
  #activity-notification-host .activity-notification-number-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  #activity-notification-host .activity-notification-number {
    font-size: 12px;
    font-weight: 700;
    color: #1f2937;
    letter-spacing: 0.2px;
    white-space: nowrap;
    line-height: 1.1;
  }
  #activity-notification-host .activity-notification-demo {
    font-size: 8px;
    font-weight: 700;
    color: #6b7280;
    background: #e5e7eb;
    border-radius: 4px;
    padding: 1px 5px;
    line-height: 1.3;
    letter-spacing: 0.4px;
  }
  #activity-notification-host .activity-notification-content {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    gap: 1px;
  }
  #activity-notification-host .activity-notification-message {
    font-size: 12px;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.35;
  }
  #activity-notification-host .activity-notification-amount {
    font-size: 17px;
    font-weight: 800;
    color: #059669;
    line-height: 1.25;
  }
  #activity-notification-host .activity-notification-close {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #dcf3ea;
    color: #059669;
    font-size: 16px;
    line-height: 24px;
    text-align: center;
    cursor: pointer;
  }
  `;
  document.head.appendChild(style);

  const host = document.createElement('div');
  host.id = 'activity-notification-host';
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);

  const operators = [
    {
      name: 'Grameenphone',
      prefixes: ['017', '013'],
      logo: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Grameenphone_Logo_GP_Logo.svg'
    },
    {
      name: 'Banglalink',
      prefixes: ['019', '014'],
      logo: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Banglalink_Logo_2025.svg'
    },
    {
      name: 'Robi',
      prefixes: ['018'],
      logo: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Robi_Axiata_Limited_-_Robi_Airtel_BD.png'
    },
    {
      name: 'Cirkle',
      prefixes: ['016'],
      logo: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Cirkle_logo.svg'
    },
    {
      name: 'Teletalk',
      prefixes: ['015'],
      logo: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Teletalk.svg'
    }
  ];

  const batchPauses = [60000, 300000, 300000];
  const batchSize = 5;
  const interval = 5000;
  const displayTime = 4780;
  const exitTime = 220;
  const digits = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 0 });

  let batchIndex = 0;
  let notificationsInBatch = 0;
  let active = false;
  let timer = null;

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function randomPhone(operator) {
    const prefix = randomItem(operator.prefixes);
    let d = '';
    for (let i = 0; i < 2; i++) d += Math.floor(Math.random() * 10);
    let tail = '';
    for (let i = 0; i < 2; i++) tail += Math.floor(Math.random() * 10);
    return prefix + d + '****' + tail;
  }

  function schedule(delay, callback) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(callback, delay);
  }

  function scheduleNext() {
    if (notificationsInBatch < batchSize) {
      schedule(interval, showNotification);
      return;
    }

    notificationsInBatch = 0;
    const pause = batchPauses[batchIndex];
    batchIndex = (batchIndex + 1) % batchPauses.length;
    schedule(pause, showNotification);
  }

  function showNotification() {
    if (active) return;
    active = true;

    const operator = randomItem(operators);
    const amount = Math.floor(Math.random() * 9000) + 1001;
    const card = document.createElement('div');
    card.className = 'activity-notification';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-label', 'Demo notification');

    /* left column: logo + number */
    const side = document.createElement('span');
    side.className = 'activity-notification-side';

    const logo = document.createElement('img');
    logo.className = 'activity-notification-logo';
    logo.src = operator.logo;
    logo.alt = operator.name;
    logo.onerror = function () {
      logo.style.display = 'none';
    };

    const numberRow = document.createElement('span');
    numberRow.className = 'activity-notification-number-row';

    const number = document.createElement('span');
    number.className = 'activity-notification-number';
    number.textContent = randomPhone(operator);

    const demo = document.createElement('span');
    demo.className = 'activity-notification-demo';
    demo.textContent = 'DEMO';

    numberRow.append(number, demo);
    side.append(logo, numberRow);

    /* right column: message + amount */
    const content = document.createElement('span');
    content.className = 'activity-notification-content';

    const message = document.createElement('span');
    message.className = 'activity-notification-message';
    message.textContent = 'অভিনন্দন! আপনার উত্তোলন সফল হয়েছে';

    const value = document.createElement('strong');
    value.className = 'activity-notification-amount';
    value.textContent = '৳' + digits.format(amount) + ' টাকা';

    content.append(message, value);

    const close = document.createElement('button');
    close.className = 'activity-notification-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'বন্ধ করুন');
    close.textContent = '×';

    card.append(side, content, close);
    host.appendChild(card);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        card.classList.add('is-visible');
      });
    });

    notificationsInBatch++;
    let dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      if (timer) clearTimeout(timer);
      card.classList.remove('is-visible');
      card.classList.add('is-leaving');
      setTimeout(function () {
        card.remove();
        active = false;
        scheduleNext();
      }, exitTime);
    }

    close.addEventListener('click', dismiss);
    timer = setTimeout(dismiss, displayTime);
  }

  schedule(5000, showNotification);
})();
