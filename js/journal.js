import { postLink } from './post-links.js';

const groupLabel = {
  year: post => `${post.date.slice(0, 4)} 年`,
  month: post => `${post.date.slice(0, 7).replace('-', ' 年 ')} 月`,
  week: post => {
    const monday = new Date(post.date);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    return `${monday.toISOString().slice(0, 10)} 开始的一周`;
  },
  day: post => post.date,
  category: post => post.category,
};

function setPostRow(row, post, dateLabel) {
  const date = row.querySelector('time');
  const link = row.querySelector('a');
  date.dateTime = post.date;
  date.textContent = dateLabel;
  link.href = postLink(post);
  link.textContent = post.title;
}

function setupArticleIndex(posts) {
  const index = document.querySelector('#articles');
  const buttons = [...document.querySelectorAll('#group-posts button')];
  const categoryField = document.querySelector('#category-field');
  const categories = document.querySelector('#article-category');
  const search = document.querySelector('#search');
  const empty = document.querySelector('#empty');
  const template = document.querySelector('#article-template');
  let grouping = location.hash === '#categories' ? 'category' : 'year';

  for (const category of new Set(posts.map(post => post.category))) {
    categories.add(new Option(category, category));
  }

  function render() {
    const term = search.value.trim().toLowerCase();
    const groups = new Map();
    for (const post of posts) {
      if (!post.searchText.includes(term)) continue;
      if (grouping === 'category' && categories.value && categories.value !== post.category) continue;

      const label = groupLabel[grouping](post);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(post);
    }

    const sections = [];
    for (const [label, entries] of groups) {
      const section = document.createElement('section');
      section.className = 'post-index-group';
      const heading = document.createElement('h2');
      heading.textContent = label;
      const count = document.createElement('span');
      count.textContent = `${entries.length} 篇`;
      heading.append(count);
      const list = document.createElement('ul');
      for (const post of entries) {
        const row = template.content.firstElementChild.cloneNode(true);
        const category = row.querySelector('.post-category');
        setPostRow(row, post, grouping === 'category' ? post.date : post.date.slice(5));
        category.textContent = post.category;
        list.append(row);
      }
      section.append(heading, list);
      sections.push(section);
    }

    index.replaceChildren(...sections);
    categoryField.hidden = grouping !== 'category';
    empty.hidden = groups.size > 0;
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.group === grouping));
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      grouping = button.dataset.group;
      render();
    });
  }
  search.addEventListener('input', render);
  categories.addEventListener('change', render);
  document.querySelector('#reset').addEventListener('click', () => {
    categories.value = '';
    search.value = '';
    render();
    search.focus();
  });
  render();
}

function setupTimeline(posts, list) {
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(posts.length / pageSize));
  const requestedPage = Number(new URLSearchParams(location.search).get('page'));
  const page = Number.isInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, pageCount)) : 1;
  const template = document.querySelector('#archive-template');
  const start = (page - 1) * pageSize;
  for (const post of posts.slice(start, start + pageSize)) {
    const row = template.content.firstElementChild.cloneNode(true);
    setPostRow(row, post, post.date.replaceAll('-', '.'));
    row.querySelector('p').textContent = post.category;
    list.append(row);
  }

  document.querySelector('#archive-empty').hidden = posts.length > 0;
  document.querySelector('.pagination').hidden = pageCount < 2;
  document.querySelector('#page-number').textContent = `${page} / ${pageCount}`;

  const previous = document.querySelector('#previous-page');
  const next = document.querySelector('#next-page');
  if (page > 1) previous.href = page === 2 ? 'archive.html#writing-heading' : `?page=${page - 1}#writing-heading`;
  if (page < pageCount) next.href = `?page=${page + 1}#writing-heading`;
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
  if (archive) setupTimeline(posts, archive);
  if (document.querySelector('#articles')) setupArticleIndex(posts);
  if (document.querySelector('#latest-post')) setupHighlights(posts);
}
