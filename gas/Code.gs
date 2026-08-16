/**
 * 経費精算PDF作成アプリ - GAS Webアプリ側スクリプト
 *
 * このスクリプトは、経費データを保存したいGoogleスプレッドシートに
 * コンテナバインドスクリプトとして設置し、Webアプリとしてデプロイして使用する。
 * デプロイして得られる /exec URL を、Next.jsアプリの「設定」画面に登録することで、
 * このスプレッドシートに経費データが保存されるようになる。
 *
 * 1人1スプレッドシート・1デプロイが前提。他人とURLを共有しない限り、
 * データが他人と混ざることはない。
 */

var SHEET_NAME = "経費データ";
var HEADER_ROW = [
  "保存日時",
  "保存区分",
  "発行日",
  "利用日",
  "支払方法",
  "内容",
  "メモ",
  "金額",
  "請求先組織",
];

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : null;

  if (action === "list") {
    return jsonResponse({ status: "ok", records: getAllRecords() });
  }

  return jsonResponse({ status: "ok", service: "keihi-seisan", sheet: SHEET_NAME });
}

/**
 * 保存済みの全明細をシートから読み出す(絞り込みはしない)。
 */
function getAllRecords() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  var tz = ss.getSpreadsheetTimeZone();
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADER_ROW.length).getValues();

  return values.map(function (row) {
    return {
      savedAt: formatDateCell(row[0], tz, "yyyy-MM-dd HH:mm:ss"),
      status: safeText(row[1]),
      issueDate: formatDateCell(row[2], tz, "yyyy-MM-dd"),
      date: formatDateCell(row[3], tz, "yyyy-MM-dd"),
      paymentMethod: safeText(row[4]),
      description: safeText(row[5]),
      memo: safeText(row[6]),
      amount: row[7],
      organization: safeText(row[8]),
    };
  });
}

/**
 * スプレッドシートが日付らしき文字列を自動でDate型に変換してしまうことがあるため、
 * 読み出し時に一貫してこのタイムゾーンでの文字列表現に揃える。
 */
function formatDateCell(value, tz, pattern) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, tz, pattern);
  }
  return value;
}

/**
 * 過去の列構成で保存された行(例: 列の位置が異なる古いデータ)が混ざっていると、
 * 本来は文字列であるべき列にDate型の値が入ってしまうことがある。
 * そのままJSON化すると壊れた日時文字列として表示されてしまうため、空文字に置き換える。
 */
function safeText(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return "";
  }
  return value;
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "リクエストボディがありません。" });
    }

    var payload = JSON.parse(e.postData.contents);

    if (payload.action === "delete") {
      if (!payload.savedAt) {
        return jsonResponse({ status: "error", message: "savedAtが指定されていません。" });
      }
      var deleteSheet = getOrCreateSheet();
      var deleteSs = SpreadsheetApp.getActiveSpreadsheet();
      deleteRowsBySavedAt(deleteSheet, deleteSs.getSpreadsheetTimeZone(), payload.savedAt);
      return jsonResponse({ status: "ok" });
    }

    var transactions = payload.transactions || [];

    if (!Array.isArray(transactions)) {
      return jsonResponse({ status: "error", message: "transactionsが不正です。" });
    }

    var sheet = getOrCreateSheet();

    if (payload.replaceSavedAt) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      deleteRowsBySavedAt(sheet, ss.getSpreadsheetTimeZone(), payload.replaceSavedAt);
    }

    var now = new Date();

    var rows = transactions.map(function (t) {
      return [
        now,
        payload.statusLabel || payload.status || "",
        payload.issueDate || "",
        t.date || "",
        t.paymentMethodLabel || t.paymentMethod || "",
        t.description || "",
        t.memo || "",
        Number(t.amount) || 0,
        t.organizationName || t.organization || "",
      ];
    });

    if (rows.length > 0) {
      sheet
        .getRange(sheet.getLastRow() + 1, 1, rows.length, HEADER_ROW.length)
        .setValues(rows);
    }

    return jsonResponse({ status: "ok", saved: rows.length });
  } catch (err) {
    return jsonResponse({ status: "error", message: String(err && err.message ? err.message : err) });
  }
}

/**
 * 指定した保存日時(yyyy-MM-dd HH:mm:ss形式)と一致する行をすべて削除する。
 * 一覧画面からの「編集」で再保存する際、古い行を残さず置き換えるために使う。
 */
function deleteRowsBySavedAt(sheet, tz, targetSavedAt) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    var cellSavedAt = formatDateCell(values[i][0], tz, "yyyy-MM-dd HH:mm:ss");
    if (cellSavedAt === targetSavedAt) {
      sheet.deleteRow(2 + i);
    }
  }
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
