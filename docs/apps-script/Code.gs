// Scorecard webhook. Paste this into the Sheet's Apps Script and deploy it as a new version of the
// SAME deployment, so the webhook URL does not change. Anyone can post to it, so nothing it receives
// is trusted. Columns 1-26 are the original layout, which main and /insurance still use.
// Tests: docs/apps-script/appsScript.test.js. The version this replaced is Code.original.gs.

var REPORT_URL_PREFIX = "https://scorecard.parkridgeadvisory.com/";

// v2 payload keys, in column order from V2_FIRST_COLUMN
var V2_FIRST_COLUMN = 27;
var V2_KEYS = [
  "challenges", "challenges_other", "lead_channels", "monthly_leads", "response_speed",
  "follow_up_attempts", "close_rate", "customer_value", "old_leads", "lead_tracking", "ai_level",
  "time_sinks", "estimate_kind", "monthly_low", "monthly_high", "yearly_low", "yearly_high",
  "hours_low", "hours_high", "top_leak", "ai_level_number", "band", "survey_version",
  "snapshot_url", "is_test"
];

// Sheets runs text starting with these characters as a formula. A leading apostrophe stores it as
// plain text. Anything that is not a string, number or boolean is turned into text first, because
// setValue would otherwise convert an array like ["=1+1"] back into a formula.
function neutralize(value) {
  if (value !== null && typeof value === "object") value = JSON.stringify(value);
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r\n]/.test(value) ? "'" + value : value;
}

function setCell(sheet, row, column, value) {
  sheet.getRange(row, column).setValue(neutralize(value));
}

// A link formula only for our own domain, with quotes escaped. Anything else is plain text.
function setReportUrl(sheet, row, url) {
  if (typeof url === "string" && url.indexOf(REPORT_URL_PREFIX) === 0) {
    sheet.getRange(row, 26).setFormula('=HYPERLINK("' + url.replace(/"/g, '""') + '","View Report")');
  } else {
    setCell(sheet, row, 26, url);
  }
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

// A new sheet stops at column Z, so writing past it would fail. Only v2 posts reach this.
function ensureV2Columns(sheet) {
  var lastColumn = V2_FIRST_COLUMN + V2_KEYS.length - 1;
  var maxColumns = sheet.getMaxColumns();
  if (maxColumns < lastColumn) sheet.insertColumnsAfter(maxColumns, lastColumn - maxColumns);
  for (var i = 0; i < V2_KEYS.length; i++) {
    var header = sheet.getRange(1, V2_FIRST_COLUMN + i);
    if (header.getValue() === "") header.setValue(V2_KEYS[i]);
  }
}

function writeV2Columns(sheet, row, data) {
  var ensured = false;
  for (var i = 0; i < V2_KEYS.length; i++) {
    var value = data[V2_KEYS[i]];
    if (!hasValue(value)) continue;
    if (!ensured) {
      ensureV2Columns(sheet);
      ensured = true;
    }
    setCell(sheet, row, V2_FIRST_COLUMN + i, value);
  }
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Scorecard Leads");
  var data = JSON.parse(e.postData.contents);

  var sessionId = data.session_id;
  var lastRow = sheet.getLastRow();
  var existingRow = -1;

  if (lastRow > 1) {
    var sessionIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < sessionIds.length; i++) {
      if (sessionIds[i][0] === sessionId) {
        existingRow = i + 2;
        break;
      }
    }
  }

  var row = existingRow > 0 ? existingRow : lastRow + 1;

  if (data.timestamp) setCell(sheet, row, 2, data.timestamp);
  if (data.session_id) setCell(sheet, row, 1, data.session_id);
  if (data.completed !== undefined) setCell(sheet, row, 3, data.completed);
  if (data.first_name) setCell(sheet, row, 4, data.first_name);
  if (data.email) setCell(sheet, row, 5, data.email);
  if (data.company) setCell(sheet, row, 6, data.company);
  if (data.score !== undefined) setCell(sheet, row, 7, data.score);
  if (data.q1_challenge) setCell(sheet, row, 8, data.q1_challenge);
  if (data.q2_tried) setCell(sheet, row, 9, data.q2_tried);
  if (data.q3_lead_sources) setCell(sheet, row, 10, data.q3_lead_sources);
  if (data.q4_lead_volume) setCell(sheet, row, 11, data.q4_lead_volume);
  if (data.q5_cpl_cac) setCell(sheet, row, 12, data.q5_cpl_cac);
  if (data.q5_cpl_value) setCell(sheet, row, 13, data.q5_cpl_value);
  if (data.q5_cac_value) setCell(sheet, row, 14, data.q5_cac_value);
  if (data.q6_who_sells) setCell(sheet, row, 15, data.q6_who_sells);
  if (data.q7_follow_up_speed) setCell(sheet, row, 16, data.q7_follow_up_speed);
  if (data.q8_sales_process) setCell(sheet, row, 17, data.q8_sales_process);
  if (data.q9_conversion_rate) setCell(sheet, row, 18, data.q9_conversion_rate);
  if (data.q9_conversion_value) setCell(sheet, row, 19, data.q9_conversion_value);
  if (data.q10_deal_falloff) setCell(sheet, row, 20, data.q10_deal_falloff);
  if (data.q11_crm) setCell(sheet, row, 21, data.q11_crm);
  if (data.q12_business_type) setCell(sheet, row, 22, data.q12_business_type);
  if (data.q13_years) setCell(sheet, row, 23, data.q13_years);
  if (data.q14_revenue) setCell(sheet, row, 24, data.q14_revenue);
  if (data.q15_deal_size) setCell(sheet, row, 25, data.q15_deal_size);
  if (data.report_url) setReportUrl(sheet, row, data.report_url);

  writeV2Columns(sheet, row, data);

  return ContentService.createTextOutput(JSON.stringify({status: "ok", row: row}))
    .setMimeType(ContentService.MimeType.JSON);
}
