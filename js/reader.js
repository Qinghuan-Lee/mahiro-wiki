import { postHashPrefix, postLink } from './post-links.js';

export function setupReader(posts) {
  const reader = document.querySelector('#reader');
  const title = document.querySelector('#reader-title');
  const meta = document.querySelector('#reader-meta');
  const summary = document.querySelector('#reader-intro');
  const content = document.querySelector('#reader-content');
  const nextButton = document.querySelector('#next-article');
  const siteTitle = document.title;
  let nextPost;
  let previousFocus;
  let previousHash = '';

  function renderFromHash(event) {
    const hash = location.hash;
    const postId = hash.startsWith(postHashPrefix) ? hash.slice(postHashPrefix.length) : null;
    const postIndex = posts.findIndex(post => post.id === postId);
    if (postIndex === -1) {
      if (reader.open) reader.close();
      return;
    }

    const post = posts[postIndex];
    title.textContent = post.title;
    meta.textContent = [
      post.category,
      post.date.replaceAll('-', '.'),
      ...(post.example ? ['示例文章'] : []),
    ].join(' · ');
    summary.textContent = post.summary;
    // The build renders Markdown with raw HTML disabled.
    content.innerHTML = post.html;
    document.title = `${post.title} · ${siteTitle}`;
    nextPost = posts[(postIndex + 1) % posts.length];
    nextButton.hidden = posts.length < 2;

    if (!reader.open) {
      previousFocus = document.activeElement;
      const oldHash = event ? new URL(event.oldURL).hash : '';
      previousHash = oldHash.startsWith(postHashPrefix) ? '' : oldHash;
      reader.showModal();
      document.body.classList.add('modal-open');
    }
    reader.scrollTop = 0;
  }

  function closeReader() {
    history.replaceState(history.state, '', location.pathname + location.search + previousHash);
    reader.close();
  }

  document.querySelector('#close-reader').addEventListener('click', closeReader);
  reader.addEventListener('cancel', event => {
    event.preventDefault();
    closeReader();
  });
  reader.addEventListener('click', event => {
    if (event.target !== reader) return;
    const { left, right, top, bottom } = reader.getBoundingClientRect();
    const outside = event.clientX < left || event.clientX > right
      || event.clientY < top || event.clientY > bottom;
    if (outside) closeReader();
  });
  reader.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    document.title = siteTitle;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  });
  nextButton.addEventListener('click', () => {
    location.hash = postLink(nextPost);
  });
  window.addEventListener('hashchange', renderFromHash);
  renderFromHash();
}
