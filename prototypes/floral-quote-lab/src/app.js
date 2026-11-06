import {createQuote, editQuote, calculateQuote, parseMoney, formatMoney} from './domain.js';

const form = document.querySelector('#calculator');
const total = document.querySelector('#total');
const error = document.querySelector('#error');
let quote = editQuote(createQuote(), {action: 'add', collection: 'items', value: {id: 'example-bouquet', description: 'Fictional garden bouquet', quantity: 2, unitPence: 4550}});
total.textContent = formatMoney(calculateQuote(quote).totalPence);

form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  try {
    const quantity = form.elements.quantity.value;
    if (!/^[1-9]\d*$/.test(quantity)) throw new TypeError('Quantity must be a positive whole number');
    const next = editQuote(quote, {action: 'update', collection: 'items', id: 'example-bouquet', value: {quantity: Number(quantity), unitPence: parseMoney(form.elements.price.value)}});
    quote = next;
    total.textContent = formatMoney(calculateQuote(quote).totalPence);
  } catch (failure) {
    total.textContent = 'Check inputs';
    error.textContent = failure.message;
  }
});
