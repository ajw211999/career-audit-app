// Paste this into Google Apps Script attached to your Google Form response sheet.
// Extensions > Apps Script > paste > save.
// Then: Triggers > Add Trigger > onFormSubmit > From spreadsheet > On form submit.
//
// PREREQUISITE: Drive API v3 must be enabled under Services (see SETUP.md §4 or the
// instructions in the commit that added this file). Without it, the .docx → PDF
// conversion will fail and non-PDF resumes will not be passed to Claude.

const WEBHOOK_URL = 'https://career-audit-app.vercel.app/api/intake';
const WEBHOOK_SECRET = '1a7738759187669db7bfd8f87cc83f969363cd4ee84de0e28590f81b3f643907';

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

    // Download the resume from Drive, convert to PDF if needed, and base64-encode
    // so Claude can read it as a document content block.
    var resumeFileBase64 = null;
    var resumeMimeType = null;
    var resumeFilename = null;
    var resumeStatus = 'no resume field';

    if (resumeUrl) {
      try {
        var idMatch = resumeUrl.match(/[-\w]{25,}/);
        if (idMatch) {
          var fileId = idMatch[0];
          var file = DriveApp.getFileById(fileId);
          resumeFilename = file.getName();

          var pdfBlob = convertToPdfIfNeeded(file);
          if (pdfBlob) {
            resumeFileBase64 = Utilities.base64Encode(pdfBlob.getBytes());
            resumeMimeType = 'application/pdf';
            resumeStatus = 'PDF attached';
          } else {
            resumeStatus = 'conversion failed';
          }
        } else {
          resumeStatus = 'could not extract file id from url';
        }
      } catch (fileErr) {
        console.error('Resume download/conversion failed:', fileErr.toString());
        resumeStatus = 'error: ' + fileErr.toString();
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

    // Log result to the sheet's next column — includes resume status so
    // you can see per-submission whether the resume made it through.
    var lastCol = sheet.getLastColumn();
    var rowIndex = e.range.getRow();
    var statusMessage =
      responseCode === 200
        ? 'Webhook ✓ | resume: ' + resumeStatus
        : 'Webhook failed: ' + responseCode + ' | resume: ' + resumeStatus;
    sheet.getRange(rowIndex, lastCol + 1).setValue(statusMessage);
  } catch (error) {
    console.error('Webhook error:', error);
  }
}

/**
 * Converts any Drive file to a PDF blob.
 * - Already-PDF files are returned as-is (no conversion).
 * - Anything else (.docx, .doc, .odt, .rtf, .txt, etc.) is uploaded to Drive
 *   as a temporary Google Doc (which triggers automatic format conversion),
 *   exported as PDF, and the temporary Google Doc is trashed.
 * - Returns null if conversion fails for any reason.
 *
 * REQUIRES Drive API v3 enabled under Services in the Apps Script editor.
 */
function convertToPdfIfNeeded(file) {
  try {
    var originalBlob = file.getBlob();

    if (originalBlob.getContentType() === 'application/pdf') {
      return originalBlob;
    }

    // Create a temporary Google Doc from the file (triggers auto-conversion)
    var tempName = '__cca_temp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    var fileMetadata = {
      name: tempName,
      mimeType: 'application/vnd.google-apps.document',
    };

    var tempDoc = Drive.Files.create(fileMetadata, originalBlob);

    try {
      return DriveApp.getFileById(tempDoc.id).getAs('application/pdf');
    } finally {
      // Always clean up the temp doc, even if the export above threw.
      try {
        DriveApp.getFileById(tempDoc.id).setTrashed(true);
      } catch (cleanupErr) {
        console.error('Temp file cleanup failed:', cleanupErr.toString());
      }
    }
  } catch (err) {
    console.error('convertToPdfIfNeeded error:', err.toString());
    return null;
  }
}

// ---------- Debugging helpers ----------
// Select these from the function dropdown and click Run to test in isolation.

function testDriveDownload() {
  // Verifies that DriveApp can read files. Uses a known file id from a prior
  // form submission. Update testFileId to a recent file from your form's
  // responses if this file has been deleted.
  var testFileId = '1-kcKOv3BrBoNdaMl1k2WFYkd6DENzwMR';
  console.log('=== Testing Drive file download ===');
  try {
    var file = DriveApp.getFileById(testFileId);
    console.log('SUCCESS: got file');
    console.log('  Name: ' + file.getName());
    console.log('  MIME: ' + file.getMimeType());
    console.log('  Size: ' + file.getSize() + ' bytes');
  } catch (err) {
    console.log('FAIL: ' + err.toString());
  }
}

function testDocxConversion() {
  // Verifies the full .docx → PDF conversion pipeline.
  // Requires Drive API v3 enabled under Services.
  var testFileId = '1-kcKOv3BrBoNdaMl1k2WFYkd6DENzwMR';
  console.log('=== Testing .docx → PDF conversion ===');
  try {
    var file = DriveApp.getFileById(testFileId);
    console.log('Original: ' + file.getName() + ' (' + file.getMimeType() + ', ' + file.getSize() + ' bytes)');

    var pdfBlob = convertToPdfIfNeeded(file);
    if (!pdfBlob) {
      console.log('FAIL: convertToPdfIfNeeded returned null');
      return;
    }

    console.log('SUCCESS: conversion returned a blob');
    console.log('  PDF content type: ' + pdfBlob.getContentType());
    console.log('  PDF byte length: ' + pdfBlob.getBytes().length);

    var bytes = pdfBlob.getBytes();
    var header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    console.log('  First 4 bytes as text: ' + header + ' (should be "%PDF")');

    var base64 = Utilities.base64Encode(bytes);
    console.log('  Base64 length: ' + base64.length);
  } catch (err) {
    console.log('FAIL: ' + err.toString());
  }
}

// Setup instructions:
// 1. Open your Google Form response spreadsheet
// 2. Extensions > Apps Script
// 3. Replace the entire file contents with this script
// 4. Services (left sidebar) > + > Drive API > Identifier: Drive, Version: v3 > Add
// 5. Add trigger: Triggers > Add Trigger > onFormSubmit > From spreadsheet > On form submit
// 6. Authorize permissions when prompted (Drive, Spreadsheets, External requests)
// 7. Run testDocxConversion from the function dropdown to verify conversion works
