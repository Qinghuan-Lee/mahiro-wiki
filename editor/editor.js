const form = document.querySelector('#post-form');
const fields = form.elements;
const library = document.querySelector('#library');
const search = document.querySelector('#find');
const pending = document.querySelector('#pending');
const status = document.querySelector('#status');
const publishButton = document.querySelector('#publish');
const deleteButton = document.querySelector('#delete-post');
const writeTab = document.querySelector('#write-tab');
const previewTab = document.querySelector('#preview-tab');
const preview = document.querySelector('#preview');
const confirmDialog = document.querySelector('#confirm');
const fieldNames = ['id', 'title', 'date', 'category', 'summary', 'cover', 'readingTime', 'body'];
let catalog = { posts: [], covers: [], changes: {}, pendingCommits: 0 };
let article = null;
let dirty = false;
let busy = false;

async function request(path, data) {
  const response = await fetch(path, data === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function notify(message, error = false) {
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle('error', error);
}

function displayState() {
  const changes = Object.values(catalog.changes);
  const deletions = changes.filter(change => change === 'deleted').length;
  const counts = [];
  if (changes.length) counts.push(`${changes.length} 篇待发布`);
  if (deletions) counts.push(`含 ${deletions} 篇删除`);
  if (catalog.pendingCommits) counts.push(`${catalog.pendingCommits} 个提交待推送`);
  pending.textContent = counts.join(' · ') || `${catalog.posts.length} 篇文章`;
  publishButton.disabled = busy || !(dirty || changes.length || catalog.pendingCommits);
  document.querySelector('#edit-state').textContent = dirty ? '有未保存的改动' : '';
  form.inert = busy;
}

async function run(task) {
  if (busy) return;
  busy = true;
  displayState();
  notify('');
  try {
    await task();
  } catch (error) {
    notify(error.message, true);
  } finally {
    busy = false;
    displayState();
  }
}

function refreshList() {
  const query = search.value.trim().toLowerCase();
  const matches = catalog.posts.filter(post =>
    [post.title, post.category, post.id].some(value => value.toLowerCase().includes(query)));
  const labels = { changed: '待发布', draft: '本地草稿', invalid: '需要检查' };
  const rows = matches.map(post => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const title = document.createElement('strong');
    const detail = document.createElement('small');
    button.className = 'library-item';
    button.type = 'button';
    if (post.id === article?.id) button.setAttribute('aria-current', 'true');
    title.textContent = post.title;
    detail.textContent = [post.category, post.date, labels[post.status]].filter(Boolean).join(' · ');
    button.append(title, detail);
    button.addEventListener('click', () => {
      if (post.id === article?.id) return;
      run(async () => {
        if (!await discardChanges()) return;
        loadForm(await request(`/api/posts/${post.id}`));
      });
    });
    item.append(button);
    return item;
  });
  if (!rows.length) {
    const empty = document.createElement('li');
    empty.className = 'library-empty';
    empty.textContent = query ? '没有找到文章' : '还没有文章';
    rows.push(empty);
  }
  library.replaceChildren(...rows);
}

async function refreshCatalog() {
  catalog = await request('/api/library');
  const categories = new Set(catalog.posts.map(post => post.category).filter(Boolean));
  document.querySelector('#categories').replaceChildren(
    ...Array.from(categories, category => new Option(category, category)),
  );
  const selectedCover = fields.cover.value;
  fields.cover.replaceChildren(
    new Option('默认插画', ''),
    ...catalog.covers.map(cover => new Option(cover.slice('assets/'.length), cover)),
  );
  fields.cover.value = selectedCover;
  refreshList();
  displayState();
}

function localDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function showPreview(active) {
  fields.body.hidden = active;
  preview.hidden = !active;
  writeTab.setAttribute('aria-pressed', String(!active));
  previewTab.setAttribute('aria-pressed', String(active));
}

function showCover() {
  const cover = fields.cover.value || 'assets/covers/desk.svg';
  document.querySelector('#cover-preview').src = '/' + cover.split('/').map(encodeURIComponent).join('/');
}

function loadForm(post = null) {
  article = post;
  const defaults = { date: localDate(), category: '生活阅读' };
  for (const name of fieldNames) fields[name].value = post?.[name] ?? defaults[name] ?? '';
  fields.id.readOnly = Boolean(post);
  document.querySelector('#editor-title').textContent = post ? '编辑文章' : '新文章';
  deleteButton.hidden = !post;
  dirty = false;
  showPreview(false);
  showCover();
  refreshList();
  displayState();
}

function confirmAction(title, description, action) {
  document.querySelector('#confirm-title').textContent = title;
  document.querySelector('#confirm-description').textContent = description;
  document.querySelector('#confirm-action').textContent = action;
  confirmDialog.returnValue = '';
  confirmDialog.showModal();
  return new Promise(resolve => {
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'confirm'), { once: true });
  });
}

function discardChanges() {
  if (!dirty) return true;
  return confirmAction('放弃未保存的改动？', '切换前可先把这篇文章保存到本地。', '放弃改动');
}

function validateForm() {
  const invalid = form.querySelector(':invalid');
  if (invalid === fields.body) showPreview(false);
  if (invalid === fields.id) fields.id.closest('details').open = true;
  return form.reportValidity();
}

async function save() {
  const data = Object.fromEntries(fieldNames.map(name => [name, fields[name].value]));
  const saved = await request('/api/save', { ...data, revision: article?.revision ?? null });
  loadForm(saved);
  await refreshCatalog();
}

search.addEventListener('input', refreshList);
form.addEventListener('input', () => {
  dirty = true;
  displayState();
});
fields.cover.addEventListener('change', showCover);
form.noValidate = true;
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!validateForm()) return;
  run(async () => {
    await save();
    notify('已保存到本地，点击「发布到网站」即可上线。');
  });
});

document.querySelector('#new-post').addEventListener('click', () => {
  run(async () => {
    if (!await discardChanges()) return;
    loadForm();
  });
});

deleteButton.addEventListener('click', () => {
  run(async () => {
    if (!await confirmAction('删除这篇文章？', `发布后，「${article.title}」会从网站移除。`, '删除文章')) return;
    const result = await request('/api/delete', { id: article.id, revision: article.revision });
    loadForm();
    await refreshCatalog();
    notify(result.message);
  });
});

writeTab.addEventListener('click', () => showPreview(false));
previewTab.addEventListener('click', () => {
  run(async () => {
    const { html } = await request('/api/preview', { body: fields.body.value });
    // Raw HTML is disabled by the server-side Markdown renderer.
    preview.innerHTML = html || '<p>写下正文后，就能在这里预览。</p>';
    showPreview(true);
  });
});

publishButton.addEventListener('click', () => {
  if (dirty && !validateForm()) return;
  run(async () => {
    if (dirty) await save();
    const changes = Object.keys(catalog.changes).length;
    const description = changes
      ? `将提交并推送 ${changes} 篇文章的本地改动。首页会在部署完成后更新。`
      : '将推送本地待发布的提交。';
    if (!await confirmAction('发布到网站？', description, '确认发布')) return;
    notify('正在推送到 GitHub…');
    try {
      const result = await request('/api/publish', {});
      await refreshCatalog();
      notify(result.message);
    } catch (error) {
      await refreshCatalog().catch(() => {});
      throw error;
    }
  });
});

window.addEventListener('beforeunload', event => {
  if (!dirty) return;
  event.preventDefault();
});

loadForm();
run(refreshCatalog);
