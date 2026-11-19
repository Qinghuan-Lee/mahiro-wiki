const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

const timeFormat = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit', minute: '2-digit', hour12: false,
});
const dateFormat = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
});

function greetingFor(hour) {
  if (hour < 11) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function renderCalendar(calendar, now) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells = document.createDocumentFragment();

  for (const weekday of weekdays) {
    const cell = document.createElement('span');
    cell.className = 'weekday';
    cell.textContent = weekday;
    cells.append(cell);
  }

  for (let index = 0; index < cellCount; index++) {
    const cell = document.createElement('span');
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) {
      cell.className = 'empty-day';
      cell.setAttribute('aria-hidden', 'true');
    } else {
      cell.textContent = day;
      if (day === today) {
        cell.className = 'today';
        cell.setAttribute('aria-current', 'date');
      }
    }
    cells.append(cell);
  }
  calendar.replaceChildren(cells);
}

export function startClock() {
  const greeting = document.querySelector('#greeting-time');
  const clock = document.querySelector('#clock');
  const clockDate = document.querySelector('#clock-date');
  const monthLabel = document.querySelector('#month-label');
  const calendar = document.querySelector('#calendar-grid');
  let previousDate;

  function updateClock() {
    const now = new Date();
    clock.textContent = timeFormat.format(now);
    greeting.textContent = greetingFor(now.getHours());

    const date = dateFormat.format(now);
    if (date !== previousDate) {
      clockDate.textContent = date;
      const month = String(now.getMonth() + 1).padStart(2, '0');
      monthLabel.textContent = `${now.getFullYear()} / ${month}`;
      renderCalendar(calendar, now);
      previousDate = date;
    }
  }

  updateClock();
  window.setInterval(updateClock, 60_000);
}
