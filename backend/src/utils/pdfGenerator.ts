import PDFDocument from "pdfkit";

export interface SummaryItem {
  label: string;
  value: string;
}

export interface CategoryRow {
  name: string;
  total: string;
  percent: string;
  percentNum: number;
}

export interface TransactionRow {
  date: string;
  description: string;
  descriptionSub: string;
  category: string;
  type: string;
  amount: string;
}

export interface ReportData {
  title: string;
  dateRange: string;
  generatedAt: Date;
  documentId: string;
  totalIncome: string;
  totalExpenses: string;
  netSavings: string;
  savingsMessage: string;
  categories: CategoryRow[];
  transactions: TransactionRow[];
  appUrl: string;
}

const C = {
  primary: "#4338ca",
  primaryLight: "#ede9fe",
  heading: "#111827",
  text: "#374151",
  muted: "#6b7280",
  mutedLight: "#9ca3af",
  border: "#e5e7eb",
  bgCard: "#f9fafb",
  white: "#ffffff",
  green: "#059669",
  greenBg: "#ecfdf5",
  greenDark: "#065f46",
  red: "#dc2626",
  barBlue: "#4338ca",
  barCategory: ["#4338ca", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"],
  categoryBadge: {
    FOOD: { bg: "#fee2e2", text: "#dc2626" },
    INCOME: { bg: "#dcfce7", text: "#16a34a" },
    HEALTH: { bg: "#dbeafe", text: "#2563eb" },
    TRANSPORT: { bg: "#ede9fe", text: "#7c3aed" },
    LIFESTYLE: { bg: "#fce7f3", text: "#db2777" },
    DEFAULT: { bg: "#f3f4f6", text: "#4b5563" },
  } as Record<string, { bg: string; text: string }>,
  dark: "#1e1b4b",
};

const PAGE_W = 595.28; // A4
const M = 40; // margin
const CONTENT_W = PAGE_W - M * 2;

function roundedRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  doc.save();
  doc.roundedRect(x, y, w, h, r);
  if (fill) doc.fillColor(fill).fill();
  if (stroke) { doc.roundedRect(x, y, w, h, r); doc.strokeColor(stroke).lineWidth(0.5).stroke(); }
  doc.restore();
}

function drawBar(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, pct: number, color: string) {
  doc.save();
  doc.roundedRect(x, y, w, h, h / 2).fillColor("#e5e7eb").fill();
  if (pct > 0) {
    const barW = Math.max(h, w * Math.min(pct / 100, 1));
    doc.roundedRect(x, y, barW, h, h / 2).fillColor(color).fill();
  }
  doc.restore();
}

export function generatePdfBuffer(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: M, left: M, right: M, bottom: 0 } });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = M;

    // ════════════════════════════════════════════════════
    // HEADER BAR
    // ════════════════════════════════════════════════════
    doc.save();
    doc.rect(0, 0, PAGE_W, 3).fillColor(C.primary).fill();
    doc.restore();

    y = 18;
    doc.fontSize(14).fillColor(C.primary).font("Helvetica-Bold").text("FinPilot", M, y, { continued: true });
    doc.fontSize(10).fillColor(C.mutedLight).font("Helvetica").text("  |  Financial Intelligence Report", { continued: false });

    doc.fontSize(7).fillColor(C.mutedLight).font("Helvetica").text("DOCUMENT ID", PAGE_W - M - 120, y, { width: 120, align: "right" });
    doc.fontSize(9).fillColor(C.heading).font("Helvetica-Bold").text(data.documentId, PAGE_W - M - 120, y + 10, { width: 120, align: "right" });

    y = 50;
    doc.strokeColor(C.border).lineWidth(0.5).moveTo(M, y).lineTo(PAGE_W - M, y).stroke();

    // ════════════════════════════════════════════════════
    // REPORTING PERIOD
    // ════════════════════════════════════════════════════
    y = 62;
    doc.fontSize(7).fillColor(C.mutedLight).font("Helvetica-Bold").text("REPORTING PERIOD", M, y);
    doc.fontSize(18).fillColor(C.heading).font("Helvetica-Bold").text("Monthly Financial Overview", M, y + 12);

    doc.fontSize(7).fillColor(C.mutedLight).font("Helvetica-Bold").text("EXPORTED ON", PAGE_W - M - 140, y, { width: 140, align: "right" });
    const exportDate = data.generatedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    doc.fontSize(12).fillColor(C.heading).font("Helvetica-Bold").text(exportDate, PAGE_W - M - 140, y + 12, { width: 140, align: "right" });

    // ════════════════════════════════════════════════════
    // SUMMARY CARDS
    // ════════════════════════════════════════════════════
    y = 108;
    const cardH = 70;
    const cardGap = 12;
    const cardW = (CONTENT_W - cardGap * 2) / 3;

    // Card 1 — Total Monthly Income
    roundedRect(doc, M, y, cardW, cardH, 8, C.bgCard, C.border);
    doc.fontSize(7).fillColor(C.mutedLight).font("Helvetica").text("Total Monthly Income", M + 14, y + 12);
    doc.fontSize(20).fillColor(C.heading).font("Helvetica-Bold").text(data.totalIncome, M + 14, y + 26);
    drawBar(doc, M + 14, y + 54, cardW - 28, 5, 100, C.primary);

    // Card 2 — Total Monthly Expenses
    const c2x = M + cardW + cardGap;
    roundedRect(doc, c2x, y, cardW, cardH, 8, C.bgCard, C.border);
    doc.fontSize(7).fillColor(C.mutedLight).font("Helvetica").text("Total Monthly Expenses", c2x + 14, y + 12);
    doc.fontSize(20).fillColor(C.heading).font("Helvetica-Bold").text(data.totalExpenses, c2x + 14, y + 26);
    drawBar(doc, c2x + 14, y + 54, cardW - 28, 5, 60, C.primary);

    // Card 3 — Net Savings Intelligence (green)
    const c3x = M + (cardW + cardGap) * 2;
    roundedRect(doc, c3x, y, cardW, cardH, 8, C.greenBg);
    doc.fontSize(7).fillColor(C.green).font("Helvetica-Bold").text("Net Savings Intelligence", c3x + 14, y + 12);
    doc.fontSize(22).fillColor(C.greenDark).font("Helvetica-Bold").text(data.netSavings, c3x + 14, y + 28);
    doc.fontSize(7).fillColor(C.green).font("Helvetica").text(data.savingsMessage, c3x + 14, y + 52, { width: cardW - 28 });

    // ════════════════════════════════════════════════════
    // EXPENSE DISTRIBUTION + TRANSACTION HISTORY (side by side)
    // ════════════════════════════════════════════════════
    y = 200;
    const leftW = CONTENT_W * 0.42;
    const rightW = CONTENT_W - leftW - 14;
    const rightX = M + leftW + 14;

    // ── Expense Distribution ──
    doc.fontSize(12).fillColor(C.heading).font("Helvetica-Bold").text("Expense Distribution", M, y);
    y += 24;

    const catBoxY = y;
    const catRowH = 56;
    const catBoxH = Math.min(data.categories.length, 4) * catRowH + 16;
    roundedRect(doc, M, catBoxY, leftW, catBoxH, 8, C.white, C.border);

    let cy = catBoxY + 12;
    const maxCats = Math.min(data.categories.length, 4);
    for (let i = 0; i < maxCats; i++) {
      const cat = data.categories[i];
      const barColor = C.barCategory[i % C.barCategory.length];

      doc.fontSize(9).fillColor(C.text).font("Helvetica").text(cat.name, M + 14, cy, { width: leftW * 0.5 });
      doc.fontSize(9).fillColor(C.heading).font("Helvetica-Bold").text(
        `$${cat.total}`, M + 14 + leftW * 0.48, cy, { width: 70 }
      );
      doc.fontSize(8).fillColor(C.mutedLight).font("Helvetica").text(
        `(${cat.percent})`, M + 14 + leftW * 0.48 + 70, cy
      );
      drawBar(doc, M + 14, cy + 16, leftW - 28, 6, cat.percentNum, barColor);

      cy += catRowH;
    }

    // ── Transaction History ──
    const txHeaderY = y - 24;
    doc.fontSize(12).fillColor(C.heading).font("Helvetica-Bold").text("Transaction History", rightX, txHeaderY);

    const txBoxY = y;
    const txRowH = 40;
    const txCount = Math.min(data.transactions.length, 5);
    const txBoxH = txCount * txRowH + 36;
    roundedRect(doc, rightX, txBoxY, rightW, txBoxH, 8, C.white, C.border);

    // Table header
    const txPad = 12;
    const txDateX = rightX + txPad;
    const txDescX = txDateX + 62;
    const txCatX = txDescX + 100;
    const txAmtX = rightX + rightW - txPad;

    let thy = txBoxY + 12;
    doc.fontSize(6.5).fillColor(C.mutedLight).font("Helvetica-Bold");
    doc.text("DATE", txDateX, thy);
    doc.text("DESCRIPTION", txDescX, thy);
    doc.text("CATEGORY", txCatX, thy);
    doc.text("AMOUNT", txAmtX - 50, thy, { width: 50, align: "right" });

    thy += 14;
    doc.strokeColor(C.border).lineWidth(0.3).moveTo(rightX + txPad, thy).lineTo(rightX + rightW - txPad, thy).stroke();
    thy += 6;

    for (let i = 0; i < txCount; i++) {
      const tx = data.transactions[i];
      const rowY = thy;

      doc.fontSize(8).fillColor(C.text).font("Helvetica").text(tx.date, txDateX, rowY, { width: 58 });
      doc.fontSize(8).fillColor(C.heading).font("Helvetica-Bold").text(tx.description, txDescX, rowY, { width: 96 });
      doc.fontSize(6.5).fillColor(C.muted).font("Helvetica").text(tx.descriptionSub, txDescX, rowY + 11, { width: 96 });

      // Category badge
      const catKey = tx.category.toUpperCase();
      const badge = C.categoryBadge[catKey] || C.categoryBadge.DEFAULT;
      const catLabel = tx.category.toUpperCase();
      const badgeW = Math.min(doc.widthOfString(catLabel) + 10, 70);
      roundedRect(doc, txCatX, rowY, badgeW, 14, 3, badge.bg);
      doc.fontSize(6).fillColor(badge.text).font("Helvetica-Bold").text(catLabel, txCatX + 5, rowY + 3.5, { width: badgeW - 10 });

      // Amount
      const amtColor = tx.type === "INCOME" ? C.green : C.heading;
      const prefix = tx.type === "INCOME" ? "+$" : "-$";
      doc.fontSize(9).fillColor(amtColor).font("Helvetica-Bold").text(
        `${prefix}${tx.amount}`, txAmtX - 60, rowY, { width: 60, align: "right" }
      );

      thy += txRowH;
    }

    // "Download Full Transaction CSV" link
    const csvLinkY = thy + 4;
    doc.fontSize(8).fillColor(C.primary).font("Helvetica-Bold").text(
      "Download Full Transaction CSV",
      rightX, csvLinkY, { width: rightW, align: "center", link: data.appUrl }
    );

    // ════════════════════════════════════════════════════
    // AI RECOMMENDATION CARD
    // ════════════════════════════════════════════════════
    const aiY = Math.max(catBoxY + catBoxH + 16, csvLinkY + 20);
    const aiCardW = leftW;
    const aiCardH = 60;
    roundedRect(doc, M, aiY, aiCardW, aiCardH, 8, C.primaryLight);

    // Star icon placeholder
    doc.fontSize(14).fillColor(C.primary).text("✦", M + 14, aiY + 10);
    doc.fontSize(9).fillColor(C.primary).font("Helvetica-Bold").text("AI Recommendation", M + 34, aiY + 12);
    doc.fontSize(7.5).fillColor(C.muted).font("Helvetica").text(
      "Review your expense categories for optimization opportunities. Automated insights are generated based on your spending patterns.",
      M + 14, aiY + 28, { width: aiCardW - 28 }
    );

    // ════════════════════════════════════════════════════
    // MASTER YOUR ASSETS CARD (dark gradient)
    // ════════════════════════════════════════════════════
    const psY = aiY + aiCardH + 16;
    const psH = 110;
    roundedRect(doc, M, psY, CONTENT_W, psH, 12, C.dark);

    doc.fontSize(20).fillColor(C.white).font("Helvetica-Bold").text("Master Your Assets", M + 24, psY + 18, { width: CONTENT_W * 0.55 });
    doc.fontSize(8).fillColor("#a5b4fc").font("Helvetica").text(
      "Unlock deep insights into your spending habits with our advanced AI curator. Personalized wealth building starts here.",
      M + 24, psY + 46, { width: CONTENT_W * 0.5 }
    );

    // FinPilot logo button (white pill)
    const btnW = 120;
    const btnH = 26;
    const btnX = M + 24;
    const btnY = psY + psH - btnH - 16;
    roundedRect(doc, btnX, btnY, btnW, btnH, btnH / 2, C.white);
    doc.fontSize(10).fillColor(C.primary).font("Helvetica-Bold").text(
      "FinPilot", btnX, btnY + 7, { width: btnW, align: "center", link: data.appUrl }
    );

    // ════════════════════════════════════════════════════
    // FOOTER
    // ════════════════════════════════════════════════════
    const footerY = 770;
    doc.strokeColor(C.border).lineWidth(0.5).moveTo(M, footerY).lineTo(PAGE_W - M, footerY).stroke();

    const fy = footerY + 8;
    doc.fontSize(10).fillColor(C.primary).font("Helvetica-BoldOblique").text("FinPilot", M, fy, { continued: true });
    doc.fontSize(7).fillColor(C.mutedLight).font("Helvetica").text(`  © ${data.generatedAt.getFullYear()} Intelligence Systems Inc.`);
    doc.fontSize(6).fillColor(C.mutedLight).font("Helvetica").text(
      "This document is a confidential financial intelligence report generated by the FinPilot AI\nengine. The data presented is intended for advisory purposes only.",
      M, fy + 14, { width: 260 }
    );

    doc.fontSize(6.5).fillColor(C.mutedLight).font("Helvetica-Bold").text("DOCUMENT DETAILS", PAGE_W - M - 180, fy, { width: 180, align: "right" });
    const genTs = data.generatedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) + " at " +
      data.generatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) + " GMT";
    doc.fontSize(6.5).fillColor(C.muted).font("Helvetica").text(`Generated on ${genTs}`, PAGE_W - M - 180, fy + 10, { width: 180, align: "right" });
    doc.fontSize(7).fillColor(C.primary).font("Helvetica-Bold").text("Page 1 of 1", PAGE_W - M - 180, fy + 20, { width: 180, align: "right" });

    // Bottom links
    const blY = fy + 40;
    doc.fontSize(6).fillColor(C.mutedLight).font("Helvetica-Bold");
    doc.text("PRIVACY POLICY", M, blY, { continued: true });
    doc.text("     DATA SECURITY", { continued: true });
    doc.text("     FINANCIAL ADVISORY DISCLOSURE");

    doc.end();
  });
}
