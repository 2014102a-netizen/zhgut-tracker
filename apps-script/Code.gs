/**
 * ЖГУТ 575G — трекер комплекта на сертификацию.
 * Веб-приложение поверх Google Таблицы: страница на GitHub Pages читает строки (GET)
 * и сохраняет изменения (POST). Таблица остаётся источником данных — её можно править и руками.
 *
 * Установка: Таблица → Расширения → Apps Script (или script.google.com → Новый проект) → вставить этот файл →
 * поменять WRITE_KEY → Развернуть → Новое развёртывание → Веб-приложение
 * (Запуск от имени: Я; Доступ: Все) → скопировать URL в config.js.
 */

// Ключ для правок. Без него страница работает только на просмотр.
// Поменяйте на свой и сообщите его только тем, кто должен отмечать (вам и Ивану).
const WRITE_KEY = 'ПОМЕНЯЙТЕ-ЭТОТ-КЛЮЧ';

const SHEET_NAME = 'items';
const COLS = ['id', 'group', 'order', 'code', 'name', 'who', 'status', 'note', 'updated'];
const EDITABLE = ['group', 'code', 'name', 'who', 'status', 'note'];
const MAX_LEN = 2000;

function doGet() {
  return json({ ok: true, rows: readRows_() });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'bad_json' });
  }
  if (!req.key || req.key !== WRITE_KEY) return json({ ok: false, error: 'bad_key' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const values = sh.getDataRange().getValues();
    const head = values[0].map(String);
    const col = name => head.indexOf(name) + 1;
    const rowOf = id => {
      for (let i = 1; i < values.length; i++) if (String(values[i][col('id') - 1]) === String(id)) return i + 1;
      return -1;
    };
    const stamp = Utilities.formatDate(new Date(), 'Europe/Moscow', 'yyyy-MM-dd HH:mm');

    if (req.action === 'update') {
      const r = rowOf(req.id);
      if (r < 0) return json({ ok: false, error: 'not_found' });
      const f = req.fields || {};
      EDITABLE.forEach(k => {
        if (Object.prototype.hasOwnProperty.call(f, k) && col(k) > 0) sh.getRange(r, col(k)).setValue(clean_(f[k]));
      });
      sh.getRange(r, col('updated')).setValue(stamp);
    } else if (req.action === 'add') {
      const f = req.fields || {};
      const id = 'r' + Date.now().toString(36);
      sh.appendRow(head.map(h => {
        if (h === 'id') return id;
        if (h === 'order') return Date.now();
        if (h === 'updated') return stamp;
        return clean_(f[h] || '');
      }));
    } else if (req.action === 'delete') {
      const r = rowOf(req.id);
      if (r > 0) sh.deleteRow(r);
    } else {
      return json({ ok: false, error: 'bad_action' });
    }
    SpreadsheetApp.flush();
    return json({ ok: true, rows: readRows_() });
  } finally {
    lock.releaseLock();
  }
}

function readRows_() {
  const values = sheet_().getDataRange().getValues();
  const head = values.shift().map(String);
  return values
    .filter(r => String(r[0]).trim() !== '')
    .map(r => {
      const o = {};
      head.forEach((h, i) => { o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i], 'Europe/Moscow', 'yyyy-MM-dd') : r[i]; });
      return o;
    });
}

// ID таблицы «ЖГУТ 575G — трекер комплекта на сертификацию»: скрипт работает
// и из меню таблицы (Расширения → Apps Script), и как отдельный проект на script.google.com.
const SPREADSHEET_ID = '1k7qDf6qp73zxDllb9hUN9ODE_OfMYdSDQD0vj5GnIpo';

function sheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

// Текст из формы не должен превращаться в формулу таблицы.
function clean_(v) {
  let s = String(v == null ? '' : v).slice(0, MAX_LEN);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
