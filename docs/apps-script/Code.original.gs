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

  if (data.timestamp) sheet.getRange(row, 2).setValue(data.timestamp);
  if (data.session_id) sheet.getRange(row, 1).setValue(data.session_id);
  if (data.completed !== undefined) sheet.getRange(row, 3).setValue(data.completed);
  if (data.first_name) sheet.getRange(row, 4).setValue(data.first_name);
  if (data.email) sheet.getRange(row, 5).setValue(data.email);
  if (data.company) sheet.getRange(row, 6).setValue(data.company);
  if (data.score !== undefined) sheet.getRange(row, 7).setValue(data.score);
  if (data.q1_challenge) sheet.getRange(row, 8).setValue(data.q1_challenge);
  if (data.q2_tried) sheet.getRange(row, 9).setValue(data.q2_tried);
  if (data.q3_lead_sources) sheet.getRange(row, 10).setValue(data.q3_lead_sources);
  if (data.q4_lead_volume) sheet.getRange(row, 11).setValue(data.q4_lead_volume);
  if (data.q5_cpl_cac) sheet.getRange(row, 12).setValue(data.q5_cpl_cac);
  if (data.q5_cpl_value) sheet.getRange(row, 13).setValue(data.q5_cpl_value);
  if (data.q5_cac_value) sheet.getRange(row, 14).setValue(data.q5_cac_value);
  if (data.q6_who_sells) sheet.getRange(row, 15).setValue(data.q6_who_sells);
  if (data.q7_follow_up_speed) sheet.getRange(row, 16).setValue(data.q7_follow_up_speed);
  if (data.q8_sales_process) sheet.getRange(row, 17).setValue(data.q8_sales_process);
  if (data.q9_conversion_rate) sheet.getRange(row, 18).setValue(data.q9_conversion_rate);
  if (data.q9_conversion_value) sheet.getRange(row, 19).setValue(data.q9_conversion_value);
  if (data.q10_deal_falloff) sheet.getRange(row, 20).setValue(data.q10_deal_falloff);
  if (data.q11_crm) sheet.getRange(row, 21).setValue(data.q11_crm);
  if (data.q12_business_type) sheet.getRange(row, 22).setValue(data.q12_business_type);
  if (data.q13_years) sheet.getRange(row, 23).setValue(data.q13_years);
  if (data.q14_revenue) sheet.getRange(row, 24).setValue(data.q14_revenue);
  if (data.q15_deal_size) sheet.getRange(row, 25).setValue(data.q15_deal_size);
  if (data.report_url) sheet.getRange(row, 26).setFormula('=HYPERLINK("' + data.report_url + '","View Report")');

  return ContentService.createTextOutput(JSON.stringify({status: "ok", row: row}))
    .setMimeType(ContentService.MimeType.JSON);
}
