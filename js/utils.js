/* Navigation & utilities: switchView, toast, copy, share (section 11) */

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
