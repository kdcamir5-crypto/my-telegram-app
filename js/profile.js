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

    // ছবি ছোট করে (সর্বোচ্চ 160x160 JPEG, ~10KB) বানায়, যাতে ডাটাবেস ভারী না হয়
    function shrinkImageToDataUrl(src, size) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = src;
      });
    }

    function handleProfilePhotoUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        showToast("ছবির সাইজ সর্বোচ্চ ৫ মেগাবাইট হতে হবে।");
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        shrinkImageToDataUrl(e.target.result, 160).then((small) => {
          return db.ref('users/' + currentUserId).update({ profilePhoto: small });
        }).then(() => {
          showToast("প্রোফাইল ছবি পরিবর্তন সম্পন্ন হয়েছে।");
        }).catch(() => {
          showToast("ছবি আপলোড করতে সমস্যা হয়েছে।");
        });
      };
      reader.readAsDataURL(file);
    }

    // পুরনো বড় base64 ছবি থাকলে একবার ছোট করে সেভ করে দেয় (ইউজার অ্যাপ খুললেই নিজে নিজে ঠিক হবে)
    let photoShrinkTried = false;
    function shrinkOldPhotoIfNeeded() {
      if (photoShrinkTried || !currentUser || !currentUserId) return;
      const ph = currentUser.profilePhoto;
      if (typeof ph === 'string' && ph.indexOf('data:image') === 0 && ph.length > 30000) {
        photoShrinkTried = true;
        shrinkImageToDataUrl(ph, 160).then((small) => {
          return db.ref('users/' + currentUserId).update({ profilePhoto: small });
        }).catch(() => {});
      }
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

   
