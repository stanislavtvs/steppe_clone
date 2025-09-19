const btn = document.getElementById('a11y-btn');
const menu = document.getElementById('a11y-menu');
if (btn && menu) {
  btn.addEventListener('click', () => {
    const opened = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !opened);
    btn.setAttribute('aria-expanded', opened ? 'true' : 'false');
  });
}
