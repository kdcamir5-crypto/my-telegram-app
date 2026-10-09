/* Daily ad task + Monetag integration (section 6) */

    /* -------------------------------------------------------------
       6. DAILY TASK & MONETAG AD INTEGRATION
       ------------------------------------------------------------- */
    function renderAdSlots(completedCount) {
      const container = document.getElementById('adSlotsContainer');
      container.innerHTML = '';

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
          btnHtml = `<button class="ad-action-btn btn-watch" onclick="startWatchingAd(${i})"><i class="fa-solid fa-play"></i> বিজ্ঞাপন দেখুন</button>`;
        }

        item.className = `ad-slot-item ${statusClass}`;
        item.innerHTML = `
          <div class="ad-slot-info">
            <div class="ad-number-badge">${i}</div>
            <div class="ad-slot-text">
              <span class="ad-slot-name">বিজ্ঞাপন #${i}</span>
              <span class="ad-slot-reward">+৫ টাকা রিওয়ার্ড</span>
            </div>
          </div>
          ${btnHtml}
        `;
        container.appendChild(item);
      }
    }

    function startWatchingAd(adNumber) {
      if (isWatchingAd) return;
      if (!currentUser) return;
      if (currentUser.dailyAdsCompleted >= 50) {
        showToast("আজকের সব বিজ্ঞাপন দেখা সম্পূর্ণ হয়েছে।");
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
      if (!currentUser || !currentUserId) return;

      const userRef = db.ref('users/' + currentUserId);
      userRef.transaction((data) => {
        if (data) {
          const currentAds = Number(data.dailyAdsCompleted || 0);
          if (currentAds < 50) {
            data.dailyAdsCompleted = currentAds + 1;
            data.adEarning = (Number(data.adEarning) || 0) + 5;
            data.balance = (Number(data.balance) || 0) + 5;
            data.lastTaskDate = getTodayString();
          }
        }
        return data;
      }, (error, committed) => {
        isWatchingAd = false;
        if (committed) {
          showToast("আপনি ৫ টাকা reward পেয়েছেন।");
        } else {
          showToast("অ্যাড রিওয়ার্ড যোগ করতে সমস্যা হয়েছে, পুনরায় চেষ্টা করুন।");
        }
      });
    }
