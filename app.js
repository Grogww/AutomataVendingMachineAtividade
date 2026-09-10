/* ===========================================================
   Vending Machine — AFD
   Simulador visual do autômato finito determinístico.
   Sem dependências: abre direto no navegador.
   =========================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. Modelo do autômato
     --------------------------------------------------------- */

  var PRICE = 30;                       // preço do produto, em centavos
  var ALPHABET = ['a', 'b', 'c'];

  var COIN = {
    a: { cents: 5,  label: '5¢'  },
    b: { cents: 10, label: '10¢' },
    c: { cents: 25, label: '25¢' }
  };

  // Cada estado é o saldo acumulado. 50¢ é o teto: só se insere
  // moeda com saldo < 30, então o pior caso é q25 + c.
  var BALANCES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

  function isFinal(b) { return b >= PRICE; }
  function qname(b)   { return 'q' + b; }
  function brl(cents) { return 'R$ ' + (cents / 100).toFixed(2).replace('.', ','); }

  // δ: uma transição por símbolo para cada estado não-final → 6 × 3 = 18
  var TRANSITIONS = [];
  BALANCES.forEach(function (from) {
    if (isFinal(from)) return;
    ALPHABET.forEach(function (sym) {
      TRANSITIONS.push({ from: from, sym: sym, to: from + COIN[sym].cents });
    });
  });

  /**
   * Executa a palavra sobre o autômato.
   * Retorna o traço completo para que a UI possa navegar passo a passo.
   */
  function simulate(word) {
    var trace = [0], moves = [], cur = 0, halt = null;

    for (var i = 0; i < word.length; i++) {
      var sym = word[i];
      if (!COIN[sym])   { halt = { reason: 'simbolo', i: i, sym: sym, at: cur }; break; }
      if (isFinal(cur)) { halt = { reason: 'travado', i: i, sym: sym, at: cur }; break; }

      var to = cur + COIN[sym].cents;
      moves.push({ i: i, from: cur, sym: sym, to: to });
      cur = to;
      trace.push(cur);
    }

    return {
      word: word, moves: moves, trace: trace, halt: halt,
      balance: cur, accepted: !halt && isFinal(cur)
    };
  }

  /* ---------------------------------------------------------
     2. Geometria do diagrama
     Os estados ficam sobre a "reta do saldo": a posição no eixo x
     é o próprio valor acumulado. Arcos +5 abaixo, +10 e +25 acima.
     --------------------------------------------------------- */

  var GEO = { x0: 70, dx: 98, y: 230, r: 24, w: 1120, h: 340 };
  var ARC = {                            // altura do arco: base + passo × índice
    a: { base: 44,  step: 7,  above: false },
    b: { base: 58,  step: 9,  above: true  },
    c: { base: 128, step: 11, above: true  }
  };

  function cx(balance) { return GEO.x0 + (balance / 5) * GEO.dx; }

  var NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
    if (text != null) n.textContent = text;
    return n;
  }

  function marker(id, colorVar) {
    var m = svgEl('marker', {
      id: id, viewBox: '0 0 10 10', refX: '9.2', refY: '5',
      markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse'
    });
    var p = svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z' });
    p.style.fill = 'var(' + colorVar + ')';   // var() só resolve em style inline
    m.appendChild(p);
    return m;
  }

  // Recua um ponto na direção do ponto de controle (para o arco não
  // entrar no círculo do estado).
  function trim(px, py, ctrlX, ctrlY, dist) {
    var dx = ctrlX - px, dy = ctrlY - py, len = Math.hypot(dx, dy) || 1;
    return { x: px + (dx / len) * dist, y: py + (dy / len) * dist };
  }

  var nodeEls = {};   // balance      → <g>
  var edgeEls = {};   // "from|sym"   → <g>

  function buildDiagram() {
    var svg = document.getElementById('diagram');
    svg.setAttribute('viewBox', '0 0 ' + GEO.w + ' ' + GEO.h);
    svg.innerHTML = '';

    var defs = svgEl('defs');
    [['ar-a', '--sym-a'], ['ar-b', '--sym-b'], ['ar-c', '--sym-c'],
     ['ar-hl', '--accent'], ['ar-plain', '--node-line']]
      .forEach(function (m) { defs.appendChild(marker(m[0], m[1])); });
    svg.appendChild(defs);

    /* faixas de fundo: acumulando (q0..q25) e entregue (q30..q50) */
    var bandTop = 32, bandH = 290;
    var b1x = 6, b1w = cx(25) + 40 - b1x;
    var b2x = cx(30) - 40, b2w = cx(50) + 40 - b2x;

    svg.appendChild(svgEl('rect', { class: 'band', x: b1x, y: bandTop, width: b1w, height: bandH, rx: 14 }));
    svg.appendChild(svgEl('rect', { class: 'band band--fin', x: b2x, y: bandTop, width: b2w, height: bandH, rx: 14 }));
    svg.appendChild(svgEl('text', { class: 'band-label', x: b1x + b1w / 2, y: 22, 'text-anchor': 'middle' },
      'acumulando  ·  saldo < 30¢'));
    svg.appendChild(svgEl('text', { class: 'band-label', x: b2x + b2w / 2, y: 22, 'text-anchor': 'middle' },
      'produto entregue  ·  saldo ≥ 30¢  (F)'));

    /* seta de estado inicial */
    svg.appendChild(svgEl('path', { class: 'start-arrow', d: 'M 12 ' + GEO.y + ' L 44 ' + GEO.y }));

    /* transições */
    var seen = { a: 0, b: 0, c: 0 };
    TRANSITIONS.forEach(function (t) {
      var cfg = ARC[t.sym];
      var h = cfg.base + cfg.step * seen[t.sym]++;
      var x1 = cx(t.from), x2 = cx(t.to);
      var mx = (x1 + x2) / 2;
      var cy = cfg.above ? GEO.y - 2 * h : GEO.y + 2 * h;

      var p0 = trim(x1, GEO.y, mx, cy, GEO.r);
      var p2 = trim(x2, GEO.y, mx, cy, GEO.r + 4);
      var d = 'M ' + p0.x + ' ' + p0.y + ' Q ' + mx + ' ' + cy + ' ' + p2.x + ' ' + p2.y;

      // ponto médio da bézier (t = 0.5), onde vai o rótulo
      var lx = 0.25 * p0.x + 0.5 * mx + 0.25 * p2.x;
      var ly = 0.25 * p0.y + 0.5 * cy + 0.25 * p2.y;

      var g = svgEl('g', { class: 'edge edge--' + t.sym });
      g.appendChild(svgEl('title', null,
        qname(t.from) + ' --' + t.sym + '--> ' + qname(t.to) + '  (' + COIN[t.sym].label + ')'));
      g.appendChild(svgEl('path', { class: 'edge__hit', d: d }));
      g.appendChild(svgEl('path', { class: 'edge__path', d: d }));
      g.appendChild(svgEl('rect', { class: 'edge__box', x: lx - 9, y: ly - 8, width: 18, height: 16, rx: 5 }));
      g.appendChild(svgEl('text', { class: 'edge__sym', x: lx, y: ly + 4, 'text-anchor': 'middle' }, t.sym));

      svg.appendChild(g);
      edgeEls[t.from + '|' + t.sym] = g;
    });

    /* estados (por último, para ficarem por cima dos arcos) */
    BALANCES.forEach(function (b) {
      var fin = isFinal(b);
      var g = svgEl('g', {
        class: 'node' + (fin ? ' is-final' : ''),
        transform: 'translate(' + cx(b) + ',' + GEO.y + ')'
      });
      g.appendChild(svgEl('title', null,
        qname(b) + ' — saldo ' + b + '¢' + (fin ? ' — final, troco ' + brl(b - PRICE) : '')));
      g.appendChild(svgEl('circle', { class: 'halo', r: GEO.r + 6 }));
      g.appendChild(svgEl('circle', { class: 'node__bg', r: GEO.r }));
      if (fin) g.appendChild(svgEl('circle', { class: 'node__ring', r: GEO.r - 5 }));
      g.appendChild(svgEl('text', { class: 'node__label', y: 4.5, 'text-anchor': 'middle' }, qname(b)));

      svg.appendChild(g);
      nodeEls[b] = g;
    });
  }

  /* ---------------------------------------------------------
     3. Tabela de transições
     --------------------------------------------------------- */

  var cellEls = {}, rowEls = {};

  function buildTable() {
    var table = document.getElementById('deltaTable');
    table.innerHTML = '';

    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['Estado', 'a · 5¢', 'b · 10¢', 'c · 25¢', 'Inicial', 'Final'].forEach(function (t, i) {
      var th = document.createElement('th');
      th.textContent = t;
      if (i >= 1 && i <= 3) th.className = 'h-' + ALPHABET[i - 1];
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    BALANCES.forEach(function (b) {
      var tr = document.createElement('tr');
      tr.id = 'row-' + b;

      var th = document.createElement('th');
      th.textContent = qname(b);
      tr.appendChild(th);

      ALPHABET.forEach(function (sym) {
        var td = document.createElement('td');
        td.id = 'cell-' + b + '-' + sym;
        if (isFinal(b)) { td.textContent = '—'; td.className = 'empty'; }
        else            { td.textContent = qname(b + COIN[sym].cents); }
        tr.appendChild(td);
        cellEls[b + '|' + sym] = td;
      });

      var tdI = document.createElement('td');
      tdI.innerHTML = b === 0 ? '<span class="mark-init">→</span>' : '';
      tr.appendChild(tdI);

      var tdF = document.createElement('td');
      tdF.innerHTML = isFinal(b) ? '<span class="mark-final">✓</span>' : '';
      tr.appendChild(tdF);

      tbody.appendChild(tr);
      rowEls[b] = tr;
    });
    table.appendChild(tbody);

    document.getElementById('fQ').textContent =
      '{ ' + BALANCES.map(qname).join(', ') + ' }';
    document.getElementById('fF').textContent =
      '{ ' + BALANCES.filter(isFinal).map(qname).join(', ') + ' }';
  }

  /* ---------------------------------------------------------
     4. Estado da interface
     --------------------------------------------------------- */

  var state = { word: '', pos: 0, sim: simulate(''), timer: null };

  var $ = function (id) { return document.getElementById(id); };
  var wordInput = $('wordInput');

  function setWord(w, keepPos) {
    state.word = String(w).toLowerCase().replace(/\s+/g, '').slice(0, 30);
    state.sim = simulate(state.word);
    state.pos = keepPos ? Math.min(state.pos, state.sim.moves.length) : 0;
    if (wordInput.value !== state.word) wordInput.value = state.word;
    render();
  }

  function setPos(p) {
    state.pos = Math.max(0, Math.min(p, state.sim.moves.length));
    render();
  }

  function stopAuto() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    $('btnPlay').textContent = '▶ Auto';
  }

  function toggleAuto() {
    if (state.timer) { stopAuto(); render(); return; }
    if (state.pos >= state.sim.moves.length) state.pos = 0;
    $('btnPlay').textContent = '⏸ Pausar';
    state.timer = setInterval(function () {
      if (state.pos >= state.sim.moves.length) { stopAuto(); render(); return; }
      setPos(state.pos + 1);
    }, 650);
    render();
  }

  /* ---------------------------------------------------------
     5. Renderização
     --------------------------------------------------------- */

  function render() {
    var sim = state.sim, pos = state.pos;
    var cur = sim.trace[pos];
    var atEnd = pos === sim.moves.length;
    var done = atEnd && sim.accepted;
    var failed = atEnd && !sim.accepted;

    /* --- diagrama --- */
    var visited = sim.trace.slice(0, pos + 1);
    BALANCES.forEach(function (b) {
      var g = nodeEls[b];
      g.classList.toggle('is-visited', visited.indexOf(b) !== -1 && b !== cur);
      g.classList.toggle('is-current', b === cur && !done && !failed);
      g.classList.toggle('is-accept',  b === cur && done);
      g.classList.toggle('is-reject',  b === cur && failed);
    });

    var last = pos > 0 ? sim.moves[pos - 1] : null;
    TRANSITIONS.forEach(function (t) {
      var g = edgeEls[t.from + '|' + t.sym];
      var used = sim.moves.slice(0, pos).some(function (m) {
        return m.from === t.from && m.sym === t.sym;
      });
      g.classList.toggle('is-used', used);
      g.classList.toggle('is-active', !!last && last.from === t.from && last.sym === t.sym);
    });

    /* --- fita --- */
    var tape = $('tape');
    tape.innerHTML = '';
    if (!sim.word.length) {
      var eps = document.createElement('span');
      eps.className = 'tape__eps';
      eps.textContent = 'ε  (palavra vazia)';
      tape.appendChild(eps);
    } else {
      for (var i = 0; i < sim.word.length; i++) {
        var ch = sim.word[i];
        var cell = document.createElement('div');
        cell.className = 'cell';
        if (i < pos) cell.classList.add('is-done');
        else if (i === pos) {
          var bad = sim.halt && sim.halt.i === i;
          cell.classList.add(bad ? 'is-error' : 'is-head');
        }
        cell.innerHTML =
          '<span class="cell__s">' + ch + '</span>' +
          '<span class="cell__v">' + (COIN[ch] ? COIN[ch].label : '?') + '</span>';
        tape.appendChild(cell);
      }
    }

    /* --- números --- */
    $('statState').textContent   = qname(cur);
    $('statBalance').textContent = cur + '¢';
    $('statStep').textContent    = pos + ' / ' + sim.moves.length;

    var paid = Math.min(cur, PRICE), over = Math.max(0, cur - PRICE);
    $('meterPaid').style.width = (paid / 50 * 100) + '%';
    $('meterOver').style.left  = '60%';
    $('meterOver').style.width = (over / 50 * 100) + '%';

    /* --- veredito --- */
    renderVerdict(sim, pos, cur, atEnd);

    /* --- tabela --- */
    BALANCES.forEach(function (b) { rowEls[b].classList.toggle('is-current', b === cur); });
    TRANSITIONS.forEach(function (t) {
      cellEls[t.from + '|' + t.sym].classList.toggle('is-active',
        !!last && last.from === t.from && last.sym === t.sym);
    });

    /* --- botões e chips --- */
    $('btnFirst').disabled = pos === 0;
    $('btnPrev').disabled  = pos === 0;
    $('btnNext').disabled  = atEnd;
    $('btnLast').disabled  = atEnd;
    $('btnPlay').disabled  = sim.moves.length === 0;
    $('btnBack').disabled  = !sim.word.length;
    $('btnClear').disabled = !sim.word.length;

    Array.prototype.forEach.call(document.querySelectorAll('.case'), function (el) {
      el.classList.toggle('is-on', el.dataset.word === sim.word);
    });
  }

  function renderVerdict(sim, pos, cur, atEnd) {
    var box = $('verdict'), title, detail, extra = '';
    box.className = 'verdict';

    if (!atEnd) {
      box.classList.add('verdict--run');
      title  = 'Em execução';
      detail = 'Lidos ' + pos + ' de ' + sim.word.length + ' símbolos. ' +
               'Estado atual <code>' + qname(cur) + '</code>, saldo ' + cur + '¢. ' +
               'Faltam ' + Math.max(0, PRICE - cur) + '¢.';

    } else if (sim.accepted) {
      box.classList.add('verdict--ok');
      title  = 'Aceita — produto entregue';
      detail = 'Terminou em <code>' + qname(cur) + '</code>, que pertence a F. ' +
               'Saldo de ' + cur + '¢ para um produto de ' + PRICE + '¢.';
      extra  = '<div class="change">Troco: ' + brl(cur - PRICE) + '</div>';

    } else if (sim.halt && sim.halt.reason === 'simbolo') {
      box.classList.add('verdict--bad');
      title  = 'Rejeita — símbolo fora do alfabeto';
      detail = '<code>' + sim.halt.sym + '</code> na posição ' + (sim.halt.i + 1) +
               ' não pertence a Σ = { a, b, c }.';

    } else if (sim.halt && sim.halt.reason === 'travado') {
      box.classList.add('verdict--bad');
      title  = 'Rejeita — δ indefinida';
      detail = 'A máquina já entregou o produto em <code>' + qname(sim.halt.at) + '</code>. ' +
               'Estados finais não têm transição de saída, então a moeda <code>' + sim.halt.sym +
               '</code> (' + (COIN[sim.halt.sym] ? COIN[sim.halt.sym].label : '?') +
               ') na posição ' + (sim.halt.i + 1) + ' não pode ser lida.';

    } else if (!sim.word.length) {
      box.classList.add('verdict--bad');
      title  = 'Rejeita — palavra vazia';
      detail = 'ε deixa o autômato em <code>q0</code>, que não pertence a F.';

    } else {
      box.classList.add('verdict--bad');
      title  = 'Rejeita — saldo insuficiente';
      detail = 'Terminou em <code>' + qname(cur) + '</code>, que não pertence a F. ' +
               'Faltam ' + (PRICE - cur) + '¢ para os ' + PRICE + '¢ do produto.';
    }

    box.innerHTML = '<span class="verdict__t">' + title + '</span>' +
                    '<span class="verdict__d">' + detail + '</span>' + extra;
  }

  /* ---------------------------------------------------------
     6. Casos de teste
     --------------------------------------------------------- */

  var CASES_OK   = ['ca', 'ac', 'bbb', 'aaaaaa', 'bc', 'abc', 'cc'];
  var CASES_FAIL = ['', 'c', 'ab', 'bb', 'aaaaa', 'cab'];

  function buildCases() {
    [['casesOk', CASES_OK], ['casesFail', CASES_FAIL]].forEach(function (pair) {
      var box = $(pair[0]);
      pair[1].forEach(function (w) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'case' + (w === '' ? ' case--eps' : '');
        b.textContent = w === '' ? 'ε' : w;
        b.dataset.word = w;
        b.title = w === '' ? 'palavra vazia' : describe(w);
        b.addEventListener('click', function () { stopAuto(); setWord(w); });
        box.appendChild(b);
      });
    });
  }

  function describe(w) {
    var parts = [], total = 0;
    for (var i = 0; i < w.length; i++) {
      if (!COIN[w[i]]) return w;
      parts.push(COIN[w[i]].label);
      total += COIN[w[i]].cents;
    }
    return parts.join(' + ') + ' = ' + total + '¢';
  }

  /* ---------------------------------------------------------
     7. Eventos
     --------------------------------------------------------- */

  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-coin]'), function (btn) {
      btn.addEventListener('click', function () {
        stopAuto();
        setWord(state.word + btn.dataset.coin);
        setPos(state.sim.moves.length);          // acompanha a inserção da moeda
      });
    });

    wordInput.addEventListener('input', function () { stopAuto(); setWord(wordInput.value); });

    $('btnBack').addEventListener('click',  function () { stopAuto(); setWord(state.word.slice(0, -1)); });
    $('btnClear').addEventListener('click', function () { stopAuto(); setWord(''); wordInput.focus(); });
    $('btnFirst').addEventListener('click', function () { stopAuto(); setPos(0); });
    $('btnPrev').addEventListener('click',  function () { stopAuto(); setPos(state.pos - 1); });
    $('btnNext').addEventListener('click',  function () { stopAuto(); setPos(state.pos + 1); });
    $('btnLast').addEventListener('click',  function () { stopAuto(); setPos(state.sim.moves.length); });
    $('btnPlay').addEventListener('click',  toggleAuto);

    Array.prototype.forEach.call(document.querySelectorAll('[data-filter]'), function (cb) {
      cb.addEventListener('change', function () {
        document.getElementById('diagram').classList.toggle('hide-' + cb.dataset.filter, !cb.checked);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.target === wordInput || e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key;
      if (k === 'a' || k === 'b' || k === 'c') { stopAuto(); setWord(state.word + k); setPos(state.sim.moves.length); }
      else if (k === '1') { stopAuto(); setWord(state.word + 'a'); setPos(state.sim.moves.length); }
      else if (k === '2') { stopAuto(); setWord(state.word + 'b'); setPos(state.sim.moves.length); }
      else if (k === '3') { stopAuto(); setWord(state.word + 'c'); setPos(state.sim.moves.length); }
      else if (k === 'ArrowRight') { stopAuto(); setPos(state.pos + 1); }
      else if (k === 'ArrowLeft')  { stopAuto(); setPos(state.pos - 1); }
      else if (k === 'Enter')      { stopAuto(); setPos(state.sim.moves.length); }
      else if (k === 'Escape')     { stopAuto(); setWord(''); }
      else if (k === 'Backspace')  { stopAuto(); setWord(state.word.slice(0, -1)); }
      else return;
      e.preventDefault();
    });

    $('themeToggle').addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('vm-theme', next); } catch (err) { /* modo privado */ }
    });
  }

  function applyTheme(t) { document.documentElement.dataset.theme = t; }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('vm-theme'); } catch (err) { /* modo privado */ }
    if (!saved) {
      saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark' : 'light';
    }
    applyTheme(saved);
  }

  /* ---------------------------------------------------------
     8. Início
     --------------------------------------------------------- */

  initTheme();
  buildDiagram();
  buildTable();
  buildCases();
  bind();
  setWord('abc');
})();
