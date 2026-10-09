/* Profile & multi-device account sync (section 9) */

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

   
