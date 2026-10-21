(function () {
  'use strict';
  const GROUPS = [
    { id: 'block', title: 'Блокирует подачу заявки', blocker: true },
    { id: 'app', title: 'Заявка и приложение к ней (№ 0–10)' },
    { id: 'td', title: 'Технологическая документация (ТД-1…ТД-7)' },
    { id: 'buy', title: 'Покупные изделия и материалы' },
    { id: 'other', title: 'Прочее' }
  ];
  const WHO = ['Мы', 'Иван', 'Игорь', 'ОС', 'Поставщик', 'Регистрация'];
  const STATUS = ['готово', 'проект', 'нет', 'ждём'];
  const API = (window.TRACKER_API || '').trim();
  const $ = s => document.querySelector(s);

  let rows = [];
  let key = '';
  let deferred = false;
  let filt = { who: 'Все', open: false };
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  try { const s = JSON.parse(ls.get('zhgut-filter') || 'null'); if (s) filt = Object.assign(filt, s); } catch (e) {}
  key = ls.get('zhgut-key') || '';
  const canWrite = () => !!(API && key);

  // ---------- данные ----------
  function sync(t) { $('#sync').textContent = t || ''; }
  function msg(t) { $('#msg').textContent = t || ''; }

  async function load() {
    try {
      if (API) {
        const r = await fetch(API, { cache: 'no-store' });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'ошибка');
        rows = norm(j.rows);
        sync('Обновлено ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
      } else {
        const r = await fetch('data/seed.json', { cache: 'no-store' });
        rows = norm(await r.json());
        sync('Таблица не подключена — показан снимок от 22.10.2026');
      }
      render();
    } catch (e) {
      sync('Не удалось загрузить данные. Проверьте связь и обновите страницу.');
      if (!rows.length) render();
    }
  }
  function norm(list) {
    return (list || []).map(r => ({
      id: String(r.id), group: String(r.group || 'other'), order: Number(r.order) || 0,
      code: r.code === '' || r.code == null ? '' : String(r.code), name: String(r.name || ''),
      who: String(r.who || ''), status: String(r.status || 'нет'), note: String(r.note || ''), updated: String(r.updated || '')
    })).sort((a, b) => a.order - b.order);
  }

  async function post(body) {
    if (!canWrite()) return false;
    sync('Сохраняю…');
    try {
      // text/plain — без предварительного запроса CORS, так Apps Script принимает POST со статической страницы
      const r = await fetch(API, { method: 'POST', body: JSON.stringify(Object.assign({ key }, body)) });
      const j = await r.json();
      if (!j.ok) {
        if (j.error === 'bad_key') { key = ''; ls.del('zhgut-key'); keyUi(); sync('Неверный ключ — правки не сохранены.'); render(); return false; }
        throw new Error(j.error);
      }
      rows = norm(j.rows);
      sync('Сохранено ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
      render();
      return true;
    } catch (e) {
      sync('Не сохранилось. Попробуйте ещё раз.');
      load();
      return false;
    }
  }

  // ---------- интерфейс ----------
  function opt(sel, vals, cur) {
    sel.textContent = '';
    vals.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; if (v === cur) o.selected = true; sel.appendChild(o); });
    if (cur && !vals.includes(cur)) { const o = document.createElement('option'); o.value = cur; o.textContent = cur; o.selected = true; sel.appendChild(o); }
  }

  function keyUi() {
    const has = !!key;
    $('#keyInput').hidden = has || !API;
    $('#keyBtn').textContent = has ? 'Выйти' : 'Войти';
    $('#keyBtn').hidden = !API;
    $('#keyState').textContent = !API ? 'Только просмотр: таблица ещё не подключена.' : (has ? 'Правки включены.' : 'Только просмотр. Чтобы отмечать, введите ключ.');
    document.querySelectorAll('#addForm input,#addForm select,#addForm textarea,#addBtn').forEach(e => { e.disabled = !canWrite(); });
  }
  $('#keyBtn').onclick = () => {
    if (key) { key = ''; ls.del('zhgut-key'); }
    else { const v = $('#keyInput').value.trim(); if (!v) { $('#keyInput').focus(); return; } key = v; ls.set('zhgut-key', v); $('#keyInput').value = ''; }
    keyUi(); render();
  };
  $('#keyInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#keyBtn').click(); });

  function chips() {
    const box = $('#whoChips'); box.textContent = '';
    ['Все'].concat(WHO).forEach(w => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = w;
      b.setAttribute('aria-pressed', String(filt.who === w));
      b.onclick = () => { filt.who = w; ls.set('zhgut-filter', JSON.stringify(filt)); chips(); render(); };
      box.appendChild(b);
    });
    $('#openOnly').setAttribute('aria-pressed', String(filt.open));
  }
  $('#openOnly').onclick = () => { filt.open = !filt.open; ls.set('zhgut-filter', JSON.stringify(filt)); chips(); render(); };

  function summary() {
    const box = $('#summary'); box.textContent = '';
    const c = {}; STATUS.forEach(s => c[s] = 0); rows.forEach(r => { if (c[r.status] !== undefined) c[r.status]++; });
    const openBlock = rows.filter(r => r.group === 'block' && r.status !== 'готово').length;
    [['block', openBlock, 'блокирует подачу'], ['готово', c['готово'], 'готово'], ['проект', c['проект'], 'проект, есть пробелы'], ['нет', c['нет'], 'нет'], ['ждём', c['ждём'], 'ждём других']]
      .forEach(([k, n, l]) => {
        const d = document.createElement('div'); d.className = 'tile' + (k === 'block' ? ' block' : '');
        const b = document.createElement('b'); b.textContent = n; const s = document.createElement('span'); s.textContent = l;
        d.append(b, s); box.appendChild(d);
      });
  }

  function rowEl(r) {
    const ro = !canWrite();
    const el = document.createElement('div'); el.className = 'row' + (r.status === 'готово' ? ' done' : '');
    const code = document.createElement('div'); code.className = 'code'; code.textContent = r.code || '—';
    const name = document.createElement('div'); name.className = 'name'; name.textContent = r.name;
    if (r.updated) name.title = 'Изменено: ' + r.updated;

    const whoC = document.createElement('div'); whoC.className = 'who';
    const who = document.createElement('select'); who.id = 'who-' + r.id; who.setAttribute('aria-label', 'Кто делает'); opt(who, WHO, r.who); who.disabled = ro;
    who.onchange = () => post({ action: 'update', id: r.id, fields: { who: who.value } });
    whoC.appendChild(who);

    const stC = document.createElement('div'); stC.className = 'st';
    const st = document.createElement('select'); st.id = 'st-' + r.id; st.setAttribute('aria-label', 'Статус'); st.className = 'status s-' + r.status; opt(st, STATUS, r.status); st.disabled = ro;
    st.onchange = () => { st.className = 'status s-' + st.value; post({ action: 'update', id: r.id, fields: { status: st.value } }); };
    stC.appendChild(st);

    const noteC = document.createElement('div'); noteC.className = 'note';
    const note = document.createElement('textarea'); note.id = 'note-' + r.id; note.rows = 1; note.setAttribute('aria-label', 'Чего не хватает'); note.value = r.note; note.readOnly = ro;
    note.addEventListener('input', () => fit(note));
    note.addEventListener('change', () => { if (note.value !== r.note) post({ action: 'update', id: r.id, fields: { note: note.value } }); });
    noteC.appendChild(note);

    const delC = document.createElement('div'); delC.className = 'delcell';
    if (!ro) {
      const del = document.createElement('button'); del.type = 'button'; del.className = 'del'; del.textContent = '×'; del.title = 'Удалить строку'; del.setAttribute('aria-label', 'Удалить строку');
      let armed = false;
      del.onclick = () => {
        if (!armed) { armed = true; del.textContent = 'Удалить?'; del.classList.add('confirm'); setTimeout(() => { if (armed) { armed = false; del.textContent = '×'; del.classList.remove('confirm'); } }, 3000); return; }
        post({ action: 'delete', id: r.id });
      };
      delC.appendChild(del);
    }
    el.append(code, name, whoC, stC, noteC, delC);
    return el;
  }

  function fit(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
  function fitAll() { requestAnimationFrame(() => document.querySelectorAll('#groups textarea').forEach(fit)); }
  window.addEventListener('resize', () => fitAll());

  function render() {
    const a = document.activeElement;
    if (a && a.closest && a.closest('#groups') && a.tagName === 'TEXTAREA') { deferred = true; return; }
    deferred = false;
    summary();
    const box = $('#groups'); box.textContent = '';
    GROUPS.forEach(g => {
      let list = rows.filter(r => (GROUPS.some(x => x.id === r.group) ? r.group : 'other') === g.id);
      if (!list.length) return;
      const total = list.length, done = list.filter(r => r.status === 'готово').length;
      if (filt.who !== 'Все') list = list.filter(r => r.who === filt.who);
      if (filt.open) list = list.filter(r => r.status !== 'готово');
      const sec = document.createElement('section'); sec.className = 'group' + (g.blocker ? ' blocker' : '');
      const h = document.createElement('div'); h.className = 'ghead';
      const h2 = document.createElement('h2'); h2.textContent = g.title;
      const sm = document.createElement('small'); sm.textContent = done + ' из ' + total + ' готово';
      h.append(h2, sm); sec.appendChild(h);
      const cols = document.createElement('div'); cols.className = 'cols';
      ['Код', 'Документ', 'Кто', 'Статус', 'Чего не хватает', ''].forEach(t => { const s = document.createElement('span'); s.textContent = t; cols.appendChild(s); });
      sec.appendChild(cols);
      if (!list.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'По фильтру ничего нет.'; sec.appendChild(e); }
      list.forEach(r => sec.appendChild(rowEl(r)));
      box.appendChild(sec);
    });
    if (!rows.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'Список пуст.'; box.appendChild(e); }
    fitAll();
  }
  document.addEventListener('focusout', () => { if (deferred) setTimeout(() => { if (deferred) render(); }, 0); });

  // форма добавления
  opt($('#addWho'), WHO, 'Мы'); opt($('#addStatus'), STATUS, 'нет');
  (function () { const s = $('#addGroup'); s.textContent = ''; GROUPS.forEach(g => { const o = document.createElement('option'); o.value = g.id; o.textContent = g.title; s.appendChild(o); }); s.value = 'app'; })();
  $('#addForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!canWrite()) { msg('Чтобы добавлять строки, введите ключ.'); return; }
    const name = $('#addName').value.trim(); if (!name) { $('#addName').focus(); return; }
    $('#addBtn').disabled = true;
    const ok = await post({ action: 'add', fields: { group: $('#addGroup').value, name, who: $('#addWho').value, status: $('#addStatus').value, code: $('#addCode').value.trim(), note: $('#addNote').value.trim() } });
    $('#addBtn').disabled = !canWrite();
    if (ok) { $('#addName').value = ''; $('#addCode').value = ''; $('#addNote').value = ''; msg('Добавлено.'); setTimeout(() => msg(''), 2500); }
  });

  chips(); keyUi(); load();
  // обновление раз в минуту, пока вкладка открыта
  setInterval(() => { if (!document.hidden && !deferred) load(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
