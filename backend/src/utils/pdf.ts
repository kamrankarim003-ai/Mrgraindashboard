import PDFDocument from "pdfkit";

export function buildTablePdf(title: string, headers: string[], rows: (string | number)[][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#4A3225").fontSize(18).text(title);
    doc.moveDown();

    const colWidth = Math.floor((doc.page.width - 80) / headers.length);
    let y = doc.y;
    doc.fontSize(9).fillColor("#4A3225");
    headers.forEach((h, i) => doc.text(h, 40 + i * colWidth, y, { width: colWidth }));
    y += 16;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor("#C9A227").stroke();
    y += 6;

    doc.fillColor("#1A1A1A");
    for (const row of rows) {
      if (y > doc.page.height - 60) {
        doc.addPage({ margin: 40, size: "A4", layout: "landscape" });
        y = 40;
      }
      row.forEach((cell, i) => doc.text(String(cell), 40 + i * colWidth, y, { width: colWidth }));
      y += 16;
    }

    doc.end();
  });
}

export function buildInvoicePdf(opts: {
  business: { name: string; abn?: string | null; address?: string | null; email?: string | null; phone?: string | null; bankDetails?: string | null };
  invoiceNumber: string;
  customerName: string;
  customerAddress?: string | null;
  dueDate?: Date | null;
  paymentTerms?: string | null;
  items: { description: string; quantity: number; unitPrice: number; subtotal: number }[];
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#4A3225").fontSize(20).text(opts.business.name, { continued: false });
    doc.fontSize(9).fillColor("#1A1A1A");
    if (opts.business.abn) doc.text(`ABN: ${opts.business.abn}`);
    if (opts.business.address) doc.text(opts.business.address);
    if (opts.business.email) doc.text(opts.business.email);
    if (opts.business.phone) doc.text(opts.business.phone);

    doc.moveDown();
    doc.fontSize(16).fillColor("#C9A227").text(`INVOICE ${opts.invoiceNumber}`, { align: "right" });
    doc.fontSize(10).fillColor("#1A1A1A");
    doc.text(`Bill to: ${opts.customerName}`, { align: "right" });
    if (opts.customerAddress) doc.text(opts.customerAddress, { align: "right" });
    if (opts.dueDate) doc.text(`Due: ${opts.dueDate.toISOString().slice(0, 10)}`, { align: "right" });
    if (opts.paymentTerms) doc.text(`Terms: ${opts.paymentTerms}`, { align: "right" });

    doc.moveDown(2);
    const tableTop = doc.y;
    doc.fontSize(10).fillColor("#4A3225");
    doc.text("Description", 50, tableTop, { width: 250 });
    doc.text("Qty", 300, tableTop, { width: 60, align: "right" });
    doc.text("Unit Price", 360, tableTop, { width: 80, align: "right" });
    doc.text("Subtotal", 450, tableTop, { width: 90, align: "right" });
    doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).strokeColor("#C9A227").stroke();

    let y = tableTop + 22;
    doc.fillColor("#1A1A1A");
    for (const item of opts.items) {
      doc.text(item.description, 50, y, { width: 250 });
      doc.text(String(item.quantity), 300, y, { width: 60, align: "right" });
      doc.text(`$${item.unitPrice.toFixed(2)}`, 360, y, { width: 80, align: "right" });
      doc.text(`$${item.subtotal.toFixed(2)}`, 450, y, { width: 90, align: "right" });
      y += 20;
    }

    y += 10;
    doc.moveTo(350, y).lineTo(540, y).strokeColor("#C9A227").stroke();
    y += 8;
    doc.text("Subtotal", 360, y, { width: 80, align: "right" });
    doc.text(`$${opts.subtotal.toFixed(2)}`, 450, y, { width: 90, align: "right" });
    y += 18;
    if (opts.gstAmount > 0) {
      doc.text("GST (10%)", 360, y, { width: 80, align: "right" });
      doc.text(`$${opts.gstAmount.toFixed(2)}`, 450, y, { width: 90, align: "right" });
      y += 18;
    }
    doc.fontSize(12).fillColor("#4A3225");
    doc.text("Total", 360, y, { width: 80, align: "right" });
    doc.text(`$${opts.totalAmount.toFixed(2)}`, 450, y, { width: 90, align: "right" });
    y += 20;
    doc.fontSize(10).fillColor("#1A1A1A");
    doc.text("Amount Paid", 360, y, { width: 80, align: "right" });
    doc.text(`$${opts.amountPaid.toFixed(2)}`, 450, y, { width: 90, align: "right" });
    y += 18;
    doc.fontSize(12).fillColor("#C9A227");
    doc.text("Balance Due", 360, y, { width: 80, align: "right" });
    doc.text(`$${opts.balanceDue.toFixed(2)}`, 450, y, { width: 90, align: "right" });

    if (opts.business.bankDetails) {
      y += 40;
      doc.fontSize(9).fillColor("#4A3225").text("Payment details:", 50, y);
      doc.fillColor("#1A1A1A").text(opts.business.bankDetails, 50, y + 14);
    }

    doc.end();
  });
}

export function buildReceiptPdf(opts: {
  business: { name: string };
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  referenceNote?: string | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#4A3225").fontSize(20).text(opts.business.name);
    doc.moveDown();
    doc.fontSize(16).fillColor("#C9A227").text("PAYMENT RECEIPT");
    doc.moveDown();
    doc.fontSize(11).fillColor("#1A1A1A");
    doc.text(`Invoice: ${opts.invoiceNumber}`);
    doc.text(`Received from: ${opts.customerName}`);
    doc.text(`Amount: $${opts.amount.toFixed(2)}`);
    doc.text(`Date: ${opts.paymentDate.toISOString().slice(0, 10)}`);
    doc.text(`Method: ${opts.paymentMethod}`);
    if (opts.referenceNote) doc.text(`Reference: ${opts.referenceNote}`);
    doc.moveDown();
    doc.fontSize(10).fillColor("#4A3225").text("Thank you for your payment.");

    doc.end();
  });
}
