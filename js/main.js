import { startClock } from './clock.js';
import { setupJournal } from './journal.js';
import { posts } from './posts.generated.js';
import { setupReader } from './reader.js';

startClock();
setupJournal(posts);
setupReader(posts);
