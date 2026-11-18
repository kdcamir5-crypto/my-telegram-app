/* Random demo withdrawal notifications. One compact toast at a time. */
(function () {
  'use strict';
  if (window.__activityNotificationsStarted) return;
  window.__activityNotificationsStarted = true;

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

  /* ৫টা নোটিফিকেশন (৫ সেকেন্ড পর পর), তারপর ১ মিনিট বন্ধ, এভাবেই চলবে */
  const batchSize = 5;
  const interval = 5000;       // এক নোটিফিকেশন শুরু থেকে পরেরটা শুরু
  const pauseAfterBatch = 60000; // ১ মিনিট বিরতি
  const exitTime = 400;        // বেরিয়ে যাওয়ার অ্যানিমেশন
  const displayTime = interval - exitTime; // স্ক্রিনে থাকার সময়
  const digits = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 0 });

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
      schedule(0, showNotification);
      return;
    }
    notificationsInBatch = 0;
    schedule(pauseAfterBatch, showNotification);
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

    /* বাঁ পাশ: লোগো + নম্বর */
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

    /* ডান পাশ: মেসেজ + টাকা */
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
