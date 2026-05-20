/* ══════════════════════════════════════════
   ODNOWINA – App JavaScript
   ══════════════════════════════════════════ */

// ── BOOKING TAB SWITCHER ──────────────────
function switchTab(tab) {
  const calPanel   = document.getElementById('panelCalendar');
  const booksyPanel = document.getElementById('panelBooksy');
  const tabCal     = document.getElementById('tabCalendar');
  const tabBooksy  = document.getElementById('tabBooksy');

  if (tab === 'booksy') {
    calPanel.style.display   = 'none';
    booksyPanel.style.display = 'block';
    tabBooksy.classList.add('active');
    tabCal.classList.remove('active');
  } else {
    booksyPanel.style.display = 'none';
    calPanel.style.display   = 'block';
    tabCal.classList.add('active');
    tabBooksy.classList.remove('active');
  }
}

// ── NAVBAR scroll effect ──────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

// ── MOBILE NAV toggle ─────────────────────
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');
navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});
// Close on link click
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ── CALENDAR ─────────────────────────────
const MONTHS_PL = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'
];
const DAY_NAMES = ['Pn','Wt','Śr','Cz','Pt','So','Nd'];

let currentYear  = 2026;
let currentMonth = 4; // 0-based, May
let selectedDate = null;
let selectedSlot = null;

// Days that have NO availability (demo)
const unavailableDays = new Set([1, 5, 12, 19, 26, 6, 13, 20, 27]);

function renderCalendar() {
  const grid      = document.getElementById('calGrid');
  const monthSpan = document.getElementById('calMonth');
  monthSpan.textContent = `${MONTHS_PL[currentMonth]} ${currentYear}`;
  grid.innerHTML = '';

  // Day headers
  DAY_NAMES.forEach(d => {
    const cell = document.createElement('div');
    cell.className = 'cal-cell day-name';
    cell.textContent = d;
    grid.appendChild(cell);
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  // Monday-first offset
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < offset; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    grid.appendChild(cell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell    = document.createElement('div');
    const thisDay = new Date(currentYear, currentMonth, d);
    const dayOfWeek = thisDay.getDay(); // 0=Sun,6=Sat
    const isPast = thisDay < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isUnavailable = unavailableDays.has(d);

    cell.textContent = d;
    let cls = 'cal-cell';

    if (d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      cls += ' today';
    }
    if (isPast || isWeekend || isUnavailable) {
      cls += isPast ? ' past' : ' unavailable';
    } else {
      cls += ' available';
      cell.addEventListener('click', () => selectDate(d));
    }
    if (selectedDate && selectedDate.d === d && selectedDate.m === currentMonth && selectedDate.y === currentYear) {
      cls += ' selected';
    }
    cell.className = cls;
    grid.appendChild(cell);
  }
}

function selectDate(d) {
  selectedDate = { d, m: currentMonth, y: currentYear };
  selectedSlot = null;
  renderCalendar();
  renderTimeSlots(d);
}

function renderTimeSlots(day) {
  const container = document.getElementById('timeSlots');
  const form      = document.getElementById('bookingForm');

  // Sample slots; in production these come from your booking backend
  const allSlots = ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'];
  const takenSlots = new Set(day % 2 === 0 ? ['10:00','14:00'] : ['11:00','16:00']);

  container.innerHTML = `
    <p style="font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--mid);margin-bottom:10px;">
      Dostępne godziny – ${MONTHS_PL[currentMonth].slice(0,3)} ${day}
    </p>
    <div class="slots-grid" id="slotsGrid"></div>
  `;
  const grid = document.getElementById('slotsGrid');
  allSlots.forEach(slot => {
    const btn = document.createElement('button');
    btn.className = 'slot-btn' + (takenSlots.has(slot) ? ' taken' : '');
    btn.textContent = slot;
    btn.disabled = takenSlots.has(slot);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSlot = slot;
      form.style.display = 'flex';
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    grid.appendChild(btn);
  });
  form.style.display = 'none';
}

// Calendar navigation
document.querySelector('.cal-nav:first-child').addEventListener('click', () => {
  if (currentMonth === 0) { currentMonth = 11; currentYear--; }
  else currentMonth--;
  selectedDate = null; selectedSlot = null;
  renderCalendar();
  document.getElementById('timeSlots').innerHTML = '<p class="slots-hint">Wybierz datę, aby zobaczyć dostępne godziny</p>';
  document.getElementById('bookingForm').style.display = 'none';
});
document.querySelector('.cal-nav:last-child').addEventListener('click', () => {
  if (currentMonth === 11) { currentMonth = 0; currentYear++; }
  else currentMonth++;
  selectedDate = null; selectedSlot = null;
  renderCalendar();
  document.getElementById('timeSlots').innerHTML = '<p class="slots-hint">Wybierz datę, aby zobaczyć dostępne godziny</p>';
  document.getElementById('bookingForm').style.display = 'none';
});

// Confirm booking button
document.getElementById('confirmBtn').addEventListener('click', () => {
  const inputs = document.querySelectorAll('.booking-form input, .booking-form select');
  let valid = true;
  inputs.forEach(i => { if (!i.value.trim()) valid = false; });
  if (!valid) { alert('Proszę wypełnić wszystkie wymagane pola.'); return; }
  const d = selectedDate;
  alert(`✅ Rezerwacja potwierdzona!\n\n${DAY_NAMES[(new Date(d.y, d.m, d.d).getDay()+6)%7]}, ${d.d} ${MONTHS_PL[d.m]} ${d.y} o ${selectedSlot}\n\nPotwierdzenie zostanie wysłane na podany adres e-mail.`);
  document.getElementById('bookingForm').style.display = 'none';
  selectedDate = null; selectedSlot = null;
  renderCalendar();
  document.getElementById('timeSlots').innerHTML = '<p class="slots-hint">Wybierz datę, aby zobaczyć dostępne godziny</p>';
});

// Init calendar
renderCalendar();

// ── CART ─────────────────────────────────
let cart = [];

function addToCart(btn, name, price) {
  const existing = cart.find(i => i.name === name);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ name, price, qty: 1, id: Date.now() });
  }
  btn.textContent = '✓ Dodano';
  btn.style.background = 'var(--sage-dark)';
  btn.style.color = '#fff';
  setTimeout(() => {
    btn.textContent = 'Do koszyka';
    btn.style.background = '';
    btn.style.color = '';
  }, 1800);
  renderCart();
  // Pulse the FAB
  const fab = document.getElementById('cartFab');
  fab.style.transform = 'scale(1.25)';
  setTimeout(() => fab.style.transform = '', 300);
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  renderCart();
}

function renderCart() {
  const itemsEl  = document.getElementById('cartItems');
  const footerEl = document.getElementById('cartFooter');
  const countEl  = document.getElementById('cartCount');

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  countEl.textContent = totalQty;
  countEl.style.display = totalQty > 0 ? 'flex' : 'none';

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p class="empty-cart">Koszyk jest pusty</p>';
    footerEl.style.display = 'none';
    return;
  }

  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name} ${item.qty > 1 ? `x${item.qty}` : ''}</div>
        <div class="cart-item-price">${item.price * item.qty} zł</div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})" aria-label="Usuń">✕</button>
    </div>
  `).join('');

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cartTotal').textContent = `${total} zł`;
  footerEl.style.display = 'flex';
}

function toggleCart() {
  const overlay = document.getElementById('cartOverlay');
  const drawer  = document.getElementById('cartDrawer');
  const isOpen  = drawer.classList.contains('open');
  overlay.classList.toggle('open', !isOpen);
  drawer.classList.toggle('open', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

// ── NEWSLETTER ───────────────────────────
function subscribeNewsletter(e) {
  e.preventDefault();
  const input = e.target.querySelector('input[type="email"]');
  alert(`✅ Dziękujemy! Adres ${input.value} został zapisany do newslettera.`);
  input.value = '';
}

// ── SMOOTH REVEAL on scroll ──────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(
  '.price-card, .product-card, .video-card, .review-card, .text-block, .img-block, .nocleg-gallery, .nocleg-info'
).forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(28px)';
  el.style.transition = 'opacity .6s ease, transform .6s ease';
  revealObserver.observe(el);
});

document.addEventListener('animationiteration', () => {}, { passive: true });

// Trigger revealed style
const style = document.createElement('style');
style.textContent = `.revealed { opacity: 1 !important; transform: translateY(0) !important; }`;
document.head.appendChild(style);
