/* User account init, referral, realtime listener (section 4) */

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
