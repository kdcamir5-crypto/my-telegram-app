/* Global app state + user ID resolver (section 3) */

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
