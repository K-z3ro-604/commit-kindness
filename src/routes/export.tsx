import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, FileDown, Loader2, Type, Baseline, Maximize, AlignJustify, Frame, BookOpen } from "lucide-react";
import { BookFrame, FootnoteRule, HeadingOrnament, type BookFrameStyle } from "@/components/book-ornament";
import { loadDocument } from "@/lib/document";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "تنسيق وتصدير — صوتُك" },
      { name: "description", content: "نسّق النص النهائي كصفحة كتاب علمي مزخرفة مع معاينة A4 حيّة وصدّره إلى Word أو PDF." },
      { property: "og:title", content: "تنسيق وتصدير — صوتُك" },
      { property: "og:description", content: "نسّق نصك ككتاب علمي وصدّره إلى Word أو PDF بضغطة واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExportPage,
});

const SAMPLE_TEXT = `إنَّ الكتابةَ الصحيحةَ مهمةٌ جدًّا في حياتنا اليومية، فهي الجسر الذي تعبر عليه الأفكار من عقل إلى آخر، وبها تُحفظ المعارف وتنتقل عبر الأجيال (١).

وقد عُني العلماء قديمًا بضبط النصوص وتحريرها، فوضعوا لذلك قواعد دقيقة في الرواية والنسخ والمقابلة، حتى صار علم التحقيق فنًّا قائمًا بذاته.

[١] انظر: مقدمة ابن خلدون، فصل في صناعة الخط والكتابة.`;

const FOOTNOTE_RE = /^\s*[[(]\s*[0-9٠-٩]+\s*[\])]\s*/;

function parseDocument(text: string) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return {
    paragraphs: lines.filter((l) => !FOOTNOTE_RE.test(l)),
    footnotes: lines.filter((l) => FOOTNOTE_RE.test(l)),
  };
}

const FONTS = [
  { label: "أميري (Amiri)", value: "Amiri" },
  { label: "شهرزاد (Scheherazade New)", value: "Scheherazade New" },
  { label: "نسخ (Noto Naskh)", value: "Noto Naskh Arabic" },
  { label: "القاهرة (Cairo)", value: "Cairo" },
  { label: "تجوّل (Tajawal)", value: "Tajawal" },
];

const FRAMES: Array<{ label: string; value: BookFrameStyle }> = [
  { label: "إطار بسيط", value: "simple" },
  { label: "إسلامي كلاسيكي", value: "classic" },
  { label: "زهري ملكي", value: "royal" },
  { label: "علمي مبسّط", value: "scientific" },
];

const A4_W = 794; // px @96dpi
const A4_H = 1123;
const MM = 3.7795; // px per mm
const PAGE_PX_TO_PT = 0.75;
const PREVIEW_GAP = 24;

type PageItem =
  | { kind: "title"; text: string }
  | { kind: "chapter"; text: string }
  | { kind: "paragraph"; text: string; continued?: boolean }
  | { kind: "footnote"; text: string; continued?: boolean }
  | { kind: "ornament" }
  | { kind: "footnote-rule" };

type BookPage = { items: PageItem[] };

function paginateBook(
  book: ReturnType<typeof parseDocument> & { title: string; chapter: string },
  options: { font: string; pxSize: number; lineHeight: number; padding: number },
): BookPage[] {
  const { font, pxSize, lineHeight, padding } = options;
  const measureRoot = document.createElement("div");
  const contentWidth = A4_W - padding * 2;
  const footerReserve = Math.max(34, pxSize * 2.1);
  const pageCapacity = A4_H - padding * 2 - footerReserve;
  measureRoot.dir = "rtl";
  measureRoot.style.cssText = [
    "position:fixed",
    "visibility:hidden",
    "pointer-events:none",
    "inset-inline-start:-10000px",
    `width:${contentWidth}px`,
    `font-family:'${font}','Amiri',serif`,
    `font-size:${pxSize}px`,
    `line-height:${lineHeight}`,
  ].join(";");
  document.body.appendChild(measureRoot);

  const measure = (item: PageItem) => {
    if (item.kind === "ornament") return 14 + pxSize * 0.5;
    if (item.kind === "footnote-rule") return pxSize * 1.2 + 14 + pxSize * 0.4;
    const node = document.createElement(item.kind === "title" || item.kind === "chapter" ? `h${item.kind === "title" ? 1 : 2}` : "p");
    node.textContent = item.text;
    node.style.cssText = "margin:0;width:100%;box-sizing:border-box;overflow-wrap:anywhere;";
    if (item.kind === "title") {
      node.style.fontSize = `${pxSize * 1.9}px`;
      node.style.fontWeight = "700";
      node.style.textAlign = "center";
      node.style.lineHeight = "1.4";
    } else if (item.kind === "chapter") {
      node.style.fontSize = `${pxSize * 1.25}px`;
      node.style.fontWeight = "700";
      node.style.textAlign = "center";
      node.style.lineHeight = "1.5";
    } else if (item.kind === "paragraph") {
      node.style.textAlign = "justify";
      node.style.textIndent = item.continued ? "0" : "1.5em";
    } else {
      node.style.fontSize = `${pxSize * 0.78}px`;
      node.style.lineHeight = "1.7";
      node.style.textAlign = "justify";
    }
    measureRoot.appendChild(node);
    const marginBottom = item.kind === "title"
      ? pxSize * 0.3
      : item.kind === "chapter"
        ? pxSize * 1.2
        : item.kind === "paragraph"
          ? pxSize * 0.6
          : 2;
    const height = node.getBoundingClientRect().height + marginBottom;
    node.remove();
    return height;
  };

  const pages: BookPage[] = [{ items: [] }];
  let used = 0;
  const newPage = () => {
    pages.push({ items: [] });
    used = 0;
  };
  const addFixed = (item: PageItem) => {
    const height = measure(item);
    if (used > 0 && used + height > pageCapacity - 1) newPage();
    pages[pages.length - 1]?.items.push(item);
    used += height;
  };

  const addFlowingText = (kind: "paragraph" | "footnote", text: string) => {
    let words = text.trim().split(/\s+/).filter(Boolean);
    let continued = false;
    while (words.length > 0) {
      const available = pageCapacity - used - 1;
      let low = 1;
      let high = words.length;
      let fit = 0;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate: PageItem = { kind, text: words.slice(0, mid).join(" "), continued };
        if (measure(candidate) <= available) {
          fit = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      if (fit === 0 && used > 0) {
        newPage();
        continue;
      }
      if (fit === 0) fit = 1;
      const item: PageItem = { kind, text: words.slice(0, fit).join(" "), continued };
      pages[pages.length - 1]?.items.push(item);
      used += measure(item);
      words = words.slice(fit);
      continued = true;
      if (words.length > 0) newPage();
    }
  };

  addFixed({ kind: "title", text: book.title });
  addFixed({ kind: "ornament" });
  addFixed({ kind: "chapter", text: book.chapter });
  book.paragraphs.forEach((paragraph) => addFlowingText("paragraph", paragraph));
  if (book.footnotes.length > 0) {
    const ruleHeight = measure({ kind: "footnote-rule" });
    const firstLineHeight = pxSize * 0.78 * 1.7 + 2;
    if (used > 0 && used + ruleHeight + firstLineHeight > pageCapacity - 1) newPage();
    addFixed({ kind: "footnote-rule" });
    book.footnotes.forEach((footnote) => addFlowingText("footnote", footnote));
  }
  measureRoot.remove();
  return pages;
}

// html2canvas can't parse oklch(): temporarily replace theme variables with rgb equivalents
function flattenOklchVars() {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const changed: string[] = [];
  if (!ctx) return () => {};
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i]!;
    if (!name.startsWith("--")) continue;
    const val = cs.getPropertyValue(name).trim();
    if (!/^oklch\(/.test(val)) continue;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = val;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    root.style.setProperty(name, `rgba(${r}, ${g}, ${b}, ${(a ?? 255) / 255})`);
    changed.push(name);
  }
  return () => changed.forEach((n) => root.style.removeProperty(n));
}

function ExportPage() {
  const [font, setFont] = useState("Amiri");
  const [size, setSize] = useState(16); // pt
  const [margin, setMargin] = useState(25); // mm
  const [lineHeight, setLineHeight] = useState(1.8);
  const [frameStyle, setFrameStyle] = useState<BookFrameStyle>("classic");
  const [title, setTitle] = useState("رسالة في فن الكتابة");
  const [chapter, setChapter] = useState("الباب الأول: في فضل العلم");
  const [text, setText] = useState(SAMPLE_TEXT);
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [scale, setScale] = useState(1);
  const [pages, setPages] = useState<BookPage[]>([{ items: [] }]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadDocument();
    if (saved.trim()) setText(saved);
  }, []);

  const BOOK = useMemo(() => ({ title, chapter, ...parseDocument(text) }), [title, chapter, text]);
  const slugName = (ext: string) => `${(title || "كتاب").replace(/\s+/g, "-")}.${ext}`;
  const padding = Math.max(margin * MM, 72);
  const pxSize = size / PAGE_PX_TO_PT;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setScale(Math.min(1, e.contentRect.width / A4_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setPages(paginateBook(BOOK, { font, pxSize, lineHeight, padding }));
    });
    return () => { cancelled = true; };
  }, [BOOK, font, pxSize, lineHeight, padding]);

  const exportPdf = async () => {
    if (!pagesRef.current) return;
    setBusy("pdf");
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await document.fonts.ready;
      const clone = pagesRef.current.cloneNode(true) as HTMLElement;
      clone.style.width = `${A4_W}px`;
      clone.style.minHeight = `${A4_H}px`;
      clone.style.height = "auto";
      clone.style.display = "block";
      clone.style.gap = "0";
      // html2canvas can't parse oklch theme colors — use plain print colors
      [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))].forEach((el) => {
        const muted = el.classList.contains("text-muted-foreground");
        const rule = el.classList.contains("bg-border");
        el.removeAttribute("class");
        el.style.color = muted ? "#8a8070" : "#1f1b24";
        el.style.backgroundColor = rule ? "#e6dccf" : "transparent";
        el.style.boxShadow = "none";
        el.style.borderColor = "transparent";
        el.style.outlineColor = "transparent";
        el.style.textDecorationColor = "currentColor";
        el.style.caretColor = "auto";
        el.style.columnRuleColor = "transparent";
      });
      clone.style.backgroundColor = "#ffffff";
      const holder = document.createElement("div");
      holder.style.cssText = `position:fixed;top:0;inset-inline-start:-10000px;width:${A4_W}px;`;
      holder.appendChild(clone);
      document.body.appendChild(holder);
      const restoreVars = flattenOklchVars();
      const pdfOptions = {
          margin: 0,
          filename: slugName("pdf"),
          image: { type: "jpeg" as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
          pagebreak: { mode: ["css", "legacy"], avoid: [".a4-page-content", "p", "h1", "h2", "svg"] },
        };
      await html2pdf()
        .set(pdfOptions)
        .from(clone)
        .save();
      holder.remove();
      restoreVars();
    } finally {
      setBusy(null);
    }
  };

  const exportDocx = async () => {
    setBusy("docx");
    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } = await import("docx");
      const twip = (mm: number) => Math.round(mm * 56.7);
      const line = Math.round(240 * lineHeight);
      const run = (text: string, pt: number, bold = false) =>
        new TextRun({ text, font, size: pt * 2, bold, rightToLeft: true });
      const border = { style: BorderStyle.DOUBLE, size: 12, color: "8A6A2F", space: 24 };
      const pageMargin = twip(Math.max(margin, 22));
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                size: { width: 11906, height: 16838 },
                margin: { top: pageMargin, bottom: pageMargin, left: pageMargin, right: pageMargin },
                borders: { pageBorderTop: border, pageBorderBottom: border, pageBorderLeft: border, pageBorderRight: border },
              },
            },
            children: [
              new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(BOOK.title, size + 10, true)] }),
              new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "❁", color: "8A6A2F", size: 24 })] }),
              new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [run(BOOK.chapter, size + 3, true)] }),
              ...BOOK.paragraphs.map(
                (p) =>
                  new Paragraph({
                    bidirectional: true,
                    alignment: AlignmentType.BOTH,
                    indent: { firstLine: 567 },
                    spacing: { line, after: 160 },
                    children: [run(p, size)],
                  }),
              ),
              ...(BOOK.footnotes.length
                ? [
                    new Paragraph({
                      bidirectional: true,
                      spacing: { before: 400, after: 80 },
                      indent: { left: 6000 },
                      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "8A6A2F", space: 1 } },
                      children: [],
                    }),
                    ...BOOK.footnotes.map(
                      (f) => new Paragraph({ bidirectional: true, alignment: AlignmentType.BOTH, spacing: { after: 60 }, children: [run(f, Math.max(9, size - 4))] }),
                    ),
                  ]
                : []),
            ],
          },
        ],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = slugName("docx");
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="export-workspace mx-auto w-full max-w-7xl px-5 pb-12 pt-2 lg:px-10 lg:pt-10">
      <section className="mt-1 lg:mt-0">
        <h1 className="font-display text-[27px] font-extrabold leading-[1.15] text-foreground md:text-4xl">
          تنسيق <span className="text-brand">وتصدير</span>
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground md:text-sm">
          صمّم نصك ككتاب، شاهد المعاينة الحيّة، ثم صدّره بضغطة واحدة.
        </p>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[300px_1fr]">
        <aside className="flex flex-col gap-5 self-start rounded-3xl border border-line bg-card p-5 shadow-card">
          <Control icon={<BookOpen className="size-4 text-brand" />} label="عنوان الكتاب">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </Control>
          <Control icon={<BookOpen className="size-4 text-brand" />} label="عنوان الباب / الفصل">
            <input value={chapter} onChange={(e) => setChapter(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </Control>
          <Control icon={<AlignJustify className="size-4 text-brand" />} label="متن النص">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
              className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-7 text-foreground outline-none focus:ring-2 focus:ring-ring" />
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              للحواشي: ابدأ السطر برقم بين قوسين مثل [١] ليظهر أسفل الصفحة تحت الفاصل.
            </span>
          </Control>
          <Control icon={<Type className="size-4 text-brand" />} label="نوع الخط">
            <select
              value={font}
              onChange={(e) => setFont(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
              ))}
            </select>
          </Control>
          <Control icon={<Frame className="size-4 text-brand" />} label="نمط إطار الصفحة">
            <select
              value={frameStyle}
              onChange={(e) => setFrameStyle(e.target.value as BookFrameStyle)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {FRAMES.map((frame) => <option key={frame.value} value={frame.value}>{frame.label}</option>)}
            </select>
          </Control>
          <Slider icon={<Baseline className="size-4 text-brand" />} label="حجم الخط" value={size} min={11} max={24} step={1} unit="نقطة" onChange={setSize} />
          <Slider icon={<Maximize className="size-4 text-brand" />} label="هوامش الصفحة" value={margin} min={10} max={40} step={1} unit="مم" onChange={setMargin} />
          <Slider icon={<AlignJustify className="size-4 text-brand" />} label="تباعد الأسطر" value={lineHeight} min={1.2} max={2.6} step={0.1} unit="×" onChange={setLineHeight} />


          <div className="mt-2 flex flex-col gap-3">
            <button
              onClick={exportDocx}
              disabled={!!busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 font-display text-sm font-extrabold text-background shadow-ink transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {busy === "docx" ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}
              تصدير كملف Word (DOCX)
            </button>
            <button
              onClick={exportPdf}
              disabled={!!busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3.5 font-display text-sm font-extrabold text-primary-foreground shadow-brand transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {busy === "pdf" ? <Loader2 className="size-5 animate-spin" /> : <FileDown className="size-5" />}
              تصدير كملف PDF
            </button>
          </div>
        </aside>

        <section className="print-preview min-w-0 overflow-hidden rounded-3xl bg-muted p-4 md:p-8">
          <p className="mb-4 text-center text-xs font-bold text-muted-foreground">معاينة الطباعة · A4</p>
          <div ref={wrapRef} className="mx-auto w-full max-w-[794px]">
            <div className="a4-page-stage" style={{ height: (pages.length * A4_H + Math.max(0, pages.length - 1) * PREVIEW_GAP) * scale }}>
              <div
                ref={pagesRef}
                className="a4-pages"
                style={{ width: A4_W, display: "flex", flexDirection: "column", gap: PREVIEW_GAP, transform: `scale(${scale})`, transformOrigin: "top right" }}
              >
                {pages.map((page, pageIndex) => (
                  <A4Page
                    key={pageIndex}
                    page={page}
                    pageNumber={pageIndex + 1}
                    padding={padding}
                    font={font}
                    pxSize={pxSize}
                    lineHeight={lineHeight}
                    frameStyle={frameStyle}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function A4Page({ page, pageNumber, padding, font, pxSize, lineHeight, frameStyle }: {
  page: BookPage;
  pageNumber: number;
  padding: number;
  font: string;
  pxSize: number;
  lineHeight: number;
  frameStyle: BookFrameStyle;
}) {
  return (
    <div
      dir="rtl"
      className="a4-print-page bg-card text-card-foreground shadow-card"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: A4_W,
        height: A4_H,
        padding,
        fontFamily: `'${font}', 'Amiri', serif`,
        fontSize: pxSize,
        lineHeight,
        boxSizing: "border-box",
        overflow: "hidden",
        breakInside: "avoid",
        pageBreakInside: "avoid",
        breakAfter: "page",
        pageBreakAfter: "always",
      }}
    >
      <BookFrame width={A4_W} height={A4_H} variant={frameStyle} />
      <div className="a4-page-content" style={{ position: "relative", zIndex: 1 }}>
        {page.items.map((item, itemIndex) => {
          if (item.kind === "ornament") return <div key={itemIndex} style={{ height: 14, marginBottom: pxSize * 0.5 }}><HeadingOrnament /></div>;
          if (item.kind === "footnote-rule") return <div key={itemIndex} style={{ paddingTop: pxSize * 1.2, marginBottom: pxSize * 0.4 }}><FootnoteRule /></div>;
          if (item.kind === "title") return <h1 key={itemIndex} style={{ fontSize: pxSize * 1.9, fontWeight: 700, textAlign: "center", lineHeight: 1.4, margin: 0, marginBottom: pxSize * 0.3, breakInside: "avoid" }}>{item.text}</h1>;
          if (item.kind === "chapter") return <h2 key={itemIndex} style={{ fontSize: pxSize * 1.25, fontWeight: 700, textAlign: "center", lineHeight: 1.5, margin: 0, marginBottom: pxSize * 1.2, breakInside: "avoid" }}>{item.text}</h2>;
          if (item.kind === "footnote") return <p key={itemIndex} style={{ fontSize: pxSize * 0.78, lineHeight: 1.7, textAlign: "justify", margin: 0, marginBottom: 2, overflowWrap: "anywhere", breakInside: "avoid" }}>{item.text}</p>;
          if (item.kind === "paragraph") return <p key={itemIndex} style={{ textAlign: "justify", textIndent: item.continued ? 0 : "1.5em", margin: 0, marginBottom: pxSize * 0.6, overflowWrap: "anywhere", breakInside: "avoid" }}>{item.text}</p>;
          return null;
        })}
      </div>
      <p className="text-muted-foreground" style={{ position: "absolute", zIndex: 1, insetInline: padding, bottom: padding * 0.45, textAlign: "center", margin: 0, fontSize: pxSize * 0.8 }}>
        ﴿ {pageNumber.toLocaleString("ar-EG")} ﴾
      </p>
    </div>
  );
}

function Control({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center gap-2 font-display text-sm font-bold text-foreground">{icon}{label}</span>
      {children}
    </label>
  );
}

function Slider({ icon, label, value, min, max, step, unit, onChange }: {
  icon: React.ReactNode; label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <Control icon={icon} label={label}>
      <div className="flex items-center gap-3">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-brand"
        />
        <span className="min-w-[64px] rounded-lg bg-muted px-2 py-1 text-center text-xs font-bold text-foreground">
          {value.toLocaleString("ar-EG", { maximumFractionDigits: 1 })} {unit}
        </span>
      </div>
    </Control>
  );
}
