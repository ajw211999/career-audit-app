import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';

export async function generatePDF(
  auditContent: string,
  clientName: string,
  tier: string
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v123.0.0/chromium-v123.0.0-pack.tar'
    ),
    headless: true,
  });

  const page = await browser.newPage();

  const rawHtml = await marked(auditContent);
  const contentHTML = sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'style'],
    },
  });

  const tierLabel =
    tier === '149'
      ? 'Career Clarity Audit + Strategic Exit Plan'
      : 'Career Clarity Audit';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Georgia', serif;
          font-size: 11pt;
          line-height: 1.7;
          color: #1a1a1a;
          padding: 60px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          border-bottom: 3px solid #1a1a1a;
          padding-bottom: 20px;
          margin-bottom: 32px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .brand {
          font-size: 9pt;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #666;
        }
        .client-info h1 {
          font-size: 22pt;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .client-info p {
          font-size: 10pt;
          color: #555;
          margin-top: 4px;
        }
        h2 {
          font-size: 14pt;
          font-weight: 700;
          margin: 28px 0 12px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e0e0e0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        h3 {
          font-size: 12pt;
          font-weight: 700;
          margin: 20px 0 8px;
        }
        p { margin-bottom: 12px; }
        ul, ol {
          margin: 8px 0 16px 20px;
        }
        li { margin-bottom: 6px; }
        strong { font-weight: 700; }
        blockquote {
          background: #f8f8f8;
          border-left: 4px solid #1a1a1a;
          padding: 14px 18px;
          margin: 16px 0;
          font-style: italic;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 10pt;
        }
        th {
          background: #1a1a1a;
          color: white;
          padding: 8px 12px;
          text-align: left;
        }
        td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }
        tr:nth-child(even) td { background: #f9f9f9; }
        .footer {
          margin-top: 60px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
          font-size: 9pt;
          color: #999;
          display: flex;
          justify-content: space-between;
        }
        @page {
          margin: 0;
          size: letter;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="client-info">
          <h1>${sanitizeHtml(clientName, { allowedTags: [] })}</h1>
          <p>${tierLabel} &nbsp;|&nbsp; Prepared by Antoine Wade &nbsp;|&nbsp; NxtGen Heights</p>
        </div>
        <div class="brand">NxtGen Heights</div>
      </div>

      <div class="content">
        ${contentHTML}
      </div>

      <div class="footer">
        <span>Confidential — prepared exclusively for ${sanitizeHtml(clientName, { allowedTags: [] })}</span>
        <span>nxtgenheights.com</span>
      </div>
    </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();
  return Buffer.from(pdf);
}
