/* Daily ad task + Monetag integration (section 6) — with 1-minute cooldown between ads */

    /* -------------------------------------------------------------
       6. DAILY TASK & MONETAG AD INTEGRATION
       ------------------------------------------------------------- */

    // ====== সেটিংস (এখানে বদলালেই হবে) ======
    const AD_COOLDOWN_MS = 60 * 1000;   // প্রতিটি বিজ্ঞাপনের পর কত সময় অপেক্ষা (এখন ১ মিনিট)
    // =========================================

    let serverTimeOffset = 0;
    let adCooldownTimer = null;

    // Firebase সার্ভারের সময় ব্যবহার করা হচ্ছে, যাতে ইউজার ফোনের ঘড়ি বদলে ফাঁকি দিতে না পারে
    db.ref('.info/serverTimeOffset').on('value', (snap) => {
      serverTimeOffset = Number(snap.val()) || 0;
    });

    function serverNow() {
      return Date.now() + serverTimeOffset;
    }

    function toBnDigits(n) {
      return String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
    }

    // শেষ বিজ্ঞাপনের পর আর কত মিলিসেকেন্ড অপেক্ষা বাকি (০ মানে এখনই দেখা যাবে)
    function getAdCooldownLeftMs(userData) {
      const last = Number(userData && userData.lastAdAt || 0);
      if (!last) return 0;
      const left = AD_COOLDOWN_MS - (serverNow() - last);
      return Math.min(AD_COOLDOWN_MS, Math.max(0, left));
    }

    function startAdCooldownTimer() {
      if (adCooldownTimer) clearInterval(adCooldownTimer);
      adCooldownTimer = setInterval(() => {
        const left = getAdCooldownLeftMs(currentUser);
        if (left <= 0) {
          clearInterval(adCooldownTimer);
          adCooldownTimer = null;
          renderAdSlots(Number(currentUser && currentUser.dailyAdsCompleted || 0));
          return;
        }
        const el = document.getElementById('adCooldownText');
        if (el) el.textContent = toBnDigits(Math.ceil(left / 1000));
      }, 1000);
    }

    function renderAdSlots(completedCount) {
      const container = document.getElementById('adSlotsContainer');
      container.innerHTML = '';

      if (adCooldownTimer) {
        clearInterval(adCooldownTimer);
        adCooldownTimer = null;
      }
      const cooldownLeft = getAdCooldownLeftMs(currentUser);

      for (let i = 1; i <= 50; i++) {
        const item = document.createElement('div');
        const isCompleted = i <= completedCount;
        const isActive = i === (completedCount + 1);

        let statusClass = 'locked';
        let btnHtml = `<button class="ad-action-btn btn-locked" disabled><i class="fa-solid fa-lock"></i> লক করা</button>`;

        if (isCompleted) {
          statusClass = 'completed';
          btnHtml = `<button class="ad-action-btn btn-completed"><i class="fa-solid fa-circle-check"></i> সম্পন্ন ✅</button>`;
        } else if (isActive) {
          statusClass = 'active';
          if (cooldownLeft > 0) {
            btnHtml = `<button class="ad-action-btn btn-locked" disabled><i class="fa-solid fa-hourglass-half"></i> <span id="adCooldownText">${toBnDigits(Math.ceil(cooldownLeft / 1000))}</span> সেকেন্ড অপেক্ষা</button>`;
          } else {
            btnHtml = `<button class="ad-action-btn btn-watch" onclick="startWatchingAd(${i})"><i class="fa-solid fa-play"></i> বিজ্ঞাপন দেখুন</button>`;
          }
        }

        item.className = `ad-slot-item ${statusClass}`;
        item.innerHTML = `
          <div class="ad-slot-info">
            <div class="ad-number-badge">${i}</div>
            <div class="ad-slot-text">
              <span class="ad-slot-name">বিজ্ঞাপন #${i}</span>
              <span class="ad-slot-reward">+৫ টাকা রিওয়ার্ড</span>
            </div>
          </div>
          ${btnHtml}
        `;
        container.appendChild(item);
      }

      if (cooldownLeft > 0) startAdCooldownTimer();
    }

    function startWatchingAd(adNumber) {
      if (isWatchingAd) return;
      if (!currentUser) return;
      if (currentUser.dailyAdsCompleted >= 50) {
        showToast("আজকের সব বিজ্ঞাপন দেখা সম্পূর্ণ হয়েছে।");
        return;
      }

      // বিজ্ঞাপন দেখানোর আগেই বিরতি চেক করা হয়, যাতে অপেক্ষা করতে হলে বিজ্ঞাপন চালুই না হয়
      const cooldownLeft = getAdCooldownLeftMs(currentUser);
      if (cooldownLeft > 0) {
        showToast(`পরের বিজ্ঞাপনের জন্য আরও ${toBnDigits(Math.ceil(cooldownLeft / 1000))} সেকেন্ড অপেক্ষা করুন।`);
        return;
      }

      isWatchingAd = true;
      triggerMonetagAdCall();
    }

    function triggerMonetagAdCall() {
      if (typeof window.show_11981233 !== 'function') {
        isWatchingAd = false;
        showToast("বিজ্ঞাপন লোড হয়নি, কিছুক্ষণ পর আবার চেষ্টা করুন।");
        return;
      }
      window.show_11981233().then(() => {
        awardAdReward();
      }).catch((err) => {
        console.warn("Monetag ad error:", err);
        isWatchingAd = false;
        showToast("বিজ্ঞাপন দেখানো যায়নি, আবার চেষ্টা করুন।");
      });
    }

    function awardAdReward() {
      if (!currentUser || !currentUserId) {
        isWatchingAd = false;
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

          // দুই বিজ্ঞাপনের মাঝে বিরতি পূরণ না হলে রিওয়ার্ড দেওয়া হবে না (৩ সেকেন্ড সময়ের গরমিল সহ্য করা হয়)
          if (lastAdAt && (nowTs - lastAdAt) < (AD_COOLDOWN_MS - 3000)) {
            result = 'cooldown';
            return data;
          }
          if (currentAds >= 50) {
            result = 'limit';
            return data;
          }

          data.dailyAdsCompleted = currentAds + 1;
          data.adEarning = (Number(data.adEarning) || 0) + 5;
          data.balance = (Number(data.balance) || 0) + 5;
          data.lastTaskDate = getTodayString();
          data.lastAdAt = nowTs;
          result = 'ok';
        }
        return data;
      }, (error, committed) => {
        isWatchingAd = false;
        if (committed && result === 'ok') {
          showToast("আপনি ৫ টাকা reward পেয়েছেন।");
        } else if (committed && result === 'cooldown') {
          showToast("দুই বিজ্ঞাপনের মাঝে ১ মিনিট অপেক্ষা করতে হবে।");
        } else if (committed && result === 'limit') {
          showToast("আজকের সব বিজ্ঞাপন দেখা সম্পূর্ণ হয়েছে।");
        } else {
          showToast("অ্যাড রিওয়ার্ড যোগ করতে সমস্যা হয়েছে, পুনরায় চেষ্টা করুন।");
        }
      });
    }
