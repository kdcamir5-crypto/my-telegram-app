/* Withdrawal & account verification (section 8) */

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
