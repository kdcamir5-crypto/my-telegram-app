/* Freelancing with Ariyan - app logic (moved from index.html, original order kept) */

    /* -------------------------------------------------------------
       1. FIREBASE INITIALIZATION & CONFIGURATION
       ------------------------------------------------------------- */
    const firebaseConfig = {
      apiKey: "AIzaSyDLxotImsTTEAMgOfVKdodefhmcTi9MKfE",
      authDomain: "frelancing-mini-app.firebaseapp.com",
      databaseURL: "https://frelancing-mini-app-default-rtdb.firebaseio.com",
      projectId: "frelancing-mini-app",
      storageBucket: "frelancing-mini-app.firebasestorage.app",
      messagingSenderId: "991264241409",
      appId: "1:991264241409:web:466b311d1af170d15c0d00"
    };

    let app, db;
    try {
      app = firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      console.log("Firebase RTDB initialized successfully");
    } catch (e) {
      console.error("Firebase init failed:", e);
    }

    /* -------------------------------------------------------------
       2. TELEGRAM MINI APP INITIALIZATION
       ------------------------------------------------------------- */
    let tg = window.Telegram?.WebApp;
    if (tg) {
      try {
        tg.expand();
        tg.ready();
        if (tg.setHeaderColor) tg.setHeaderColor('#11182c');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#0a0f1d');
      } catch (err) {
        console.warn("Telegram WebApp expand warning:", err);
      }
    }

    /* -------------------------------------------------------------
       3. GLOBAL APP STATE & CONSISTENT USER ID RESOLVER
       ------------------------------------------------------------- */
    let currentUser = null;
    let currentUserId = null;
    let selectedWithdrawMethod = 'bKash';
    let tempWithdrawData = null;
    let adCountdownInterval = null;
    let isWatchingAd = false;

    // Helper: Formatted Date (YYYY-MM-DD) — Bangladesh (UTC+6) somoy onujayi,
    // jate user-er device-er timezone jai hok na keno, daily reset shothik somoy-e hoy
    function getTodayString() {
      const bdOffsetMs = 6 * 60 * 60 * 1000;
      const bdTime = new Date(Date.now() + bdOffsetMs);
      return bdTime.toISOString().split('T')[0];
    }


    // Resolves a permanent, consistent User ID across Telegram Mini App and standard Web browsers
    function resolveConsistentUserId() {
      // 1. If running inside Telegram Mini App with Telegram user data
      const tgUser = tg?.initDataUnsafe?.user;
      if (tgUser && tgUser.id) {
        // Pura Telegram ID byabohar kora hocche (age sudhu shesh 6 digit newa hoto,
        // jeta duijon vinno user-er ID mile giye account collision-er jhuki toiri korto)
        const tgConsistentId = 'USR-' + String(tgUser.id);
        localStorage.setItem('fwa_persisted_user_id', tgConsistentId);
        return tgConsistentId;
      }


      // 2. Check if user opened with a specific user query parameter ?uid=USR-XXXXXX
      const urlParams = new URLSearchParams(window.location.search);
      const queryUid = urlParams.get('uid');
      if (queryUid && queryUid.startsWith('USR-')) {
        localStorage.setItem('fwa_persisted_user_id', queryUid.toUpperCase());
        return queryUid.toUpperCase();
      }

      // 3. Check browser localStorage for existing permanent ID
      let savedId = localStorage.getItem('fwa_persisted_user_id');
      if (savedId && savedId.startsWith('USR-')) {
        return savedId;
      }

      // 4. Generate a permanent 6-digit numeric User ID: USR-XXXXXX
      const randomSixDigit = Math.floor(100000 + Math.random() * 900000);
      const newId = 'USR-' + randomSixDigit;
      localStorage.setItem('fwa_persisted_user_id', newId);
      return newId;
    }

    // Resolves incoming referral code from URL query (?ref= or ?start=ref-)
    function resolveIncomingReferralCode() {
      const urlParams = new URLSearchParams(window.location.search);
      let ref = urlParams.get('ref');
      if (!ref && tg?.initDataUnsafe?.start_param) {
        let startParam = tg.initDataUnsafe.start_param;
        if (startParam.startsWith('ref-')) {
          ref = startParam.replace('ref-', '');
        } else {
          ref = startParam;
        }
      }
      console.log("URL ba Telegram theke pawa incomingRef:", ref);
  return ref || null;
    }

    /* -------------------------------------------------------------
       4. USER ACCOUNT INITIALIZATION IN FIREBASE
       ------------------------------------------------------------- */
    function initializeUserAccount() {
      currentUserId = resolveConsistentUserId();
      console.log("Current User ID:", currentUserId);

      const userRef = db.ref('users/' + currentUserId);

      // Read single value first to check existence
      userRef.once('value').then((snapshot) => {
        if (snapshot.exists()) {
          // Account exists -> load and bind real-time listener
          console.log("Existing user account loaded:", currentUserId);
          bindRealtimeUserListener();
        } else {
          // Account does not exist -> Create new account with 50 TK registration bonus
          const tgUser = tg?.initDataUnsafe?.user;
          const defaultName = tgUser ? ((tgUser.first_name || '') + ' ' + (tgUser.last_name || '')).trim() : 'Ariyan User';
          const defaultPhoto = tgUser?.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUserId}`;
          const referralCode = 'REF' + currentUserId.replace('USR-', '');

          const newAccountData = {
            userId: currentUserId,
            referralCode: referralCode,
            name: defaultName || 'Ariyan User',
            fullName: '',
            mobile: '',
            birthDate: '',
            profilePhoto: defaultPhoto,
            balance: 30,                // One-time registration bonus
            bonusEarning: 30,           // Included in bonus income
            adEarning: 0,
            referralEarning: 0,
            newTaskEarning: 0,
            dailyAdsCompleted: 0,
            lastTaskDate: getTodayString(),
            referrals: 0,
            registrationBonusClaimed: true,
            createdAt: firebase.database.ServerValue.TIMESTAMP
          };

          // Save to Firebase
          userRef.set(newAccountData).then(() => {
            console.log("New user account created successfully with 30 TK bonus:", currentUserId);
            showToast("অভিনন্দন! একাউন্ট খোলার সাথে সাথে ৩০ টাকা বোনাস পেয়েছেন।");
            
            // Process referral bonus for inviter if incoming referral code exists
            processIncomingReferral(referralCode);
            bindRealtimeUserListener();
          }).catch(err => {
            console.error("Account creation failed:", err);
          });
        }
      }).catch(err => {
        console.error("Error reading user data from Firebase:", err);
      });
    }

    // Process incoming referral bonus (+100 TK for referrer)
    function processIncomingReferral(myRefCode) {
      const incomingRef = resolveIncomingReferralCode();
      console.log("processIncomingReferral execute holo. incomingRef:", incomingRef, "Amar RefCode:", myRefCode);
     if (!incomingRef) {
    console.log("Kono incomingRef pawa jayni, tai referral bonus add hobe na.");
    return;
  }
     if (incomingRef === myRefCode || incomingRef === currentUserId) {
    console.log("Self-referral detect hoyeche, tai ignore kora holo.");
    return;
  }

      // Find user with referralCode in Firebase
      db.ref('users').orderByChild('referralCode').equalTo(incomingRef).once('value').then(async (snap) => {
        console.log("Referrer database-e khuje pawa geche kina (exists):", snap.exists());
        if (snap.exists()) {
          const matchedIds = [];
          snap.forEach((child) => { matchedIds.push(child.key); });

          for (const referrerId of matchedIds) {
            if (referrerId !== currentUserId) {
              // transaction() byabohar kora hocche jate duijon referral eksathe
              // complete hole kono bonus hariye na jay (race condition rokkha)
              try {
                const txResult = await db.ref('users/' + referrerId).transaction((data) => {
                  if (data) {
                    data.balance = (Number(data.balance) || 0) + 50;
                    data.referralEarning = (Number(data.referralEarning) || 0) + 50;
                    data.referrals = (Number(data.referrals) || 0) + 1;
                  }
                  return data;
                });
                if (txResult.committed) {
                  console.log(`Referral reward of 50 TK credited to ${referrerId}`);
                }
              } catch (txErr) {
                console.error("Referral transaction error:", txErr);
              }

              // Log referral record
              db.ref('users/' + referrerId + '/referralList/' + currentUserId).set({
                referredUserId: currentUserId,
                date: firebase.database.ServerValue.TIMESTAMP,
                bonusAwarded: 50
              });
            }
          }
        }
      }).catch(err => {
        console.error("processIncomingReferral query error:", err);
      });
    }

    // Real-time synchronization listener for the current user
    function bindRealtimeUserListener() {
      const userRef = db.ref('users/' + currentUserId);
      userRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
          currentUser = snapshot.val();
          
          // Check daily ad completion reset on date change
          const today = getTodayString();
          if (currentUser.lastTaskDate !== today) {
            userRef.update({
              dailyAdsCompleted: 0,
              lastTaskDate: today,
              completedTasks: null
            });
            return;
          }

          updateUIWithUserData();
        }
      });

      // Task link listener ekhon just 1 bar bind kora hocche (age proti user-update-e
      // notun listener jomto, jeta memory leak ebong onclick re-set korto)
      syncTaskLinksFromFirebase();

     // Listen for rolling notice updates from Firebase
db.ref('notices/rolling').on('value', (snap) => {
    const val = snap.val();
    const noticeElement = document.getElementById('rollingNoticeText');
    if (noticeElement) {
        if (val && typeof val === 'string' && val.trim() !== '') {
            // innerText ব্যবহার করলে ভেতরের marquee ট্যাগের নড়াচড়া নষ্ট হবে না
            noticeElement.innerText = val;
        } else {
            // অ্যাডমিন প্যানেলে নোটিশ ফাঁকা থাকলে এটি দেখাবে
            noticeElement.innerText = "নতুন কোনো নোটিশ নেই।";
        }
    }
});
// Listen for bonus panel notice updates from Firebase
db.ref('notices/bonus').on('value', (snap) => {
    const val = snap.val();
    const bonusElement = document.getElementById('admin-bonus-notice');
    if (bonusElement) {
        if (val && typeof val === 'string' && val.trim() !== '') {
            bonusElement.innerHTML = `<p>${val}</p>`;
        } else {
            bonusElement.innerHTML = `<p>বোনাস পেতে সরাসরি অ্যাডমিনকে মেসেজ করুন।</p>`;
        }
    }
});


      // Listen for withdrawal history
      bindWithdrawalHistoryListener();
    }


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

    /* -------------------------------------------------------------
       7. NEW TASK SECTION & VERIFICATION
       ------------------------------------------------------------- */
    function renderNewTaskStatus() {
      if (!currentUser || !currentUser.completedTasks) return;
      for (let i = 1; i <= 5; i++) {
        if (currentUser.completedTasks[`task_${i}`]) {
          const btn = document.getElementById(`taskBtn-${i}`);
          if (btn) {
            btn.className = 'task-complete-btn btn-task-done';
            btn.innerHTML = '<i class="fa-solid fa-check"></i> সম্পন্ন হয়েছে ✅';
            btn.disabled = true;
          }
        }
      }
    }

    function performNewTask(taskId, targetUrl, taskTitle) {
      if (!currentUser || !currentUserId) return;
      if (currentUser.completedTasks && currentUser.completedTasks[`task_${taskId}`]) {
        showToast("এই টাস্কটি আপনি ইতিমধ্যে সম্পন্ন করেছেন।");
        return;
      }

      window.open(targetUrl, '_blank');
      showToast(`টাস্ক ভেরিফিকেশন চলছে: ${taskTitle}...`);
      
      setTimeout(() => {
        const userRef = db.ref('users/' + currentUserId);
        userRef.transaction((data) => {
          if (data) {
            if (!data.completedTasks) data.completedTasks = {};
            if (!data.completedTasks[`task_${taskId}`]) {
              data.completedTasks[`task_${taskId}`] = true;
              data.newTaskEarning = (Number(data.newTaskEarning) || 0) + 10;
              data.balance = (Number(data.balance) || 0) + 10;
            }
          }
          return data;
        }, (error, committed) => {
          if (committed) {
            showToast(`অভিনন্দন! "${taskTitle}" এর জন্য ১০ টাকা ব্যালেন্সে যোগ হয়েছে।`);
          }
        });
      }, 20000);
    }

    /* -------------------------------------------------------------
       8. WITHDRAWAL & ACCOUNT VERIFICATION SYSTEM
       ------------------------------------------------------------- */
    function openWithdrawModal() {
      if (!currentUser) return;
      document.getElementById('withdrawModalBalance').textContent = Number(currentUser.balance || 0).toFixed(2);
      backToWithdrawStep1();
      document.getElementById('modal-withdraw').classList.add('show');
    }

    function closeWithdrawModal() {
      document.getElementById('modal-withdraw').classList.remove('show');
    }

    function selectPaymentMethod(method) {
      selectedWithdrawMethod = method;
      const bkashCard = document.getElementById('methodBkash');
      const nagadCard = document.getElementById('methodNagad');

      if (method === 'bKash') {
        bkashCard.classList.add('selected');
        nagadCard.classList.remove('selected');
      } else {
        nagadCard.classList.add('selected');
        bkashCard.classList.remove('selected');
      }
    }

    function proceedToVerificationStep() {
      if (!currentUser) return;

      const phone = document.getElementById('withdrawPhoneInput').value.trim();
      const amount = Number(document.getElementById('withdrawAmountInput').value);
      const balance = Number(currentUser.balance || 0);

      if (!phone || phone.length < 11) {
        showToast("সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন।");
        return;
      }
      if (isNaN(amount) || amount < 1000) {
        showToast("উত্তোলনের ন্যূনতম পরিমাণ ১০০০ টাকা।");
        return;
      }
      if (amount > balance) {
        showToast("আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই।");
        return;
      }

      // Rule: check active pending withdrawal
      db.ref('users/' + currentUserId + '/withdrawRequests').orderByChild('status').equalTo('pending').once('value').then((snap) => {
        if (snap.exists()) {
          showToast("আপনার একটি উইথড্র রিকোয়েস্ট ইতিমধ্যে অপেক্ষমান (Pending) রয়েছে। সেটি সম্পন্ন না হওয়া পর্যন্ত নতুন রিকোয়েস্ট দেওয়া যাবে না।");
        } else {
          tempWithdrawData = {
            method: selectedWithdrawMethod,
            phone: phone,
            amount: amount
          };

          document.getElementById('withdrawStep1').style.display = 'none';
          document.getElementById('withdrawStep2').style.display = 'block';
        }
      });
    }

    function backToWithdrawStep1() {
      document.getElementById('withdrawStep1').style.display = 'block';
      document.getElementById('withdrawStep2').style.display = 'none';
    }

    function submitFinalWithdrawal() {
      if (!tempWithdrawData || !currentUser || !currentUserId) return;

      const trxId = document.getElementById('verificationTrxIdInput').value.trim();
      if (!trxId || trxId.length < 4) {
        showToast("দয়া করে সঠিক Transaction ID (TrxID) প্রদান করুন।");
        return;
      }

      const reqId = 'WDR-' + Date.now().toString().slice(-8);
      const requestPayload = {
        id: reqId,
        userId: currentUserId,
        userName: currentUser.name || 'User',
        amount: tempWithdrawData.amount,
        method: tempWithdrawData.method,
        phone: tempWithdrawData.phone,
        trxId: trxId,
        feePaid: 150,
        status: 'pending',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };

      const userRef = db.ref('users/' + currentUserId);
      userRef.transaction((data) => {
        if (data) {
          const currentBal = Number(data.balance || 0);
          if (currentBal >= tempWithdrawData.amount) {
            data.balance = currentBal - tempWithdrawData.amount;
          } else {
            return;
          }
        }
        return data;
      }, (error, committed) => {
        if (committed) {
          const updates = {};
          updates['users/' + currentUserId + '/withdrawRequests/' + reqId] = requestPayload;
          updates['withdrawRequests/' + reqId] = requestPayload;

          db.ref().update(updates).then(() => {
            closeWithdrawModal();
            document.getElementById('withdrawPhoneInput').value = '';
            document.getElementById('withdrawAmountInput').value = '';
            document.getElementById('verificationTrxIdInput').value = '';
            tempWithdrawData = null;

            showToast("আপনার উইথড্র রিকোয়েস্ট সফলভাবে জমা হয়েছে! অ্যাডমিন ভেরিফাই করে পেমেন্ট পাঠিয়ে দেবে।");
          });
        } else {
          showToast("ব্যালেন্স কাটাতে ত্রুটি হয়েছে, পুনরায় চেষ্টা করুন।");
        }
      });
    }

    function bindWithdrawalHistoryListener() {
      const historyListEl = document.getElementById('withdrawHistoryList');
      const countEl = document.getElementById('historyCount');

      db.ref('users/' + currentUserId + '/withdrawRequests').limitToLast(15).on('value', (snap) => {
        if (!snap.exists()) {
          historyListEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-dim); font-size:13px;">কোনো পূর্ববর্তী উইথড্র রেকর্ড পাওয়া যায়নি।</div>`;
          countEl.textContent = '০ টি অনুরোধ';
          return;
        }

        const items = [];
        snap.forEach((child) => {
          items.unshift(child.val());
        });

        countEl.textContent = `${items.length} টি অনুরোধ`;
        historyListEl.innerHTML = '';

        items.forEach((item) => {
          const statusClass = item.status === 'approved' ? 'status-approved' : (item.status === 'denied' ? 'status-denied' : 'status-pending');
          const statusLabel = item.status === 'approved' ? 'গৃহীত (Approved)' : (item.status === 'denied' ? 'বাতিল (Denied)' : 'অপেক্ষমান (Pending)');
          const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('bn-BD') : '';

          const row = document.createElement('div');
          row.className = 'history-item';
          row.innerHTML = `
            <div class="hi-left">
              <span class="hi-method-amount">${item.method} - ৳${Number(item.amount).toFixed(2)}</span>
              <span class="hi-date">${item.phone} • TrxID: ${item.trxId || 'N/A'} • ${dateStr}</span>
            </div>
            <span class="hi-status-badge ${statusClass}">${statusLabel}</span>
          `;
          historyListEl.appendChild(row);
        });
      });
    }

    /* -------------------------------------------------------------
       9. PROFILE & MULTI-DEVICE ACCOUNT SYNC
       ------------------------------------------------------------- */
    function saveUserProfile() {
      if (!currentUser || !currentUserId) return;

      const name = document.getElementById('profileInputName').value.trim();
      const fullName = document.getElementById('profileInputFullName').value.trim();
      const mobile = document.getElementById('profileInputMobile').value.trim();
      const birthDate = document.getElementById('profileInputBirthDate').value;

      const updates = {
        name: name || currentUser.name || 'User',
        fullName: fullName || '',
        mobile: mobile || '',
        birthDate: birthDate || ''
      };

      db.ref('users/' + currentUserId).update(updates).then(() => {
        showToast("প্রোফাইল তথ্য সফলভাবে সংরক্ষণ করা হয়েছে।");
      }).catch(() => {
        showToast("প্রোফাইল সেভ করতে সমস্যা হয়েছে।");
      });
    }

    function handleProfilePhotoUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        showToast("ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট হতে হবে।");
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        const base64Data = e.target.result;
        db.ref('users/' + currentUserId).update({
          profilePhoto: base64Data
        }).then(() => {
          showToast("প্রোফাইল ছবি পরিবর্তন সম্পন্ন হয়েছে।");
        });
      };
      reader.readAsDataURL(file);
    }

    function syncExistingAccount() {
      const targetId = document.getElementById('syncUserIdInput').value.trim().toUpperCase();
      if (!targetId || !targetId.startsWith('USR-')) {
        showToast("সঠিক User ID প্রদান করুন (যেমন: USR-108429)");
        return;
      }

      db.ref('users/' + targetId).once('value').then((snap) => {
        if (snap.exists()) {
          localStorage.setItem('fwa_persisted_user_id', targetId);
          currentUserId = targetId;
          bindRealtimeUserListener();
          showToast(`একাউন্ট ${targetId} সফলভাবে লোড হয়েছে!`);
          document.getElementById('syncUserIdInput').value = '';
          switchView('home');
        } else {
          showToast("এই User ID দিয়ে কোনো একাউন্ট খুঁজে পাওয়া যায়নি।");
        }
      });
    }

   

    /* -------------------------------------------------------------
       11. NAVIGATION & UTILITIES
       ------------------------------------------------------------- */
    function switchView(viewName) {
      const views = document.querySelectorAll('.view-content');
      views.forEach(v => v.classList.remove('active'));

      const navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(n => n.classList.remove('active'));

      const targetView = document.getElementById('view-' + viewName);
      if (targetView) {
        targetView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      const targetNav = document.getElementById('nav-' + viewName);
      if (targetNav) {
        targetNav.classList.add('active');
      }
    }

    function showToast(message) {
      const toast = document.getElementById('toast-notification');
      const toastText = document.getElementById('toastMessage');
      toastText.textContent = message;
      toast.classList.add('active');

      setTimeout(() => {
        toast.classList.remove('active');
      }, 3500);
    }

    function copyTextToClipboard(text, successMsg) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast(successMsg || "কপি হয়েছে!");
        });
      } else {
        const tempInput = document.createElement('input');
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        showToast(successMsg || "কপি হয়েছে!");
      }
    }

    function copyReferralLink() {
      const link = document.getElementById('referralLinkInput').textContent;
      copyTextToClipboard(link, "Referral link copy হয়েছে।");
    }

    function shareOnTelegram() {
      const link = document.getElementById('referralLinkInput').textContent;
      const text = encodeURIComponent(`Freelancing with Ariyan এ একাউন্ট খুললেই পাচ্ছেন ৩০ টাকা ইনস্ট্যান্ট বোনাস! প্রতিদিন বিজ্ঞাপন দেখে ও বন্ধুদের রেফার করে আয় করুন:\n\n${link}`);
      window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`, '_blank');
    }

    function shareOnWhatsApp() {
      const link = document.getElementById('referralLinkInput').textContent;
      const text = encodeURIComponent(`Freelancing with Ariyan এ একাউন্ট খুললেই পাচ্ছেন ৩০ টাকা ইনস্ট্যান্ট বোনাস! প্রতিদিন বিজ্ঞাপন দেখে ও বন্ধুদের রেফার করে আয় করুন:\n\n${link}`);
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }

    document.getElementById('headerUserIdBadge').addEventListener('click', () => {
      if (currentUserId) {
        copyTextToClipboard(currentUserId, `User ID (${currentUserId}) কপি হয়েছে।`);
      }
    });
// এটি কোনো ফাংশনের ভিতরে না রেখে একদম আলাদাভাবে বাইরে বসাবেন:
function syncTaskLinksFromFirebase() {
  db.ref('tasks').on('value', (snapshot) => {
    if (!snapshot.exists()) return;
    const tasksData = snapshot.val();

    for (let i = 1; i <= 5; i++) {
      const taskInfo = tasksData[`task_${i}`];
      if (taskInfo && taskInfo.url) {
        const btn = document.getElementById(`taskBtn-${i}`);
        if (btn) {
          btn.setAttribute('onclick', `performNewTask(${i}, '${taskInfo.url}', '${taskInfo.title || 'Task ' + i}')`);
        }
      }
    }
  });
}
    /* -------------------------------------------------------------
       12. APP BOOTSTRAP
       ------------------------------------------------------------- */
    document.addEventListener('DOMContentLoaded', () => {
      console.log("App loaded. Initializing account...");
      initializeUserAccount();
    });

    // নোটিশ মার্কিউ স্পিড ফিক্স
    (function () {
  const el = document.getElementById('rollingNoticeText');
  if (!el) return;
  const SPEED = 55; // px প্রতি সেকেন্ড; বাড়ালে দ্রুত, কমালে ধীরে
  const apply = () => {
    const dur = Math.max(8, el.offsetWidth / SPEED);
    el.style.setProperty('--marquee-dur', dur + 's');
  };
  new MutationObserver(apply).observe(el, { childList: true, characterData: true, subtree: true });
  window.addEventListener('resize', apply);
  apply();
})();
  

function toggleSupportMenu() {
  const options = document.getElementById('supportOptions');
  const arrow = document.getElementById('supportArrow');
  
  options.classList.toggle('active');
  
  if (options.classList.contains('active')) {
    arrow.style.transform = 'rotate(-90deg)';
  } else {
    arrow.style.transform = 'rotate(0deg)';
  }
}
