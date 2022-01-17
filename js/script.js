const schemeSvg = document.querySelector('.scheme-svg');
const totalPriceTag = document.querySelector('.total-price');
const menuButton = document.querySelector('.mobile-menu');
const menu = document.querySelector('.menu');
const cost = 100;
let totalPrice = 0;

schemeSvg.addEventListener('click', (event) => {
  if (!event.target.classList.contains('taken')) {
    event.target.classList.toggle('chosen');
    const totalSeats = schemeSvg.querySelectorAll('.chosen').length;
    totalPrice = cost * totalSeats;
    totalPriceTag.textContent = totalPrice;
  }
});
menuButton.addEventListener('click', () => {
  menu.classList.toggle('is-open');
});
