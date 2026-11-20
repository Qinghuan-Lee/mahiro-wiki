import { postLink } from './post-links.js';

function articleCard(template, post) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.querySelector('a').href = postLink(post);
  card.querySelector('img').setAttribute('src', post.cover);
  card.querySelector('.cover-label').textContent = post.category;
  card.querySelector('.example-label').hidden = !post.example;
  card.querySelector('h2').textContent = post.title;
  card.querySelector('p').textContent = post.summary;

  const date = card.querySelector('time');
  date.dateTime = post.date;
  date.textContent = post.date.replaceAll('-', '.');

  if (post.readingTime) {
    card.querySelector('.reading-time').textContent = `阅读约 ${post.readingTime}`;
  }
  return card;
}

function archiveRow(template, post) {
  const row = template.content.firstElementChild.cloneNode(true);
  row.href = postLink(post);
  row.querySelector('.archive-title').textContent = post.title;
  row.querySelector('.archive-category').textContent = post.category;
  const date = row.querySelector('time');
  date.dateTime = post.date;
  date.textContent = post.date.slice(5).replace('-', ' / ');
  return row;
}

function setupFilters(posts) {
  const grid = document.querySelector('#articles');
  const filters = document.querySelector('.filters');
  const search = document.querySelector('#search');
  const empty = document.querySelector('#empty');
  const status = document.querySelector('#result-status');
  const template = document.querySelector('#article-template');
  const categories = new Set(posts.map(post => post.category));
  let selectedCategory = null;

  const buttons = [null, ...categories].map(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = category ?? '全部';
    if (category === null) {
      const count = document.createElement('span');
      count.textContent = ` ${String(posts.length).padStart(2, '0')}`;
      button.append(count);
    }
    button.addEventListener('click', () => {
      selectedCategory = category;
      render();
    });
    filters.append(button);
    return { category, button };
  });

  function render() {
    const term = search.value.trim().toLowerCase();
    const visiblePosts = posts.filter(post => {
      const matchesCategory = selectedCategory === null || post.category === selectedCategory;
      return matchesCategory && post.searchText.includes(term);
    });

    grid.replaceChildren(...visiblePosts.map(post => articleCard(template, post)));
    empty.hidden = visiblePosts.length > 0;
    status.textContent = `共 ${visiblePosts.length} 篇文章`;
    for (const { category, button } of buttons) {
      const selected = category === selectedCategory;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }

  search.addEventListener('input', render);
  document.querySelector('#reset').addEventListener('click', () => {
    selectedCategory = null;
    search.value = '';
    render();
    search.focus();
  });
  render();
}

function setupHighlights(posts) {
  const [latestPost] = posts;
  if (!latestPost) return;

  const latestCard = document.querySelector('#latest-post');
  latestCard.href = postLink(latestPost);
  latestCard.querySelector('b').textContent = latestPost.title;
  latestCard.querySelector('small').textContent = latestPost.teaser ?? latestPost.summary;
  const date = latestCard.querySelector('time');
  date.dateTime = latestPost.date;
  date.textContent = latestPost.date.replaceAll('-', '/');
  latestCard.hidden = false;

  const featuredPost = posts.find(post => post.featured);
  if (featuredPost) {
    const featuredCard = document.querySelector('#featured-post');
    featuredCard.href = postLink(featuredPost);
    document.querySelector('#featured-title').textContent = featuredPost.title;
    featuredCard.hidden = false;
  }

  const randomLink = document.querySelector('#random-link');
  const randomTitle = document.querySelector('#random-title');
  function chooseRandomPost() {
    const index = Math.floor(Math.random() * posts.length);
    const post = posts[index];
    randomLink.href = postLink(post);
    randomTitle.textContent = post.title;
  }

  chooseRandomPost();
  // Keep the displayed recommendation stable until followed.
  document.querySelector('#reader').addEventListener('close', chooseRandomPost);
  document.querySelector('#random-post').hidden = false;
}

export function setupJournal(posts) {
  const archive = document.querySelector('#archive-list');
  if (archive) {
    const template = document.querySelector('#archive-template');
    archive.replaceChildren(...posts.map(post => archiveRow(template, post)));
  }
  if (document.querySelector('#articles')) setupFilters(posts);
  if (document.querySelector('#latest-post')) setupHighlights(posts);
}
