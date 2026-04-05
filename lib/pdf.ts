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

  const monthYear = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const safeName = sanitizeHtml(clientName, { allowedTags: [] });

  const tierLabel =
    tier === '149'
      ? 'Career Clarity Audit + Strategic Exit Plan'
      : 'Career Clarity Audit';

  // Template modeled on Antoine's existing manual deliverable format —
  // plain title block at top, clean serif body, title-case headers without
  // the UPPERCASE/letter-spacing treatment, footer repeating the byline.
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 11pt;
          line-height: 1.65;
          color: #1a1a1a;
          padding: 64px 72px 56px 72px;
        }

        /* Cover block */
        .cover {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 24px;
          border-bottom: 2px solid #1a1a1a;
        }
        .cover-title {
          font-size: 16pt;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .cover-name {
          font-size: 22pt;
          font-weight: 700;
          letter-spacing: -0.3px;
          margin-bottom: 10px;
        }
        .cover-byline {
          font-size: 10pt;
          color: #555;
          font-style: italic;
        }

        /* Body typography */
        h1 {
          font-size: 16pt;
          font-weight: 700;
          margin: 36px 0 14px;
        }
        h2 {
          font-size: 14pt;
          font-weight: 700;
          margin: 32px 0 12px;
        }
        h3 {
          font-size: 12pt;
          font-weight: 700;
          margin: 22px 0 10px;
        }
        h4 {
          font-size: 11pt;
          font-weight: 700;
          margin: 18px 0 8px;
        }

        p { margin-bottom: 11px; }
        ul, ol {
          margin: 6px 0 14px 22px;
        }
        li { margin-bottom: 5px; }

        strong { font-weight: 700; }
        em { font-style: italic; }

        blockquote {
          background: #f8f8f8;
          border-left: 3px solid #1a1a1a;
          padding: 12px 16px;
          margin: 14px 0;
          font-style: italic;
        }

        hr {
          border: none;
          border-top: 1px solid #d0d0d0;
          margin: 28px 0;
        }

        code {
          background: #f4f4f4;
          padding: 2px 6px;
          border-radius: 2px;
          font-family: 'Menlo', 'Courier New', monospace;
          font-size: 10pt;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 14px 0;
          font-size: 10pt;
        }
        th {
          background: #f4f4f4;
          color: #1a1a1a;
          padding: 8px 12px;
          text-align: left;
          border-bottom: 2px solid #1a1a1a;
        }
        td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }

        .footer {
          margin-top: 48px;
          padding-top: 14px;
          border-top: 1px solid #d0d0d0;
          font-size: 9pt;
          color: #666;
          text-align: center;
          font-style: italic;
        }

        @page {
          margin: 0;
          size: letter;
        }
      </style>
    </head>
    <body>
      <div class="cover">
        <div class="cover-title">${tierLabel}</div>
        <div class="cover-name">${safeName}</div>
        <div class="cover-byline">Prepared by NxtGen Heights with Antoine Wade &nbsp;&middot;&nbsp; ${monthYear}</div>
      </div>

      <div class="content">
        ${contentHTML}
      </div>

      <div class="footer">
        Career Clarity Audit &nbsp;&middot;&nbsp; ${safeName} &nbsp;&middot;&nbsp; Prepared by NxtGen Heights with Antoine Wade &nbsp;&middot;&nbsp; ${monthYear}
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
