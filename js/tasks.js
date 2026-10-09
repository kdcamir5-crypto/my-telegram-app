/* New task section & verification (section 7) */

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
