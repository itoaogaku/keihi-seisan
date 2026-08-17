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
  "取込ファイル",
];

var TRIP_REPORT_SHEET_NAME = "出張報告書データ";
var TRIP_REPORT_HEADER_ROW = [
  "ID",
  "更新日時",
  "発行日",
  "氏名",
  "出張日",
  "場所",
  "目的",
  "報告内容",
  "メモ",
  "出張経費(JSON)",
];

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : null;

  if (action === "list") {
    return jsonResponse({ status: "ok", records: getAllRecords() });
  }

  if (action === "listTripReports") {
    return jsonResponse({ status: "ok", reports: getAllTripReports() });
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
      sourceFile: safeText(row[9]) || "",
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

    if (payload.action === "saveTripReport") {
      var report = payload.report;
      if (!report || !report.id) {
        return jsonResponse({ status: "error", message: "報告書データが不正です。" });
      }
      upsertTripReportRow(getOrCreateTripReportSheet(), report);
      return jsonResponse({ status: "ok" });
    }

    if (payload.action === "deleteTripReport") {
      if (!payload.id) {
        return jsonResponse({ status: "error", message: "idが指定されていません。" });
      }
      deleteTripReportRow(getOrCreateTripReportSheet(), payload.id);
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
        t.sourceFile || "",
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

function getOrCreateTripReportSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TRIP_REPORT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TRIP_REPORT_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, TRIP_REPORT_HEADER_ROW.length).setValues([TRIP_REPORT_HEADER_ROW]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * IDが一致する行があれば上書き、なければ末尾に追加する(出張報告書の自動保存用)。
 */
function upsertTripReportRow(sheet, report) {
  var rowIndex = findTripReportRowIndex(sheet, report.id);
  var row = [
    report.id,
    new Date(),
    report.reportDate || "",
    report.applicantName || "",
    report.tripDate || "",
    report.location || "",
    report.purpose || "",
    report.content || "",
    report.memo || "",
    JSON.stringify(report.expenses || []),
  ];

  if (rowIndex === -1) {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}

function deleteTripReportRow(sheet, id) {
  var rowIndex = findTripReportRowIndex(sheet, id);
  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
  }
}

function findTripReportRowIndex(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      return 2 + i;
    }
  }
  return -1;
}

/**
 * 保存済みの出張報告書をすべて読み出す。出張経費はJSON列から復元する。
 */
function getAllTripReports() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TRIP_REPORT_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  var tz = ss.getSpreadsheetTimeZone();
  var values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, TRIP_REPORT_HEADER_ROW.length)
    .getValues();

  return values.map(function (row) {
    var expenses = [];
    try {
      expenses = JSON.parse(row[9] || "[]");
    } catch (err) {
      expenses = [];
    }
    return {
      id: safeText(row[0]),
      updatedAt: formatDateCell(row[1], tz, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
      reportDate: formatDateCell(row[2], tz, "yyyy-MM-dd"),
      applicantName: safeText(row[3]),
      tripDate: formatDateCell(row[4], tz, "yyyy-MM-dd"),
      location: safeText(row[5]),
      purpose: safeText(row[6]),
      content: safeText(row[7]),
      memo: safeText(row[8]),
      expenses: expenses,
    };
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
