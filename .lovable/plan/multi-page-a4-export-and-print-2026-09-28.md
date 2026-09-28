# Multi-page A4 export and print

## Goal
Make long Arabic text flow across as many A4 pages as needed in the live preview, PDF export, and browser print output. Every page must repeat the selected decorative frame, and page boundaries must fall between complete text lines.

## Changes
- Replace the single expanding preview sheet with measured, explicit A4 page components.
- Paginate title, chapter, body paragraphs, and footnotes using the actual selected font, size, line spacing, and margins.
- Split oversized paragraphs only at safe word boundaries, using browser layout measurements to keep complete rendered lines together.
- Render the chosen frame independently on every generated page, with stable page dimensions and per-page numbering.
- Export the already-paginated sheets through `html2pdf.js`, enabling CSS page-break handling and preventing each page or text block from being cut internally.
- Update print CSS so each sheet prints as one borderless A4 page, while allowing any number of pages.

## Verification
- Test short and long Arabic documents in the preview.
- Export a multi-page PDF and visually inspect every rendered page for repeated frames, missing text, overflow, and cut lines.
- Open browser print rendering and confirm A4 page boundaries match the preview.
