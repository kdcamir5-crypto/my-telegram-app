/* Floating support menu toggle */

function toggleSupportMenu() {
  const options = document.getElementById('supportOptions');
  const arrow = document.getElementById('supportArrow');
  
  options.classList.toggle('active');
  
  if (options.classList.contains('active')) {
    arrow.style.transform = 'rotate(-90deg)';
  } else {
    arrow.style.transform = 'rotate(0deg)';
  }
}
