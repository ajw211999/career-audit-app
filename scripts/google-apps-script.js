// Paste this into Google Apps Script attached to your Google Form response sheet.
// Extensions > Apps Script > paste > save.
// Then: Triggers > Add Trigger > onFormSubmit > From spreadsheet > On form submit.

const WEBHOOK_URL = 'https://your-app.vercel.app/api/intake';
const WEBHOOK_SECRET = 'your_webhook_secret_key'; // Must match WEBHOOK_SECRET in .env.local

function onFormSubmit(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var row = e.values;

    // Build key-value object from form response
    var formData = {};
    headers.forEach(function (header, index) {
      formData[header] = row[index] || '';
    });

    // Find the resume upload field
    var resumeField = headers.find(function (h) {
      return h.toLowerCase().indexOf('resume') !== -1 || h.toLowerCase().indexOf('upload') !== -1;
    });
    var resumeUrl = resumeField ? formData[resumeField] : null;

    // Download the resume from Drive and base64-encode it so Claude can read
    // it as a document block. Google Forms stores file uploads as Drive URLs
    // containing the file id; we extract it and fetch the blob directly.
    var resumeFileBase64 = null;
    var resumeMimeType = null;
    var resumeFilename = null;

    if (resumeUrl) {
      try {
        var idMatch = resumeUrl.match(/[-\w]{25,}/);
        if (idMatch) {
          var fileId = idMatch[0];
          var file = DriveApp.getFileById(fileId);
          var blob;

          if (file.getMimeType() === 'application/pdf') {
            blob = file.getBlob();
          } else {
            // docx / Google Doc etc. — try to export as PDF so Claude can read it.
            try {
              blob = file.getAs('application/pdf');
            } catch (convErr) {
              blob = file.getBlob();
            }
          }

          resumeFileBase64 = Utilities.base64Encode(blob.getBytes());
          resumeMimeType = blob.getContentType();
          resumeFilename = file.getName();
        }
      } catch (fileErr) {
        console.error('Resume download failed:', fileErr);
        // Fall through — audit still fires, just without the PDF attached.
      }
    }

    var payload = {
      secret: WEBHOOK_SECRET,
      timestamp: new Date().toISOString(),
      formData: formData,
      resumeUrl: resumeUrl,
      resumeFileBase64: resumeFileBase64,
      resumeMimeType: resumeMimeType,
      resumeFilename: resumeFilename,
    };

    var options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    var responseCode = response.getResponseCode();

    // Log result to sheet column (useful for debugging)
    var lastCol = sheet.getLastColumn();
    var rowIndex = e.range.getRow();
    sheet
      .getRange(rowIndex, lastCol + 1)
      .setValue(responseCode === 200 ? 'Webhook sent ✓' : 'Webhook failed: ' + responseCode);
  } catch (error) {
    console.error('Webhook error:', error);
  }
}

// Setup instructions:
// 1. Open your Google Form response spreadsheet
// 2. Extensions > Apps Script
// 3. Paste this entire script
// 4. Update WEBHOOK_URL and WEBHOOK_SECRET above
// 5. Add trigger: Triggers > Add Trigger > onFormSubmit > From spreadsheet > On form submit
// 6. Authorize permissions when prompted (it will ask for Drive + external URL access)
