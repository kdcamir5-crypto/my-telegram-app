/* App bootstrap (section 12) */

    /* -------------------------------------------------------------
       12. APP BOOTSTRAP
       ------------------------------------------------------------- */
    document.addEventListener('DOMContentLoaded', () => {
      console.log("App loaded. Checking channel/group membership...");
      // অ্যাকাউন্ট তৈরি/লোড হবে gate পাস করার পর (gate.js এর ভেতর থেকে)
      startGate();
    });
