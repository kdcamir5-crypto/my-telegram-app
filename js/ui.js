/* UI synchronization with user data (section 5) */

    /* -------------------------------------------------------------
       5. UI SYNCHRONIZATION WITH USER DATA
       ------------------------------------------------------------- */
    function updateUIWithUserData() {
      if (!currentUser) return;

      const balance = Number(currentUser.balance || 0);
      const adEarning = Number(currentUser.adEarning || 0);
      const referralEarning = Number(currentUser.referralEarning || 0);
      const bonusEarning = Number(currentUser.bonusEarning || 0);
      const newTaskEarning = Number(currentUser.newTaskEarning || 0);
      const totalIncome = adEarning + referralEarning + bonusEarning + newTaskEarning;
      const dailyAdsDone = Number(currentUser.dailyAdsCompleted || 0);
      const adsRemaining = Math.max(0, 50 - dailyAdsDone);

      // Header Elements
      document.getElementById('headerUserName').textContent = currentUser.name || 'Ariyan User';
      document.getElementById('headerUserId').textContent = currentUser.userId || currentUserId;
      document.getElementById('headerBalance').textContent = balance.toFixed(2);
      if (currentUser.profilePhoto) {
        document.getElementById('headerUserAvatar').src = currentUser.profilePhoto;
        document.getElementById('profileBigAvatar').src = currentUser.profilePhoto;
      }

      // Home Page
      document.getElementById('homeAdsDone').textContent = dailyAdsDone;
      document.getElementById('homeBalance').textContent = balance.toFixed(2);

      // Daily Task Page
      document.getElementById('adsRemainingBangla').textContent = `আপনার বাকি আছে ${adsRemaining} টি ad`;
      document.getElementById('adProgressBadge').textContent = `${dailyAdsDone}/50`;
      
      const adsDoneBanner = document.getElementById('adsDoneBanner');
      if (dailyAdsDone >= 50) {
        adsDoneBanner.style.display = 'block';
        document.getElementById('rollingNoticeText').textContent = "আজকের সব বিজ্ঞাপন দেখা সম্পূর্ণ হয়েছে। আগামী কাল আবার চেষ্টা করুন।";
      } else {
        adsDoneBanner.style.display = 'none';
      }
      renderAdSlots(dailyAdsDone);
      renderNewTaskStatus();

      // Earning Page
      document.getElementById('earningTotalDisplay').textContent = totalIncome.toFixed(2);
      document.getElementById('earnFromAds').textContent = adEarning.toFixed(2);
      document.getElementById('earnFromReferral').textContent = referralEarning.toFixed(2);
      document.getElementById('earnFromBonus').textContent = bonusEarning.toFixed(2);
      document.getElementById('earnFromNewTask').textContent = newTaskEarning.toFixed(2);

      // Referral Page
      const refCode = currentUser.referralCode || ('REF' + currentUserId.replace('USR-', ''));
      const refUrl = `https://t.me/freelancingapp_bot/app?startapp=ref-${refCode}`;
      document.getElementById('referralLinkInput').textContent = refUrl;
      document.getElementById('totalRefCount').textContent = currentUser.referrals || 0;
      document.getElementById('refIncomeStats').textContent = referralEarning.toFixed(2);

      // Wallet Page
      document.getElementById('walletLiveBalance').textContent = balance.toFixed(2);
      document.getElementById('walletAdIncome').textContent = adEarning.toFixed(2);
      document.getElementById('walletRefIncome').textContent = referralEarning.toFixed(2);
      document.getElementById('walletBonusIncome').textContent = bonusEarning.toFixed(2);
      document.getElementById('walletTaskIncome').textContent = newTaskEarning.toFixed(2);
      document.getElementById('withdrawModalBalance').textContent = balance.toFixed(2);

      // Profile Page
      document.getElementById('profileUserIdDisplay').textContent = currentUser.userId || currentUserId;
      document.getElementById('profileRefCodeDisplay').textContent = refCode;
      if (!document.getElementById('profileInputName').value && currentUser.name) {
        document.getElementById('profileInputName').value = currentUser.name;
      }
      if (!document.getElementById('profileInputFullName').value && currentUser.fullName) {
        document.getElementById('profileInputFullName').value = currentUser.fullName;
      }
      if (!document.getElementById('profileInputMobile').value && currentUser.mobile) {
        document.getElementById('profileInputMobile').value = currentUser.mobile;
      }
      if (!document.getElementById('profileInputBirthDate').value && currentUser.birthDate) {
        document.getElementById('profileInputBirthDate').value = currentUser.birthDate;
      }
    }
