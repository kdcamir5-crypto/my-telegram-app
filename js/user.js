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
          // Account does not exist -> Create new account with 30 TK registration bonus
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

      // রেফারারকে খুঁজতে আর পুরো users নোড নামানো হয় না।
      // referralCode = 'REF' + সংখ্যা, তাই সরাসরি users/USR-সংখ্যা/referralCode (ছোট একটা ফিল্ড) পড়া হয়।
      const guessedId = 'USR-' + String(incomingRef).replace(/^REF/, '');

      db.ref('users/' + guessedId + '/referralCode').once('value').then((snap) => {
        if (snap.val() === incomingRef) return [guessedId];
        // পুরনো ফরম্যাটের কোড হলে ইনডেক্স-সহ কুয়েরি (Rules-এ indexOn: referralCode লাগবে), মাত্র ১টা রেজাল্ট
        return db.ref('users').orderByChild('referralCode').equalTo(incomingRef).limitToFirst(1).once('value').then((q) => {
          const ids = [];
          q.forEach((child) => { ids.push(child.key); });
          return ids;
        });
      }).then(async (matchedIds) => {
        for (const referrerId of matchedIds) {
          if (referrerId === currentUserId) continue;
          try {
            // পুরো নোড না নামিয়ে সার্ভারেই +যোগ করা হচ্ছে (increment)
            await db.ref('users/' + referrerId).update({
              balance: firebase.database.ServerValue.increment(30),
              referralEarning: firebase.database.ServerValue.increment(30),
              referrals: firebase.database.ServerValue.increment(1)
            });
            console.log(`Referral reward of 30 TK credited to ${referrerId}`);

            // leaderboard-এর জন্য শুধু দরকারি দুটো ছোট ফিল্ড পড়া হয় (ছবি নয়)
            try {
              const [nameSnap, refSnap] = await Promise.all([
                db.ref('users/' + referrerId + '/name').once('value'),
                db.ref('users/' + referrerId + '/referrals').once('value')
              ]);
              await db.ref('leaderboard/' + referrerId).update({
                userId: referrerId,
                name: String(nameSnap.val() || 'User').slice(0, 30),
                referrals: Number(refSnap.val() || 0)
              });
            } catch (lbErr) { console.warn('leaderboard update failed', lbErr); }

            await db.ref('users/' + referrerId + '/referralList/' + currentUserId).set({
              referredUserId: currentUserId,
              date: firebase.database.ServerValue.TIMESTAMP,
              bonusAwarded: 30
            });
          } catch (err) {
            console.error("Referral reward error:", err);
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
            // শুধু আজকের বিজ্ঞাপন গণনা রিসেট হয়। নিউ টাস্ক (completedTasks) একবার সম্পন্ন হলে আর কখনো রিসেট হয় না।
            userRef.update({
              dailyAdsCompleted: 0,
              lastTaskDate: today
            });
            return;
          }

          updateUIWithUserData();
        }
      });

      // Sponsorship টাস্ক (অ্যাডমিন প্যানেল থেকে যোগ হয়) — ডুপ্লিকেট listener জমে না
      initSponsorships();

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
