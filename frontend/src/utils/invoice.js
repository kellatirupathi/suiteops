import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { money, fmtDate } from './format.js';

export function generateInvoice(guest, finance, payments) {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text('RK Suites', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text('Hotel Operations · SuitesOps', 14, 26);
  doc.text('Hyderabad', 14, 31);

  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.text('GUEST INVOICE', 150, 20);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Invoice date: ${fmtDate(new Date())}`, 150, 26);

  // Guest details
  doc.setTextColor(0);
  doc.setFontSize(11);
  autoTable(doc, {
    startY: 40,
    theme: 'plain',
    body: [
      ['Guest', guest.name],
      ['ID Number', guest.idNumber],
      ['Phone', guest.phone],
      ['Room', `${guest.roomNumber} (${money(guest.dailyRate)}/night)`],
      ['Check-in', fmtDate(guest.checkInDate)],
      ['Check-out', fmtDate(guest.actualCheckOutDate || guest.expectedCheckOutDate)],
    ],
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
  });

  // Charges
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Description', 'Nights', 'Rate', 'Amount']],
    body: [
      [
        'Room charges',
        String(finance.nights),
        money(guest.dailyRate),
        money(finance.totalCharges),
      ],
    ],
    headStyles: { fillColor: [59, 111, 224] },
    styles: { fontSize: 10 },
  });

  // Payments
  if (payments?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [['Payment Date', 'Mode', 'Reference', 'Amount']],
      body: payments.map((p) => [
        fmtDate(p.date),
        p.mode.toUpperCase(),
        p.reference || '—',
        money(p.amount),
      ]),
      headStyles: { fillColor: [100, 116, 139] },
      styles: { fontSize: 10 },
    });
  }

  // Totals
  const y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.text(`Total Charges: ${money(finance.totalCharges)}`, 130, y);
  doc.text(`Paid: ${money(finance.paid)}`, 130, y + 6);
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text(`Balance Due: ${money(finance.balanceDue)}`, 130, y + 14);
  doc.setFont(undefined, 'normal');

  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text('Thank you for staying with RK Suites.', 14, 285);

  doc.save(`Invoice_${guest.name.replace(/\s+/g, '_')}_${guest.roomNumber}.pdf`);
}
