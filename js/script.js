/**
 * Cin.Emma: Interactive IMAX Booking Experience
 * Dynamic SVG seat mapping, snacks cart, and virtual QR boarding pass
 */

(function () {
  'use strict';

  // State
  const state = {
    selectedDate: '27 АПР (ПТ)',
    selectedCinema: 'Multiplex, ТРЦ Аврора',
    selectedTime: '18:00',
    selectedFormat: 'IMAX 3D Laser',
    selectedSeats: new Map(), // key -> { id, row, seat, type, price }
    snacks: {
      popcorn: { name: 'Карамельный попкорн L', price: 120, count: 0 },
      nachos: { name: 'Начос с сырным соусом', price: 95, count: 0 },
      cola: { name: 'Coca-Cola Zero 0.5L', price: 55, count: 0 }
    }
  };

  // DOM Elements
  const schemeSvg = document.querySelector('.scheme-svg');
  const totalPriceTag = document.querySelector('.total-price');
  const seatsCountTag = document.getElementById('selectedSeatsCount');
  const selectedSeatsList = document.getElementById('selectedSeatsList');
  const payButton = document.querySelector('.button-pay');
  const dateItems = document.querySelectorAll('.session-date-item');
  const cinemaSelect = document.querySelector('.select-cinema');
  const timeSelect = document.querySelector('.select-time');
  const formatPills = document.querySelectorAll('.format-pill');
  const menuButton = document.querySelector('.mobile-menu');
  const menu = document.querySelector('.menu');

  // Checkout Modal Elements
  const checkoutModal = document.getElementById('checkoutModal');
  const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
  const checkoutForm = document.getElementById('checkoutForm');
  const checkoutSeatsDetails = document.getElementById('checkoutSeatsDetails');
  const checkoutSnacksDetails = document.getElementById('checkoutSnacksDetails');
  const checkoutTotalSum = document.getElementById('checkoutTotalSum');

  // Ticket Modal Elements
  const ticketModal = document.getElementById('ticketModal');
  const closeTicketBtn = document.getElementById('closeTicketBtn');
  const qrCanvas = document.getElementById('ticketQrCanvas');

  // Snack Counter Buttons
  const snackControls = document.querySelectorAll('.snack-btn');

  // 1. Initialize Seats with Row and Seat numbers based on SVG coordinates
  function initSeatMap() {
    if (!schemeSvg) return;

    const paths = Array.from(schemeSvg.querySelectorAll('path:not(.light)'));
    
    // Sort paths by vertical position (Y), then horizontal position (X)
    const seatData = paths.map((path, idx) => {
      const bbox = path.getBBox();
      return { path, x: bbox.x, y: bbox.y, idx };
    });

    // Cluster into rows by Y (within 20px threshold)
    seatData.sort((a, b) => a.y - b.y);

    const rows = [];
    let currentRow = [];
    let currentY = -999;

    seatData.forEach(item => {
      if (Math.abs(item.y - currentY) > 18) {
        if (currentRow.length > 0) {
          currentRow.sort((a, b) => a.x - b.x);
          rows.push(currentRow);
        }
        currentRow = [item];
        currentY = item.y;
      } else {
        currentRow.push(item);
      }
    });
    if (currentRow.length > 0) {
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
    }

    // Assign Row & Seat attributes
    rows.forEach((row, rowIdx) => {
      const rowNum = rowIdx + 1;
      const isVipRow = rowNum >= rows.length - 1; // Back rows are VIP

      row.forEach((item, seatIdx) => {
        const seatNum = seatIdx + 1;
        const seatType = isVipRow ? 'VIP' : 'Standard';
        const seatPrice = isVipRow ? 220 : 140;

        item.path.dataset.row = rowNum;
        item.path.dataset.seat = seatNum;
        item.path.dataset.type = seatType;
        item.path.dataset.price = seatPrice;
        item.path.setAttribute('id', `seat_r${rowNum}_s${seatNum}`);

        if (isVipRow && !item.path.classList.contains('taken')) {
          item.path.classList.add('vip-seat');
        }

        // Add tooltip
        const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        titleEl.textContent = `Ряд ${rowNum}, Место ${seatNum} (${seatType} — ${seatPrice} ₴)`;
        item.path.appendChild(titleEl);
      });
    });

    // Randomize some realistic occupied seats if none exist
    const available = paths.filter(p => !p.classList.contains('taken'));
    for (let i = 0; i < 22; i++) {
      const randomSeat = available[Math.floor(Math.random() * available.length)];
      if (randomSeat) {
        randomSeat.classList.add('taken');
      }
    }
  }

  // 2. Seat Selection Logic
  if (schemeSvg) {
    schemeSvg.addEventListener('click', (event) => {
      const target = event.target.closest('path:not(.light)');
      if (!target || target.classList.contains('taken')) return;

      target.classList.toggle('chosen');
      const seatKey = target.getAttribute('id');

      if (target.classList.contains('chosen')) {
        state.selectedSeats.set(seatKey, {
          id: seatKey,
          row: target.dataset.row || '1',
          seat: target.dataset.seat || '1',
          type: target.dataset.type || 'Standard',
          price: parseInt(target.dataset.price || '140', 10)
        });
      } else {
        state.selectedSeats.delete(seatKey);
      }

      updateCalculation();
    });
  }

  // 3. Update Totals & Selected Chips
  function updateCalculation() {
    let seatsTotal = 0;
    state.selectedSeats.forEach(s => {
      seatsTotal += s.price;
    });

    let snacksTotal = 0;
    Object.values(state.snacks).forEach(snack => {
      snacksTotal += snack.price * snack.count;
    });

    const grandTotal = seatsTotal + snacksTotal;

    if (totalPriceTag) {
      totalPriceTag.textContent = grandTotal;
    }

    if (seatsCountTag) {
      seatsCountTag.textContent = state.selectedSeats.size;
    }

    // Render Selected Chips
    if (selectedSeatsList) {
      selectedSeatsList.innerHTML = '';
      if (state.selectedSeats.size === 0) {
        selectedSeatsList.innerHTML = '<span class="empty-seats-hint">Нажмите на свободные места на схеме зала</span>';
      } else {
        state.selectedSeats.forEach(seat => {
          const chip = document.createElement('div');
          chip.className = `seat-chip ${seat.type === 'VIP' ? 'chip-vip' : ''}`;
          chip.innerHTML = `
            <span>Р${seat.row} М${seat.seat} <small>(${seat.price}₴)</small></span>
            <button type="button" class="chip-remove" data-id="${seat.id}">&times;</button>
          `;
          selectedSeatsList.appendChild(chip);
        });
      }
    }

    // Enable/Disable pay button
    if (payButton) {
      if (state.selectedSeats.size > 0) {
        payButton.classList.remove('disabled');
        payButton.textContent = `Забронировать (${grandTotal} ₴)`;
      } else {
        payButton.classList.add('disabled');
        payButton.textContent = 'Выберите места';
      }
    }
  }

  // Chip remove handler
  if (selectedSeatsList) {
    selectedSeatsList.addEventListener('click', (e) => {
      if (e.target.classList.contains('chip-remove')) {
        const id = e.target.dataset.id;
        const path = document.getElementById(id);
        if (path) path.classList.remove('chosen');
        state.selectedSeats.delete(id);
        updateCalculation();
      }
    });
  }

  // 4. Date Selection
  dateItems.forEach(item => {
    item.addEventListener('click', () => {
      dateItems.forEach(d => d.classList.remove('active'));
      item.classList.add('active');

      const month = item.querySelector('.session-month').textContent;
      const day = item.querySelector('.session-day').textContent;
      const weekday = item.querySelector('.session-weekday').textContent;
      state.selectedDate = `${day} ${month} (${weekday})`;
    });
  });
  if (dateItems.length > 0) dateItems[0].classList.add('active');

  // Format selection
  formatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      formatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.selectedFormat = pill.dataset.format || pill.textContent.trim();
    });
  });

  if (cinemaSelect) {
    cinemaSelect.addEventListener('change', (e) => {
      state.selectedCinema = e.target.value;
    });
  }

  if (timeSelect) {
    timeSelect.addEventListener('change', (e) => {
      state.selectedTime = e.target.value;
    });
  }

  // 5. Snacks Quantity Counter
  snackControls.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const snackKey = btn.dataset.snack;
      const action = btn.dataset.action;
      const counterEl = document.getElementById(`count_${snackKey}`);

      if (action === 'plus') {
        state.snacks[snackKey].count++;
      } else if (action === 'minus' && state.snacks[snackKey].count > 0) {
        state.snacks[snackKey].count--;
      }

      if (counterEl) {
        counterEl.textContent = state.snacks[snackKey].count;
      }
      updateCalculation();
    });
  });

  // 6. Checkout Drawer Open / Close
  if (payButton) {
    payButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.selectedSeats.size === 0) {
        alert('Пожалуйста, выберите хотя бы одно место на схеме зала!');
        return;
      }
      openCheckout();
    });
  }

  function openCheckout() {
    if (!checkoutModal) return;

    // Fill details
    let seatsListText = [];
    let seatsSum = 0;
    state.selectedSeats.forEach(s => {
      seatsListText.push(`Ряд ${s.row}, Место ${s.seat} [${s.type}]`);
      seatsSum += s.price;
    });
    checkoutSeatsDetails.textContent = seatsListText.join('; ');

    // Snacks
    const activeSnacks = Object.values(state.snacks).filter(s => s.count > 0);
    if (activeSnacks.length > 0) {
      checkoutSnacksDetails.textContent = activeSnacks.map(s => `${s.name} x${s.count} (${s.price * s.count}₴)`).join(', ');
    } else {
      checkoutSnacksDetails.textContent = 'Без дополнительных снеков';
    }

    // Total
    let total = seatsSum;
    activeSnacks.forEach(s => total += s.price * s.count);
    checkoutTotalSum.textContent = `${total} ₴`;

    document.getElementById('checkoutFilmSummary').textContent = 'Мстители: Война Бесконечности';
    document.getElementById('checkoutSessionSummary').textContent = `${state.selectedDate} в ${state.selectedTime} • ${state.selectedFormat}`;
    document.getElementById('checkoutHallSummary').textContent = state.selectedCinema;

    checkoutModal.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }

  function closeCheckout() {
    if (checkoutModal) checkoutModal.classList.remove('is-active');
    document.body.style.overflow = '';
  }

  if (closeCheckoutBtn) closeCheckoutBtn.addEventListener('click', closeCheckout);

  // 7. Booking Confirmation & Ticket Generation
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('userName').value || 'Гость';
      const phone = document.getElementById('userPhone').value || '+380';
      const bookingId = 'IMX-' + Math.floor(100000 + Math.random() * 900000);

      closeCheckout();
      showVirtualTicket({ name, phone, bookingId });
    });
  }

  function showVirtualTicket({ name, phone, bookingId }) {
    if (!ticketModal) return;

    document.getElementById('ticketBookingId').textContent = bookingId;
    document.getElementById('ticketHolder').textContent = name;
    document.getElementById('ticketCinema').textContent = state.selectedCinema.split(',')[0];
    document.getElementById('ticketDateTime').textContent = `${state.selectedDate}, ${state.selectedTime}`;
    document.getElementById('ticketFormat').textContent = state.selectedFormat;

    const seatsFormatted = Array.from(state.selectedSeats.values())
      .map(s => `Р${s.row} М${s.seat}`)
      .join(', ');
    document.getElementById('ticketSeats').textContent = seatsFormatted;

    // Draw stylized QR code matrix on canvas
    drawQrMatrix(qrCanvas, bookingId);

    ticketModal.classList.add('is-active');
    document.body.style.overflow = 'hidden';

    // Save to LocalStorage
    try {
      const history = JSON.parse(localStorage.getItem('cin_emma_tickets') || '[]');
      history.unshift({
        bookingId,
        name,
        date: state.selectedDate,
        time: state.selectedTime,
        seats: seatsFormatted,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('cin_emma_tickets', JSON.stringify(history.slice(0, 10)));
    } catch (e) {}
  }

  function drawQrMatrix(canvas, text) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width || 160;
    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Stylized QR pattern generator
    ctx.fillStyle = '#0f172a';
    const modules = 21;
    const cellSize = Math.floor(size / modules);
    const offset = Math.floor((size - cellSize * modules) / 2);

    // Corner Finder Patterns
    function drawFinder(r, c) {
      ctx.fillRect(offset + c * cellSize, offset + r * cellSize, 7 * cellSize, 7 * cellSize);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(offset + (c + 1) * cellSize, offset + (r + 1) * cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(offset + (c + 2) * cellSize, offset + (r + 2) * cellSize, 3 * cellSize, 3 * cellSize);
    }
    drawFinder(0, 0);
    drawFinder(0, modules - 7);
    drawFinder(modules - 7, 0);

    // Pseudorandom internal bits seeded by bookingId
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) & 0xffffff;

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        // Skip corner finders
        if ((r < 7 && c < 7) || (r < 7 && c >= modules - 7) || (r >= modules - 7 && c < 7)) continue;
        const bit = ((hash ^ (r * 17 + c * 37)) % 7) > 3;
        if (bit) {
          ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  function closeTicket() {
    if (ticketModal) ticketModal.classList.remove('is-active');
    document.body.style.overflow = '';
  }
  if (closeTicketBtn) closeTicketBtn.addEventListener('click', closeTicket);

  const printTicketBtn = document.getElementById('printTicketBtn');
  if (printTicketBtn) {
    printTicketBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // 8. Mobile Menu Toggle
  if (menuButton && menu) {
    menuButton.addEventListener('click', () => {
      menu.classList.toggle('is-open');
    });
  }

  // Initial Run
  initSeatMap();
  updateCalculation();

})();
