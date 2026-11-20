const controls = document.querySelector('[data-directory-controls]');
const search = controls.querySelector('input');
const buttons = [...controls.querySelectorAll('button')];
const entries = [...document.querySelectorAll('.directory-grid li')];
const empty = document.querySelector('.module-empty');
let selected = '';

function render() {
  const term = search.value.trim().toLowerCase();
  for (const entry of entries) {
    const matchesKind = !selected || entry.dataset.kind === selected;
    entry.hidden = !matchesKind || !entry.textContent.toLowerCase().includes(term);
  }
  empty.hidden = entries.some(entry => !entry.hidden);
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === selected));
  }
}

search.addEventListener('input', render);
for (const button of buttons) {
  button.addEventListener('click', () => {
    selected = button.dataset.filter;
    render();
  });
}
render();
