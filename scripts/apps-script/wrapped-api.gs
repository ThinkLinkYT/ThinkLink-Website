const SHEET_NAME = "WrappedPayloads";
const MAX_ROWS_TO_SCAN = 5000;

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
    const expectedKey = getScriptProperty_("WRAPPED_API_KEY");

    if (expectedKey && body.key !== expectedKey) {
      return json_({ ok: false, error: "Unauthorized" });
    }

    const payload = body.payload;
    if (!payload || !payload.id) {
      return json_({ ok: false, error: "Missing payload or payload ID" });
    }

    const sheet = getSheet_();
    const now = new Date().toISOString();
    const row = findRowById_(sheet, payload.id);
    const values = [
      payload.id,
      payload.user && payload.user.id ? payload.user.id : "",
      payload.generatedAt || now,
      now,
      JSON.stringify(payload)
    ];

    if (row > 0) {
      sheet.getRange(row, 1, 1, values.length).setValues([values]);
    } else {
      sheet.appendRow(values);
    }

    return json_({ ok: true, id: payload.id });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet(e) {
  const callback = e.parameter.callback;

  try {
    const id = e.parameter.id;
    if (!id) return output_({ ok: false, error: "Missing id" }, callback);

    const sheet = getSheet_();
    const row = findRowById_(sheet, id);
    if (row < 1) return output_({ ok: false, error: "Wrapped ID not found" }, callback);

    const rawPayload = sheet.getRange(row, 5).getValue();
    return output_({ ok: true, payload: JSON.parse(rawPayload) }, callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, callback);
  }
}

function getSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(["id", "userId", "createdAt", "updatedAt", "payload"]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty("SPREADSHEET_ID");

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const spreadsheet = SpreadsheetApp.create("ThinkLink Wrapped Payloads");
  props.setProperty("SPREADSHEET_ID", spreadsheet.getId());
  return spreadsheet;
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const startRow = Math.max(2, lastRow - MAX_ROWS_TO_SCAN + 1);
  const values = sheet.getRange(startRow, 1, lastRow - startRow + 1, 1).getValues();

  for (let index = values.length - 1; index >= 0; index--) {
    if (String(values[index][0]) === String(id)) {
      return startRow + index;
    }
  }

  return -1;
}

function output_(data, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(data)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json_(data);
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getScriptProperty_(name) {
  return PropertiesService.getScriptProperties().getProperty(name) || "";
}
