"use client";

import { Download } from "lucide-react";
import { jsPDF } from "jspdf";

type BudgetLine = {
  category: string;
  amount: number;
};

type ExamplePlanDownloadProps = {
  budgetLines: BudgetLine[];
  budgetTotal: number;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function ExamplePlanDownload({
  budgetLines,
  budgetTotal,
}: ExamplePlanDownloadProps) {
  function downloadPdf() {
    const pdf = new jsPDF({ format: "letter", unit: "pt" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 46;
    const contentWidth = pageWidth - margin * 2;

    pdf.setFillColor(48, 71, 44);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");
    pdf.setFillColor(241, 241, 239);
    pdf.rect(13, 13, pageWidth - 26, pageHeight - 26, "F");
    pdf.setDrawColor(23, 23, 21);
    pdf.setLineWidth(1);
    pdf.rect(27, 27, pageWidth - 54, pageHeight - 54);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(76, 74, 69);
    pdf.text("EXAMPLE PLAN - ILLUSTRATIVE ONLY", margin, 65);
    pdf.setFontSize(32);
    pdf.setTextColor(23, 23, 21);
    pdf.text("EVENT PLAN", margin, 101);

    const brandX = pageWidth - margin - 124;
    pdf.setFillColor(239, 180, 119);
    pdf.rect(brandX, 48, 124, 41, "F");
    pdf.setDrawColor(23, 23, 21);
    pdf.rect(brandX, 48, 124, 41);
    pdf.setFontSize(10);
    pdf.text("EVENTORA AI", brandX + 10, 73);

    pdf.setDrawColor(200, 198, 192);
    pdf.line(margin, 119, pageWidth - margin, 119);
    pdf.setFontSize(9);
    pdf.setTextColor(76, 74, 69);
    pdf.text("EVENT SUMMARY", margin, 140);
    pdf.setFontSize(15);
    pdf.setTextColor(23, 23, 21);
    pdf.text("Garden wedding", margin, 161);
    pdf.setFontSize(10);
    pdf.setTextColor(69, 68, 63);
    pdf.text(
      pdf.splitTextToSize(
        "A garden wedding for 120 guests with dinner, simple floral decor, and an outdoor ceremony near sunset.",
        contentWidth - 150,
      ),
      margin,
      179,
    );
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(76, 74, 69);
    pdf.text("OCCASION", pageWidth - margin - 128, 140);
    pdf.text("GUEST COUNT", pageWidth - margin - 128, 163);
    pdf.setFontSize(10);
    pdf.setTextColor(23, 23, 21);
    pdf.text("Wedding", pageWidth - margin - 128, 153);
    pdf.text("120 guests", pageWidth - margin - 128, 176);

    const panelY = 220;
    const panelHeight = 52 + budgetLines.length * 25 + 38;
    pdf.setFillColor(232, 205, 231);
    pdf.rect(margin, panelY, contentWidth, panelHeight, "F");
    pdf.setDrawColor(23, 23, 21);
    pdf.rect(margin, panelY, contentWidth, panelHeight);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(76, 70, 80);
    pdf.text("EXAMPLE BUDGET (USD)", margin + 15, panelY + 20);
    pdf.setFontSize(14);
    pdf.setTextColor(23, 23, 21);
    pdf.text("A considered allocation", margin + 15, panelY + 39);
    pdf.setFontSize(17);
    pdf.text(currency.format(budgetTotal), pageWidth - margin - 15, panelY + 39, {
      align: "right",
    });

    let rowY = panelY + 68;
    const categoryX = margin + 15;
    const amountX = pageWidth - margin - 82;
    const shareX = pageWidth - margin - 15;
    pdf.setFontSize(8);
    pdf.text("DESCRIPTION", categoryX, rowY);
    pdf.text("ESTIMATED COST", amountX, rowY, { align: "right" });
    pdf.text("SHARE", shareX, rowY, { align: "right" });
    rowY += 10;
    pdf.setDrawColor(23, 23, 21);
    pdf.line(categoryX, rowY, pageWidth - margin - 15, rowY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    budgetLines.forEach((line) => {
      rowY += 20;
      pdf.text(line.category, categoryX, rowY);
      pdf.text(currency.format(line.amount), amountX, rowY, { align: "right" });
      pdf.text(`${Math.round((line.amount / budgetTotal) * 100)}%`, shareX, rowY, {
        align: "right",
      });
      pdf.setDrawColor(23, 23, 21);
      pdf.setLineWidth(0.3);
      pdf.line(categoryX, rowY + 6, pageWidth - margin - 15, rowY + 6);
    });

    rowY += 28;
    pdf.setFont("helvetica", "bold");
    pdf.text("Total example budget", categoryX, rowY);
    pdf.text(currency.format(budgetTotal), shareX, rowY, { align: "right" });

    const notesY = panelY + panelHeight + 33;
    pdf.setDrawColor(200, 198, 192);
    pdf.line(margin, notesY - 12, pageWidth - margin, notesY - 12);
    pdf.setFontSize(9);
    pdf.setTextColor(76, 74, 69);
    pdf.text("BEFORE THE EVENT", margin, notesY);
    pdf.text("DOUBLE-CHECK", pageWidth / 2 + 8, notesY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(69, 68, 63);
    pdf.text(
      [
        "16 weeks out - Confirm date and venue.",
        "8 weeks out - Confirm menu and decor.",
        "2 weeks out - Share the final schedule with suppliers.",
      ],
      margin,
      notesY + 19,
      { lineHeightFactor: 1.7 },
    );
    pdf.setDrawColor(211, 150, 94);
    pdf.setLineWidth(2);
    pdf.line(pageWidth / 2 + 8, notesY + 6, pageWidth / 2 + 8, notesY + 64);
    pdf.text(
      pdf.splitTextToSize(
        "Have a rain backup for the outdoor ceremony. Confirm the venue has enough power.",
        contentWidth / 2 - 28,
      ),
      pageWidth / 2 + 17,
      notesY + 21,
    );

    pdf.setDrawColor(200, 198, 192);
    pdf.setLineWidth(0.5);
    pdf.line(margin, pageHeight - 70, pageWidth - margin, pageHeight - 70);
    pdf.setFontSize(8);
    pdf.text(
      "A thoughtful starting point for your celebration.",
      margin,
      pageHeight - 53,
    );
    pdf.setFont("helvetica", "bold");
    pdf.text("EVENTORA AI", pageWidth - margin, pageHeight - 53, { align: "right" });

    const pdfUrl = URL.createObjectURL(pdf.output("blob"));
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = "eventora-example-plan.pdf";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
  }

  return (
    <button
      type="button"
      className="example-plan-download"
      onClick={downloadPdf}
      aria-label="Download the example event plan as a PDF"
    >
      <Download size={14} aria-hidden="true" />
      Download PDF
    </button>
  );
}
