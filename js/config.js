/* Firebase config + Telegram Mini App init (sections 1-2) */

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
