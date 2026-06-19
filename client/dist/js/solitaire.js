/* 1. Constants */
const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const RANK_NAMES = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K'
};
const SUIT_SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED_SUITS = new Set(['H', 'D']);
const FOUNDATION_SUITS = ['S', 'H', 'D', 'C'];
const HISTORY_LIMIT = 50;

/* 2. Game State */
let state = {};

/* 3. createDeck + shuffle */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* 4. newGame */
function newGame() {
  clearInterval(state.timerInterval);

  const deck = shuffle(createDeck());
  const tableau = [];
  let idx = 0;

  for (let col = 0; col < 7; col++) {
    const cards = [];
    for (let row = 0; row <= col; row++) {
      cards.push({ ...deck[idx++], faceUp: row === col });
    }
    tableau.push(cards);
  }

  state = {
    tableau,
    stock: deck.slice(idx).map(c => ({ ...c, faceUp: false })),
    waste: [],
    foundations: [[], [], [], []],
    score: 0,
    moves: 0,
    seconds: 0,
    drawMode: state.drawMode || 1,
    history: [],
    timerInterval: null,
    started: false,
    won: false,
  };

  document.getElementById('win-screen').classList.add('hidden');
  document.getElementById('btn-autocomplete').style.display = 'none';
  updateScore();
  updateMoves();
  updateTimer();
  updateDrawModeBtn();
  render();

  state.timerInterval = setInterval(() => {
    if (!state.won) {
      state.seconds++;
      updateTimer();
    }
  }, 1000);
}

/* 5. saveHistory + undo */
function saveHistory() {
  const snapshot = {
    tableau: state.tableau.map(col => col.map(c => ({ ...c }))),
    stock: state.stock.map(c => ({ ...c })),
    waste: state.waste.map(c => ({ ...c })),
    foundations: state.foundations.map(pile => pile.map(c => ({ ...c }))),
    score: state.score,
    moves: state.moves,
  };
  state.history.push(snapshot);
  if (state.history.length > HISTORY_LIMIT) {
    state.history.shift();
  }
}

function undo() {
  if (state.history.length === 0) return;
  const snap = state.history.pop();
  state.tableau = snap.tableau;
  state.stock = snap.stock;
  state.waste = snap.waste;
  state.foundations = snap.foundations;
  state.score = snap.score;
  state.moves = snap.moves;
  updateScore();
  updateMoves();
  tapState.selected = null;
  render();
  checkAutoComplete();
}

/* 6. Move Validation */
function canPlaceOnFoundation(card, pileIdx) {
  const pile = state.foundations[pileIdx];
  const targetSuit = FOUNDATION_SUITS[pileIdx];
  if (card.suit !== targetSuit) return false;
  if (pile.length === 0) return card.rank === 1;
  return card.rank === pile[pile.length - 1].rank + 1;
}

function canPlaceOnTableau(card, colIdx) {
  const col = state.tableau[colIdx];
  if (col.length === 0) return card.rank === 13;
  const top = col[col.length - 1];
  if (!top.faceUp) return false;
  const diffColor = RED_SUITS.has(card.suit) !== RED_SUITS.has(top.suit);
  return diffColor && card.rank === top.rank - 1;
}

function findFoundationForCard(card) {
  for (let i = 0; i < 4; i++) {
    if (canPlaceOnFoundation(card, i)) return i;
  }
  return -1;
}

/* 7. Move Execution */
function drawFromStock() {
  saveHistory();
  if (state.stock.length === 0) {
    state.score = Math.max(0, state.score - 100);
    while (state.waste.length > 0) {
      const c = state.waste.pop();
      c.faceUp = false;
      state.stock.push(c);
    }
    updateScore();
    render();
    return;
  }

  const count = Math.min(state.drawMode, state.stock.length);
  for (let i = 0; i < count; i++) {
    const c = state.stock.pop();
    c.faceUp = true;
    state.waste.push(c);
  }
  state.moves++;
  updateMoves();
  render();
}

function moveWasteToFoundation() {
  if (state.waste.length === 0) return false;
  const card = state.waste[state.waste.length - 1];
  const fIdx = findFoundationForCard(card);
  if (fIdx === -1) return false;
  saveHistory();
  state.waste.pop();
  state.foundations[fIdx].push(card);
  state.score += 10;
  state.moves++;
  updateScore();
  updateMoves();
  render();
  checkWin();
  checkAutoComplete();
  return true;
}

function moveWasteToTableau(colIdx) {
  if (state.waste.length === 0) return false;
  const card = state.waste[state.waste.length - 1];
  if (!canPlaceOnTableau(card, colIdx)) return false;
  saveHistory();
  state.waste.pop();
  card.faceUp = true;
  state.tableau[colIdx].push(card);
  state.score += 5;
  state.moves++;
  updateScore();
  updateMoves();
  render();
  checkAutoComplete();
  return true;
}

function moveTableauToFoundation(colIdx) {
  const col = state.tableau[colIdx];
  if (col.length === 0) return false;
  const card = col[col.length - 1];
  if (!card.faceUp) return false;
  const fIdx = findFoundationForCard(card);
  if (fIdx === -1) return false;
  saveHistory();
  col.pop();
  state.foundations[fIdx].push(card);
  state.score += 10;
  if (col.length > 0 && !col[col.length - 1].faceUp) {
    col[col.length - 1].faceUp = true;
    state.score += 5;
  }
  state.moves++;
  updateScore();
  updateMoves();
  render();
  checkWin();
  checkAutoComplete();
  return true;
}

function moveTableauToTableau(fromCol, cardIdx, toCol) {
  if (fromCol === toCol) return false;
  const srcCol = state.tableau[fromCol];
  const card = srcCol[cardIdx];
  if (!card.faceUp) return false;
  if (!canPlaceOnTableau(card, toCol)) return false;
  saveHistory();
  const moving = srcCol.splice(cardIdx);
  for (const c of moving) {
    state.tableau[toCol].push(c);
  }
  if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
    srcCol[srcCol.length - 1].faceUp = true;
    state.score += 5;
  }
  state.moves++;
  updateScore();
  updateMoves();
  render();
  checkAutoComplete();
  return true;
}

function moveFoundationToTableau(fIdx, colIdx) {
  const pile = state.foundations[fIdx];
  if (pile.length === 0) return false;
  const card = pile[pile.length - 1];
  if (!canPlaceOnTableau(card, colIdx)) return false;
  saveHistory();
  pile.pop();
  card.faceUp = true;
  state.tableau[colIdx].push(card);
  state.score = Math.max(0, state.score - 15);
  state.moves++;
  updateScore();
  updateMoves();
  render();
  checkAutoComplete();
  return true;
}

/* 8. checkWin + showWinScreen */
function checkWin() {
  const total = state.foundations.reduce((s, p) => s + p.length, 0);
  if (total === 52) {
    state.won = true;
    clearInterval(state.timerInterval);
    const timeBonus = Math.floor(700000 / Math.max(30, state.seconds));
    state.score += timeBonus;
    updateScore();
    setTimeout(() => showWinScreen(timeBonus), 600);
  }
}

function showWinScreen(timeBonus) {
  const mins = Math.floor(state.seconds / 60);
  const secs = state.seconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  document.getElementById('win-score').textContent = `Score: ${state.score} (+${timeBonus} time bonus)`;
  document.getElementById('win-time').textContent = `Time: ${timeStr}`;
  document.getElementById('win-screen').classList.remove('hidden');

  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8800', '#ff0088'];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.animationDuration = (2 + Math.random() * 3) + 's';
    piece.style.animationDelay = (Math.random() * 2) + 's';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = (6 + Math.random() * 10) + 'px';
    piece.style.height = (6 + Math.random() * 10) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(piece);
  }
}

/* 9. autoComplete */
function checkAutoComplete() {
  const btn = document.getElementById('btn-autocomplete');
  if (state.stock.length === 0 && state.waste.length === 0) {
    const allFaceUp = state.tableau.every(col => col.every(c => c.faceUp));
    btn.style.display = allFaceUp ? 'inline-flex' : 'none';
  } else {
    btn.style.display = 'none';
  }
}

function autoComplete() {
  if (state.won) return;

  let moved = true;
  let attempts = 0;
  const maxAttempts = 200;

  function step() {
    if (state.won || attempts++ > maxAttempts) return;
    moved = false;

    for (let col = 0; col < 7; col++) {
      if (moveTableauToFoundation(col)) {
        moved = true;
        break;
      }
    }

    if (!state.won) {
      setTimeout(step, 60);
    }
  }

  step();
}

/* 10. Rendering */
function render() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
}

function renderStock() {
  const el = document.getElementById('stock');
  el.innerHTML = '';
  if (state.stock.length > 0) {
    const card = cardElement({ suit: 'S', rank: 0 }, false);
    card.dataset.source = 'stock';
    el.appendChild(card);
  }
}

function renderWaste() {
  const el = document.getElementById('waste');
  el.innerHTML = '';
  if (state.waste.length === 0) return;

  if (state.drawMode === 3 && state.waste.length > 1) {
    const showCount = Math.min(3, state.waste.length);
    const offset = 18;
    for (let i = state.waste.length - showCount; i < state.waste.length; i++) {
      const isTop = i === state.waste.length - 1;
      const posFromTop = (i - (state.waste.length - showCount));
      const card = cardElement(state.waste[i], true);
      card.style.left = (posFromTop * offset) + 'px';
      card.style.top = '0';
      if (isTop) {
        card.dataset.source = 'waste';
      } else {
        card.style.pointerEvents = 'none';
      }
      el.appendChild(card);
    }
  } else {
    const top = state.waste[state.waste.length - 1];
    const card = cardElement(top, true);
    card.dataset.source = 'waste';
    el.appendChild(card);
  }
}

function renderFoundations() {
  const symbols = ['♠', '♥', '♦', '♣'];
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`foundation-${i}`);
    el.setAttribute('data-suit-symbol', symbols[i]);
    el.innerHTML = '';
    const pile = state.foundations[i];
    if (pile.length > 0) {
      const top = pile[pile.length - 1];
      const card = cardElement(top, true);
      card.dataset.source = `foundation-${i}`;
      el.appendChild(card);
    }
  }
}

function renderTableau() {
  for (let col = 0; col < 7; col++) {
    const el = document.getElementById(`tableau-${col}`);
    el.innerHTML = '';
    const cards = state.tableau[col];

    let faceDownCount = 0;
    let firstFaceUpIdx = cards.length;
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].faceUp) { firstFaceUpIdx = i; break; }
      else faceDownCount++;
    }

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const card = cardElement(c, c.faceUp);
      card.dataset.source = `tableau-${col}-${i}`;

      let topOffset = 0;
      for (let j = 0; j < i; j++) {
        if (cards[j].faceUp) {
          topOffset += getComputedOffset('faceup');
        } else {
          topOffset += getComputedOffset('facedown');
        }
      }
      card.style.top = topOffset + 'px';

      if (!c.faceUp && i === cards.length - 1) {
        card.classList.add('flippable');
      }

      el.appendChild(card);
    }

    const lastFaceUpIdx = cards.length - 1;
    let totalHeight = 0;
    for (let i = 0; i < cards.length; i++) {
      if (i < cards.length - 1) {
        totalHeight += cards[i].faceUp ? getComputedOffset('faceup') : getComputedOffset('facedown');
      }
    }
    const cardH = getComputedCardHeight();
    el.style.minHeight = (totalHeight + cardH) + 'px';
  }
}

let _cachedOffsets = null;
function getComputedOffset(type) {
  if (!_cachedOffsets) {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    _cachedOffsets = {
      faceup: parseInt(style.getPropertyValue('--tableau-faceup')) || 44,
      facedown: parseInt(style.getPropertyValue('--tableau-facedown')) || 28,
      cardH: parseInt(style.getPropertyValue('--card-h')) || 109,
    };
  }
  return type === 'faceup' ? _cachedOffsets.faceup : _cachedOffsets.facedown;
}

function getComputedCardHeight() {
  if (!_cachedOffsets) getComputedOffset('faceup');
  return _cachedOffsets.cardH;
}

window.addEventListener('resize', () => { _cachedOffsets = null; });

/* 11. cardElement */
function cardElement(card, faceUp) {
  const el = document.createElement('div');
  el.className = 'card' + (faceUp ? '' : ' face-down');
  el.dataset.suit = card.suit;
  el.dataset.rank = card.rank;
  el.dataset.faceUp = faceUp ? 'true' : 'false';

  if (faceUp) {
    const rankName = RANK_NAMES[card.rank];
    const suitSym = SUIT_SYMBOLS[card.suit];
    const isRed = RED_SUITS.has(card.suit);
    const colorClass = isRed ? 'red' : 'black';

    const img = document.createElement('img');
    img.src = `cards/faces/${rankName}${card.suit}.png`;
    img.alt = `${rankName}${suitSym}`;
    img.onerror = function() {
      this.classList.add('hidden');
      fallback.style.display = 'flex';
    };

    const fallback = document.createElement('div');
    fallback.className = `card-face ${colorClass}`;
    fallback.style.display = 'none';

    const tl = document.createElement('div');
    tl.className = 'card-rank-tl';
    tl.innerHTML = `<span class="rank-text">${rankName}</span><span class="suit-small">${suitSym}</span>`;

    const center = document.createElement('div');
    center.className = 'card-center-suit';
    center.textContent = suitSym;

    const br = document.createElement('div');
    br.className = 'card-rank-br';
    br.innerHTML = `<span class="rank-text">${rankName}</span><span class="suit-small">${suitSym}</span>`;

    fallback.appendChild(tl);
    fallback.appendChild(center);
    fallback.appendChild(br);

    el.appendChild(img);
    el.appendChild(fallback);

    img.complete && img.naturalWidth === 0 && img.onerror();
  } else {
    const img = document.createElement('img');
    img.src = 'cards/backs/back.png';
    img.alt = 'Card back';
    img.onerror = function() {
      this.classList.add('hidden');
      backFallback.style.display = 'block';
    };

    const backFallback = document.createElement('div');
    backFallback.className = 'card-back';
    backFallback.style.display = 'none';

    el.appendChild(img);
    el.appendChild(backFallback);
  }

  return el;
}

/* 12. Drag System */
const dragState = {
  active: false,
  ghost: null,
  source: null,
  cards: [],
  startX: 0,
  startY: 0,
  offsetX: 0,
  offsetY: 0,
  moved: false,
  pointerId: null,
};

function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;

  const cardEl = e.target.closest('.card');
  if (!cardEl) return;

  const src = cardEl.dataset.source;
  if (!src) return;

  const faceUp = cardEl.dataset.faceUp === 'true';
  if (!faceUp && src.startsWith('tableau')) {
    const parts = src.split('-');
    const col = parseInt(parts[1]);
    const idx = parseInt(parts[2]);
    const colCards = state.tableau[col];
    if (idx === colCards.length - 1 && !colCards[idx].faceUp) {
      return;
    }
  }

  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  dragState.moved = false;
  dragState.source = src;
  dragState.pointerId = e.pointerId;
  dragState.cardEl = cardEl;

  try {
    cardEl.setPointerCapture(e.pointerId);
  } catch (_) {}

  e.preventDefault();
}

function onPointerMove(e) {
  if (dragState.pointerId === null || e.pointerId !== dragState.pointerId) return;

  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;

  if (!dragState.active && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
    dragState.moved = true;
    startDrag(e);
  }

  if (dragState.active && dragState.ghost) {
    dragState.ghost.style.left = (e.clientX + dragState.offsetX) + 'px';
    dragState.ghost.style.top = (e.clientY + dragState.offsetY) + 'px';
    highlightDropTargets(e.clientX, e.clientY);
  }
}

function startDrag(e) {
  const src = dragState.source;
  const cards = getCardsFromSource(src);
  if (!cards || cards.length === 0) return;

  dragState.active = true;
  dragState.cards = cards;

  const ghost = document.createElement('div');
  ghost.id = 'drag-ghost';
  ghost.style.position = 'fixed';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '1000';
  ghost.style.transform = 'rotate(2deg) scale(1.05)';
  ghost.style.opacity = '0.9';
  ghost.style.transformOrigin = 'top left';

  const cardH = getComputedCardHeight();
  const faceupOff = getComputedOffset('faceup');

  for (let i = 0; i < cards.length; i++) {
    const cardEl = cardElement(cards[i], true);
    cardEl.style.position = 'absolute';
    cardEl.style.top = (i * faceupOff) + 'px';
    cardEl.style.left = '0';
    ghost.appendChild(cardEl);
  }

  const cardW = _cachedOffsets ? _cachedOffsets.cardH * (78/109) : 78;
  const realCardW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 78;

  const srcRect = dragState.cardEl.getBoundingClientRect();
  dragState.offsetX = srcRect.left - e.clientX;
  dragState.offsetY = srcRect.top - e.clientY;

  ghost.style.left = (e.clientX + dragState.offsetX) + 'px';
  ghost.style.top = (e.clientY + dragState.offsetY) + 'px';
  ghost.style.width = realCardW + 'px';

  document.body.appendChild(ghost);
  dragState.ghost = ghost;

  dragState.cardEl.style.opacity = '0.3';
  tapState.selected = null;
  document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
}

function onPointerUp(e) {
  if (dragState.pointerId === null || e.pointerId !== dragState.pointerId) return;

  clearDropHighlights();

  if (dragState.active) {
    const dropped = tryDrop(e.clientX, e.clientY);
    if (!dropped) {
      dragState.cardEl && (dragState.cardEl.style.opacity = '');
    }
    cleanupDrag();
  } else if (!dragState.moved) {
    handleTap(e);
  }

  dragState.active = false;
  dragState.pointerId = null;
  dragState.source = null;
  dragState.cardEl = null;
  dragState.moved = false;
}

function cleanupDrag() {
  if (dragState.ghost) {
    dragState.ghost.remove();
    dragState.ghost = null;
  }
  if (dragState.cardEl) {
    dragState.cardEl.style.opacity = '';
  }
  dragState.active = false;
}

function getCardsFromSource(src) {
  if (!src) return [];
  if (src === 'waste') {
    if (state.waste.length === 0) return [];
    return [state.waste[state.waste.length - 1]];
  }
  if (src.startsWith('foundation-')) {
    const fIdx = parseInt(src.split('-')[1]);
    if (state.foundations[fIdx].length === 0) return [];
    return [state.foundations[fIdx][state.foundations[fIdx].length - 1]];
  }
  if (src.startsWith('tableau-')) {
    const parts = src.split('-');
    const col = parseInt(parts[1]);
    const cardIdx = parseInt(parts[2]);
    if (isNaN(cardIdx)) return [];
    const col_cards = state.tableau[col];
    if (!col_cards[cardIdx] || !col_cards[cardIdx].faceUp) return [];
    return col_cards.slice(cardIdx);
  }
  return [];
}

function highlightDropTargets(x, y) {
  clearDropHighlights();
  const piles = document.querySelectorAll('.pile');
  for (const pile of piles) {
    const rect = pile.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      if (isValidDrop(pile.id || pile.dataset.col, dragState.cards)) {
        pile.classList.add('drag-over');
      }
    }
  }
}

function clearDropHighlights() {
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function isValidDrop(pileId, cards) {
  if (!cards || cards.length === 0) return false;
  const card = cards[0];
  if (pileId && pileId.startsWith('foundation-')) {
    if (cards.length !== 1) return false;
    const fIdx = parseInt(pileId.split('-')[1]);
    return canPlaceOnFoundation(card, fIdx);
  }
  if (pileId && pileId.startsWith('tableau-')) {
    const col = parseInt(pileId.split('-')[1]);
    return canPlaceOnTableau(card, col);
  }
  return false;
}

function tryDrop(x, y) {
  const piles = document.querySelectorAll('.pile');
  for (const pile of piles) {
    const rect = pile.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const pileId = pile.id;
      const src = dragState.source;
      if (!src || !pileId) continue;

      if (pileId.startsWith('foundation-')) {
        const fIdx = parseInt(pileId.split('-')[1]);
        return executeDropToFoundation(src, fIdx);
      }
      if (pileId.startsWith('tableau-')) {
        const toCol = parseInt(pileId.split('-')[1]);
        return executeDropToTableau(src, toCol);
      }
    }
  }
  return false;
}

function executeDropToFoundation(src, fIdx) {
  if (src === 'waste') return moveWasteToFoundation();
  if (src.startsWith('tableau-')) {
    const parts = src.split('-');
    const col = parseInt(parts[1]);
    const cardIdx = parseInt(parts[2]);
    if (state.tableau[col].length > 0 && cardIdx === state.tableau[col].length - 1) {
      return moveTableauToFoundation(col);
    }
  }
  if (src.startsWith('foundation-')) {
    return false;
  }
  return false;
}

function executeDropToTableau(src, toCol) {
  if (src === 'waste') return moveWasteToTableau(toCol);
  if (src.startsWith('tableau-')) {
    const parts = src.split('-');
    const fromCol = parseInt(parts[1]);
    const cardIdx = parseInt(parts[2]);
    return moveTableauToTableau(fromCol, cardIdx, toCol);
  }
  if (src.startsWith('foundation-')) {
    const fIdx = parseInt(src.split('-')[1]);
    return moveFoundationToTableau(fIdx, toCol);
  }
  return false;
}

/* 13. Tap System */
const tapState = {
  selected: null,
  lastTap: { time: 0, source: null },
};

function handleTap(e) {
  const target = e.target.closest('.card');
  const pileTarget = e.target.closest('.pile');

  if (!target && !pileTarget) {
    deselectAll();
    return;
  }

  const now = Date.now();
  const src = target ? target.dataset.source : null;

  if (src) {
    const isDoubleTap = (now - tapState.lastTap.time < 400) && tapState.lastTap.source === src;
    tapState.lastTap = { time: now, source: src };

    if (isDoubleTap) {
      handleDoubleTap(src);
      return;
    }
  }

  if (pileTarget && pileTarget.id === 'stock') {
    deselectAll();
    drawFromStock();
    return;
  }

  if (!tapState.selected) {
    if (src && target.dataset.faceUp === 'true') {
      tapState.selected = src;
      document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
      target.classList.add('selected');
      if (src.startsWith('tableau-')) {
        const parts = src.split('-');
        const col = parseInt(parts[1]);
        const cardIdx = parseInt(parts[2]);
        const colCards = state.tableau[col];
        for (let i = cardIdx; i < colCards.length; i++) {
          const els = document.querySelectorAll(`[data-source="tableau-${col}-${i}"]`);
          els.forEach(el => el.classList.add('selected'));
        }
      }
    } else if (src && target.dataset.faceUp === 'false') {
      const parts = src.split('-');
      if (parts[0] === 'tableau') {
        const col = parseInt(parts[1]);
        const idx = parseInt(parts[2]);
        const colCards = state.tableau[col];
        if (idx === colCards.length - 1) {
          saveHistory();
          colCards[idx].faceUp = true;
          state.score += 5;
          state.moves++;
          updateScore();
          updateMoves();
          render();
          checkAutoComplete();
        }
      }
    }
    return;
  }

  const dest = pileTarget ? pileTarget.id : null;
  if (!dest) {
    if (src && src !== tapState.selected) {
      document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
      if (target.dataset.faceUp === 'true') {
        tapState.selected = src;
        target.classList.add('selected');
        if (src.startsWith('tableau-')) {
          const parts = src.split('-');
          const col = parseInt(parts[1]);
          const cardIdx = parseInt(parts[2]);
          const colCards = state.tableau[col];
          for (let i = cardIdx; i < colCards.length; i++) {
            const els = document.querySelectorAll(`[data-source="tableau-${col}-${i}"]`);
            els.forEach(el => el.classList.add('selected'));
          }
        }
      } else {
        tapState.selected = null;
      }
    } else {
      deselectAll();
    }
    return;
  }

  const moved = executeTapMove(tapState.selected, dest);
  if (moved) {
    deselectAll();
  } else {
    deselectAll();
    if (src && target && target.dataset.faceUp === 'true') {
      tapState.selected = src;
      target.classList.add('selected');
    }
  }
}

function handleDoubleTap(src) {
  deselectAll();
  if (src === 'waste') {
    moveWasteToFoundation();
    return;
  }
  if (src.startsWith('tableau-')) {
    const parts = src.split('-');
    const col = parseInt(parts[1]);
    moveTableauToFoundation(col);
    return;
  }
}

function executeTapMove(from, toDest) {
  if (toDest.startsWith('foundation-')) {
    const fIdx = parseInt(toDest.split('-')[1]);
    if (from === 'waste') return moveWasteToFoundation();
    if (from.startsWith('tableau-')) {
      const parts = from.split('-');
      const col = parseInt(parts[1]);
      const cardIdx = parseInt(parts[2]);
      if (cardIdx === state.tableau[col].length - 1) return moveTableauToFoundation(col);
    }
    if (from.startsWith('foundation-')) return false;
  }

  if (toDest.startsWith('tableau-')) {
    const toCol = parseInt(toDest.split('-')[1]);
    if (from === 'waste') return moveWasteToTableau(toCol);
    if (from.startsWith('tableau-')) {
      const parts = from.split('-');
      const fromCol = parseInt(parts[1]);
      const cardIdx = parseInt(parts[2]);
      return moveTableauToTableau(fromCol, cardIdx, toCol);
    }
    if (from.startsWith('foundation-')) {
      const fIdx = parseInt(from.split('-')[1]);
      return moveFoundationToTableau(fIdx, toCol);
    }
  }

  return false;
}

function deselectAll() {
  tapState.selected = null;
  document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
}

/* 14. Event Binding */
function bindEvents() {
  const gameArea = document.getElementById('game-area');
  gameArea.addEventListener('pointerdown', onPointerDown, { passive: false });
  gameArea.addEventListener('pointermove', onPointerMove, { passive: false });
  gameArea.addEventListener('pointerup', onPointerUp, { passive: false });
  gameArea.addEventListener('pointercancel', () => {
    clearDropHighlights();
    cleanupDrag();
    dragState.pointerId = null;
    dragState.source = null;
    dragState.cardEl = null;
    dragState.moved = false;
  });

  gameArea.addEventListener('contextmenu', e => e.preventDefault());

  document.getElementById('btn-new').addEventListener('click', newGame);
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-autocomplete').addEventListener('click', autoComplete);

  document.getElementById('btn-win-new').addEventListener('click', newGame);

  document.getElementById('btn-draw-mode').addEventListener('click', () => {
    state.drawMode = state.drawMode === 1 ? 3 : 1;
    updateDrawModeBtn();
    newGame();
  });
}

function updateDrawModeBtn() {
  const btn = document.getElementById('btn-draw-mode');
  btn.textContent = state.drawMode === 1 ? 'Draw 3' : 'Draw 1';
}

/* 15. Score/Timer/Moves display */
function updateScore() {
  document.getElementById('score').textContent = state.score;
}

function updateTimer() {
  const mins = Math.floor(state.seconds / 60);
  const secs = state.seconds % 60;
  document.getElementById('timer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateMoves() {
  document.getElementById('moves').textContent = state.moves;
}

/* 16. DOMContentLoaded */
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  newGame();
});
