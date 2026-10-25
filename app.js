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

const now = new Date();
let currentYear  = now.getFullYear();
let currentMonth = now.getMonth();
let selectedDate = null;
let selectedSlot = null;
let selectedLocationKey = null;

// Ziębice runs weekdays, Wrocław runs weekends — mirrors lib/booking.js on the server.
const BOOKING_LOCATIONS = {
  ziebice: { name: 'Ziębice', address: 'ul. Przykładowa 1, Ziębice', allowedDays: [1, 2, 3, 4, 5] },
  wroclaw: { name: 'Wrocław', address: 'ul. Przykładowa 2, Wrocław', allowedDays: [0, 6] },
};

function locationKeyForDay(dayOfWeek) {
  return Object.keys(BOOKING_LOCATIONS).find(key => BOOKING_LOCATIONS[key].allowedDays.includes(dayOfWeek)) || null;
}

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

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
    const isPast = thisDay < new Date(today.getFullYear(), today.getMonth(), today.getDate());

    cell.textContent = d;
    let cls = 'cal-cell';

    if (d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      cls += ' today';
    }
    if (isPast) {
      cls += ' past';
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

function resetBookingPanels() {
  document.getElementById('timeSlots').innerHTML = '<p class="slots-hint">Wybierz datę, aby zobaczyć dostępne godziny</p>';
  document.getElementById('bookingForm').style.display = 'none';
  document.getElementById('bookingLocation').style.display = 'none';
  document.getElementById('bookingSuccess').style.display = 'none';
}

function selectDate(d) {
  selectedDate = { d, m: currentMonth, y: currentYear };
  selectedSlot = null;
  renderCalendar();
  loadTimeSlots(d);
}

async function loadTimeSlots(day) {
  const container = document.getElementById('timeSlots');
  const form       = document.getElementById('bookingForm');
  const locationBox = document.getElementById('bookingLocation');
  document.getElementById('bookingSuccess').style.display = 'none';
  form.style.display = 'none';

  const dow = new Date(currentYear, currentMonth, day).getDay();
  selectedLocationKey = locationKeyForDay(dow);
  const loc = BOOKING_LOCATIONS[selectedLocationKey];

  locationBox.style.display = 'flex';
  locationBox.textContent = `📍 ${loc.name} — ${loc.address}`;

  container.innerHTML = `
    <p style="font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--mid);margin-bottom:10px;">
      Dostępne godziny – ${MONTHS_PL[currentMonth].slice(0,3)} ${day}
    </p>
    <p class="slots-hint">Sprawdzanie dostępności…</p>
  `;

  const d = dateStr(currentYear, currentMonth, day);

  try {
    const response = await fetch(`/api/booking-availability?location=${selectedLocationKey}&date=${d}`);
    let data = null;
    try { data = await response.json(); } catch (parseErr) { data = null; }
    if (!response.ok || !data) {
      throw new Error((data && data.error) || 'Nie udało się połączyć z systemem rezerwacji. Spróbuj ponownie.');
    }
    renderSlotGrid(day, data.slots, new Set(data.taken));
  } catch (err) {
    container.innerHTML = `<p class="slots-hint">${err.message}</p>`;
  }
}

function renderSlotGrid(day, allSlots, takenSlots) {
  const container = document.getElementById('timeSlots');
  const form       = document.getElementById('bookingForm');

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
      document.getElementById('bookingError').style.display = 'none';
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
  resetBookingPanels();
});
document.querySelector('.cal-nav:last-child').addEventListener('click', () => {
  if (currentMonth === 11) { currentMonth = 0; currentYear++; }
  else currentMonth++;
  selectedDate = null; selectedSlot = null;
  renderCalendar();
  resetBookingPanels();
});

// Confirm booking button
document.getElementById('confirmBtn').addEventListener('click', async () => {
  const errorEl = document.getElementById('bookingError');
  errorEl.style.display = 'none';

  const name = document.getElementById('bfName').value.trim();
  const email = document.getElementById('bfEmail').value.trim();
  const phone = document.getElementById('bfPhone').value.trim();
  const service = document.getElementById('bfService').value;
  const notes = document.getElementById('bfNotes').value.trim();

  if (!name || !email || !phone || !service) {
    errorEl.textContent = 'Proszę wypełnić wszystkie wymagane pola.';
    errorEl.style.display = 'block';
    return;
  }
  if (!selectedDate || !selectedSlot || !selectedLocationKey) {
    errorEl.textContent = 'Wybierz datę i godzinę.';
    errorEl.style.display = 'block';
    return;
  }

  const confirmBtn = document.getElementById('confirmBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Rezerwowanie…';

  const d = selectedDate;
  let response;

  try {
    response = await fetch('/api/create-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: selectedLocationKey,
        date: dateStr(d.y, d.m, d.d),
        time: selectedSlot,
        service,
        customer: { name, email, phone },
        notes,
      }),
    });

    let data = null;
    try { data = await response.json(); } catch (parseErr) { data = null; }
    if (!response.ok || !data) throw new Error((data && data.error) || 'Nie udało się zapisać rezerwacji. Spróbuj ponownie.');

    const loc = BOOKING_LOCATIONS[selectedLocationKey];
    const successEl = document.getElementById('bookingSuccess');
    successEl.innerHTML = `
      <h4>✅ Rezerwacja potwierdzona</h4>
      <p>${DAY_NAMES[(new Date(d.y, d.m, d.d).getDay() + 6) % 7]}, ${d.d} ${MONTHS_PL[d.m]} ${d.y} o ${selectedSlot}</p>
      <p>${loc.name} — ${loc.address}</p>
      <p>Numer rezerwacji: ${data.bookingId}</p>
      <p>Potwierdzenie zostało wysłane na ${email}.</p>
    `;
    successEl.style.display = 'block';
    document.getElementById('bookingForm').style.display = 'none';
    document.getElementById('bookingLocation').style.display = 'none';
    document.getElementById('timeSlots').innerHTML = '';
    selectedDate = null; selectedSlot = null;
    renderCalendar();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    // Someone may have just taken this slot — refresh availability.
    if (response && response.status === 409 && selectedDate) {
      loadTimeSlots(selectedDate.d);
    }
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Zarezerwuj termin';
  }
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

// ── CHECKOUT ─────────────────────────────
// Free public token from https://manager.paczkomaty.pl/ → Moje konto → API → Geowidget
const INPOST_GEOWIDGET_TOKEN = 'YOUR_INPOST_GEOWIDGET_TOKEN';

const FREE_SHIPPING_FROM = 150; // zł
const SHIPPING_FEE = 13.99; // zł

let selectedLocker = null;
let geowidgetLoaded = false;

function openCheckout() {
  if (cart.length === 0) {
    alert('Twój koszyk jest pusty.');
    return;
  }
  toggleCart();
  renderCheckoutSummary();
  document.getElementById('checkoutOverlay').classList.add('open');
  document.getElementById('checkoutModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkoutOverlay').classList.remove('open');
  document.getElementById('checkoutModal').classList.remove('open');
  document.body.style.overflow = '';
}

function cartTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  return { subtotal, shipping, total: subtotal + shipping };
}

function renderCheckoutSummary() {
  const { subtotal, shipping, total } = cartTotals();
  const box = document.getElementById('checkoutSummary');
  const itemsHtml = cart.map(i => `
    <div class="row"><span>${i.name} x${i.qty}</span><span>${i.price * i.qty} zł</span></div>
  `).join('');
  box.innerHTML = `
    ${itemsHtml}
    <div class="row"><span>Dostawa (InPost Paczkomat)</span><span>${shipping === 0 ? 'Darmowa' : shipping.toFixed(2) + ' zł'}</span></div>
    <div class="row total"><span>Razem</span><span>${total.toFixed(2)} zł</span></div>
  `;
}

function openLockerPicker() {
  if (!geowidgetLoaded) {
    const container = document.getElementById('geowidgetContainer');
    const widget = document.createElement('inpost-geowidget');
    widget.setAttribute('token', INPOST_GEOWIDGET_TOKEN);
    widget.setAttribute('language', 'pl');
    widget.setAttribute('config', 'parcelCollect');
    widget.setAttribute('onpoint', 'onInpostPointSelected');
    container.appendChild(widget);
    geowidgetLoaded = true;
  }
  document.getElementById('lockerOverlay').classList.add('open');
  document.getElementById('lockerModal').classList.add('open');
}

function closeLockerPicker() {
  document.getElementById('lockerOverlay').classList.remove('open');
  document.getElementById('lockerModal').classList.remove('open');
}

function onInpostPointSelected(point) {
  const address = point.address_details
    ? `${point.address_details.street || ''} ${point.address_details.building_number || ''}, ${point.address_details.city || ''}`.trim()
    : (point.address && (point.address.line1 || '') + ' ' + (point.address.line2 || '')).trim();

  selectedLocker = { name: point.name, address };

  const el = document.getElementById('lockerSelected');
  el.textContent = `📦 ${selectedLocker.name}${address ? ' — ' + address : ''}`;
  el.classList.add('set');

  closeLockerPicker();
}

async function startPayment() {
  const name = document.getElementById('coName').value.trim();
  const email = document.getElementById('coEmail').value.trim();
  const phone = document.getElementById('coPhone').value.trim();
  const errorEl = document.getElementById('checkoutError');
  errorEl.style.display = 'none';

  if (!name || !email || !phone) {
    errorEl.textContent = 'Wypełnij dane kontaktowe.';
    errorEl.style.display = 'block';
    return;
  }
  if (!selectedLocker) {
    errorEl.textContent = 'Wybierz paczkomat InPost.';
    errorEl.style.display = 'block';
    return;
  }

  const payBtn = document.getElementById('payBtn');
  payBtn.disabled = true;
  payBtn.textContent = 'Przekierowanie do płatności…';

  try {
    const response = await fetch('/api/create-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        customer: { name, email, phone },
        locker: selectedLocker,
      }),
    });

    let data = null;
    try { data = await response.json(); } catch (parseErr) { data = null; }

    if (!response.ok || !data) {
      throw new Error((data && data.error) || 'Nie udało się rozpocząć płatności. Spróbuj ponownie.');
    }

    const { subtotal, shipping, total } = cartTotals();
    localStorage.setItem('odnowina_last_order', JSON.stringify({
      sessionId: data.sessionId,
      items: cart,
      subtotal, shipping, total,
      locker: selectedLocker,
    }));

    window.location.href = data.redirectUrl;
  } catch (err) {
    errorEl.textContent = err.message || 'Wystąpił błąd. Spróbuj ponownie.';
    errorEl.style.display = 'block';
    payBtn.disabled = false;
    payBtn.textContent = 'Zapłać kartą — Przelewy24 →';
  }
}
