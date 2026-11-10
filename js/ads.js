/* Daily ad task + Monetag integration (section 6) — hero card UI, ৭টি বিজ্ঞাপনের পর ৫ মিনিট বিরতি, শুধু Monetag 'valued' হলে রিওয়ার্ড */

    /* -------------------------------------------------------------
       6. DAILY TASK & MONETAG AD INTEGRATION
       ------------------------------------------------------------- */

    // ====== সেটিংস (এখানে বদলালেই হবে) ======
    const DAILY_AD_LIMIT = 15;          // দৈনিক সর্বোচ্চ বিজ্ঞাপন সংখ্যা
    const AD_REWARD = 10;                // প্রতিটি বিজ্ঞাপনের টাকা
    const AD_BREAK_AFTER = 7;           // এতগুলো বিজ্ঞাপন দেখার পর একবার বিরতি
    const AD_BREAK_SECONDS = 300;       // বিরতির সময় (সেকেন্ডে) = ৫ মিনিট
    const AD_BREAK_MS = AD_BREAK_SECONDS * 1000;
    // =========================================

    let serverTimeOffset = 0;
    let adCooldownTimer = null;
    let adWatchTimeout = null;

    // Firebase সার্ভারের সময় ব্যবহার করা হচ্ছে, যাতে ইউজার ফোনের ঘড়ি বদলে ফাঁকি দিতে না পারে
    db.ref('.info/serverTimeOffset').on('value', (snap) => {
      serverTimeOffset = Number(snap.val()) || 0;
    });

    function serverNow() {
      return Date.now() + serverTimeOffset;
    }

    // শেষ বিজ্ঞাপনের পর আর কত মিলিসেকেন্ড অপেক্ষা বাকি (০ মানে এখনই দেখা যাবে)
    function getAdCooldownLeftMs(userData) {
      const done = Number(userData && userData.dailyAdsCompleted || 0);
      if (done !== AD_BREAK_AFTER) return 0;   // বিরতি শুধু ৭টি দেখার পর
      const last = Number(userData && userData.lastAdAt || 0);
      if (!last) return 0;
      const left = AD_BREAK_MS - (serverNow() - last);
      return Math.min(AD_BREAK_MS, Math.max(0, left));
    }

    // মিলিসেকেন্ড থেকে m:ss
    function formatBreakTime(ms) {
      const total = Math.max(0, Math.ceil(ms / 1000));
      return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
    }

    function startAdCooldownTimer() {
      if (adCooldownTimer) clearInterval(adCooldownTimer);
      adCooldownTimer = setInterval(() => {
        const left = getAdCooldownLeftMs(currentUser);
        if (left <= 0) {
          clearInterval(adCooldownTimer);
          adCooldownTimer = null;
          renderAdHero();
          return;
        }
        const el = document.getElementById('adCooldownText');
        if (el) el.textContent = formatBreakTime(left);
      }, 1000);
    }

    function setTextById(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    // টাস্ক পেজের উপরের বড় বিজ্ঞাপন কার্ড (আয়, আজকের হিসাব, একটিমাত্র বাটন)
    function renderAdHero() {
      const btn = document.getElementById('adHeroBtn');
      if (!btn) return;

      if (adCooldownTimer) {
        clearInterval(adCooldownTimer);
        adCooldownTimer = null;
      }

      const done = Number(currentUser && currentUser.dailyAdsCompleted || 0);
      const left = Math.max(0, DAILY_AD_LIMIT - done);
      const cooldownLeft = getAdCooldownLeftMs(currentUser);

      setTextById('adHeroReward', '৳' + AD_REWARD.toFixed(2));
      setTextById('homeAdReward', '৳' + AD_REWARD.toFixed(2));
      setTextById('adHeroDone', done + ' টি');
      setTextById('adHeroEarn', '৳ ' + (done * AD_REWARD).toFixed(2));

      btn.classList.remove('is-wait', 'is-done');
      let hint = '';
      hint = 'প্রথম ' + AD_BREAK_AFTER + 'টি বিজ্ঞাপনের পর ' + (AD_BREAK_SECONDS / 60) + ' মিনিট বিরতি, তারপর বাকি ' + (DAILY_AD_LIMIT - AD_BREAK_AFTER) + 'টি';

      if (!currentUser) {
        btn.disabled = true;
        btn.classList.add('is-wait');
        btn.innerHTML = '<i class="fa-solid fa-spinner"></i> লোড হচ্ছে...';
      } else if (done >= DAILY_AD_LIMIT) {
        btn.disabled = true;
        btn.classList.add('is-done');
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> আজকের সব বিজ্ঞাপন সম্পন্ন';
        hint = 'আগামীকাল আবার নতুন বিজ্ঞাপন পাবেন';
      } else if (isWatchingAd) {
        btn.disabled = true;
        btn.classList.add('is-wait');
        btn.innerHTML = '<i class="fa-solid fa-spinner"></i> বিজ্ঞাপন লোড হচ্ছে...';
      } else if (cooldownLeft > 0) {
        btn.disabled = true;
        btn.classList.add('is-wait');
        btn.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> পরের বিজ্ঞাপন <span id="adCooldownText">' + formatBreakTime(cooldownLeft) + '</span> পর';
        startAdCooldownTimer();
      } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> বিজ্ঞাপন শুরু করুন (' + left + ' টি বাকি | আজ ' + done + '/' + DAILY_AD_LIMIT + ')';
      }
      setTextById('adHeroHint', hint);
    }

    function finishWatching() {
      isWatchingAd = false;
      if (adWatchTimeout) {
        clearTimeout(adWatchTimeout);
        adWatchTimeout = null;
      }
      renderAdHero();
    }

    function startWatchingAd() {
      if (isWatchingAd) return;
      if (!currentUser) return;
      if (Number(currentUser.dailyAdsCompleted || 0) >= DAILY_AD_LIMIT) {
        showToast("আজকের সব বিজ্ঞাপন দেখা সম্পূর্ণ হয়েছে।");
        return;
      }

      // বিজ্ঞাপন দেখানোর আগেই বিরতি চেক করা হয়, যাতে অপেক্ষা করতে হলে বিজ্ঞাপন চালুই না হয়
      const cooldownLeft = getAdCooldownLeftMs(currentUser);
      if (cooldownLeft > 0) {
        showToast('পরের বিজ্ঞাপনের জন্য আরও ' + Math.ceil(cooldownLeft / 1000) + ' সেকেন্ড অপেক্ষা করুন।');
        return;
      }

      isWatchingAd = true;
      renderAdHero();
      // বিজ্ঞাপন ২ মিনিটেও শেষ/ব্যর্থ না হলে বাটন আবার চালু করে দেওয়া হয়, যাতে আটকে না থাকে
      adWatchTimeout = setTimeout(finishWatching, 120000);
      triggerMonetagAdCall();
    }

    function triggerMonetagAdCall() {
      if (typeof window.show_11981233 !== 'function') {
        finishWatching();
        showToast("বিজ্ঞাপন লোড হয়নি, কিছুক্ষণ পর আবার চেষ্টা করুন।");
        return;
      }
      window.show_11981233({ ymid: String(currentUserId) + '_' + Date.now() }).then((result) => {
        console.log("Monetag result:", result);
        // শুধু Monetag যে বিজ্ঞাপনের টাকা দেবে (valued) সেটার জন্যই ইউজার রিওয়ার্ড পাবে
        if (result && result.reward_event_type === 'valued') {
          awardAdReward();
        } else {
          finishWatching();
          showToast("এই বিজ্ঞাপনের জন্য রিওয়ার্ড প্রযোজ্য নয়, তাই টাকা যোগ হয়নি। আবার চেষ্টা করুন।");
        }
      }).catch((err) => {
        console.warn("Monetag ad error:", err);
        finishWatching();
        showToast("বিজ্ঞাপন দেখানো যায়নি, আবার চেষ্টা করুন।");
      });
    }

    function awardAdReward() {
      if (!currentUser || !currentUserId) {
        finishWatching();
        return;
      }

      const userRef = db.ref('users/' + currentUserId);
      let result = 'none';

      userRef.transaction((data) => {
        result = 'none';
        if (data) {
          const currentAds = Number(data.dailyAdsCompleted || 0);
          const lastAdAt = Number(data.lastAdAt || 0);
          const nowTs = serverNow();

          // ৭টি দেখার পর ৫ মিনিটের বিরতি পূরণ না হলে রিওয়ার্ড দেওয়া হবে না (৩ সেকেন্ড সময়ের গরমিল সহ্য করা হয়)
          if (currentAds === AD_BREAK_AFTER && lastAdAt && (nowTs - lastAdAt) < (AD_BREAK_MS - 3000)) {
            result = 'cooldown';
            return data;
          }
          if (currentAds >= DAILY_AD_LIMIT) {
            result = 'limit';
            return data;
          }

          data.dailyAdsCompleted = currentAds + 1;
          data.adEarning = (Number(data.adEarning) || 0) + AD_REWARD;
          data.balance = (Number(data.balance) || 0) + AD_REWARD;
          data.lastTaskDate = getTodayString();
          data.lastAdAt = nowTs;
          result = 'ok';
        }
        return data;
      }, (error, committed) => {
        finishWatching();
        if (committed && result === 'ok') {
          showToast('আপনি ' + AD_REWARD + ' টাকা reward পেয়েছেন।');
        } else if (committed && result === 'cooldown') {
          showToast("পরের বিজ্ঞাপনের জন্য কিছুক্ষণ অপেক্ষা করতে হবে।");
        } else if (committed && result === 'limit') {
          showToast("আজকের সব বিজ্ঞাপন দেখা সম্পূর্ণ হয়েছে।");
        } else {
          showToast("অ্যাড রিওয়ার্ড যোগ করতে সমস্যা হয়েছে, পুনরায় চেষ্টা করুন।");
        }
      });
    }
