/* Rolling notice marquee speed */

    // নোটিশ মার্কিউ স্পিড ফিক্স
    (function () {
  const el = document.getElementById('rollingNoticeText');
  if (!el) return;
  const SPEED = 55; // px প্রতি সেকেন্ড; বাড়ালে দ্রুত, কমালে ধীরে
  const apply = () => {
    const dur = Math.max(8, el.offsetWidth / SPEED);
    el.style.setProperty('--marquee-dur', dur + 's');
  };
  new MutationObserver(apply).observe(el, { childList: true, characterData: true, subtree: true });
  window.addEventListener('resize', apply);
  apply();
})();
  
