import { startClock } from './clock.js';
import { setupJournal } from './journal.js';
import { posts } from './posts.generated.js';
import { setupReader } from './reader.js';

const legacySections = new Map([
  ['#journal', 'articles.html'],
  ['#categories', 'articles.html#categories'],
  ['#archive', 'archive.html'],
  ['#about', 'about.html'],
]);
const isHome = document.querySelector('#home') !== null;
const destination = isHome && legacySections.get(location.hash);

if (destination) {
  location.replace(destination);
} else {
  if (isHome) startClock();
  setupJournal(posts);
  setupReader(posts);
}
