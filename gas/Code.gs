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
  "対象期間開始",
  "対象期間終了",
  "利用日",
  "支払方法",
  "内容",
  "メモ",
  "金額",
  "請求先組織",
];

function doGet(e) {
  return jsonResponse({ status: "ok", service: "keihi-seisan", sheet: SHEET_NAME });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "リクエストボディがありません。" });
    }

    var payload = JSON.parse(e.postData.contents);
    var transactions = payload.transactions || [];
    var period = payload.period || {};

    if (!Array.isArray(transactions)) {
      return jsonResponse({ status: "error", message: "transactionsが不正です。" });
    }

    var sheet = getOrCreateSheet();
    var now = new Date();

    var rows = transactions.map(function (t) {
      return [
        now,
        period.start || "",
        period.end || "",
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
