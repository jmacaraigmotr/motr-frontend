import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CSRTransactionGroup } from '@/api/reports'
import motrLogo from '@/assets/motr-logo.png'

// ── Helpers ───────────────────────────────────────────────────────────────────

function dollars(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function pdfDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

// ── Image loader ──────────────────────────────────────────────────────────────
// Vite imports the PNG as a URL string; we load it into an HTMLImageElement
// so jsPDF can draw it directly — no fetch, no CORS, always works.

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src     = src
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateCSRPaymentReport(csrGroups: CSRTransactionGroup[]): Promise<void> {
  // Load the bundled logo (Vite resolves the import to a hashed asset URL)
  const logoImg = await loadImg(motrLogo)

  const doc     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW   = doc.internal.pageSize.getWidth()
  const pageH   = doc.internal.pageSize.getHeight()
  const marginL = 20
  const marginR = 20
  const tableW  = pageW - marginL - marginR

  // Dark header bar dimensions
  const headerH = 22   // mm — height of the dark banner
  const headerBg: [number, number, number] = [20, 20, 20]   // near-black

  // Logo — fixed width, height auto from aspect ratio, centered in header
  const logoW  = 36
  const logoH  = logoW * (logoImg.naturalHeight / logoImg.naturalWidth)
  const logoX  = (pageW - logoW) / 2                        // centered horizontally
  const logoY  = (headerH - logoH) / 2                      // centered vertically in header

  // Capture once so every page shows the same timestamp
  const generatedAt = pdfDate(new Date().toISOString())

  // Column widths (sum = tableW)
  const amountW        = 28
  const jobNumW        = 20
  const paymentStatusW = 32
  const dateAddedW     = 28
  const customerNameW  = tableW - amountW - jobNumW - paymentStatusW - dateAddedW

  csrGroups.forEach((group, idx) => {
    if (idx > 0) doc.addPage()

    const csrName = group.csr
      ? `${group.csr.first_name} ${group.csr.last_name}`.trim()
      : 'Unassigned'

    // ── Dark header banner (full page width) ──
    doc.setFillColor(...headerBg)
    doc.rect(0, 0, pageW, headerH, 'F')

    // ── Logo centered inside the banner ──
    doc.addImage(logoImg, 'PNG', logoX, logoY, logoW, logoH)

    // ── "Generated: MM/DD/YYYY" — right side of banner, vertically centered ──
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(180, 180, 180)
    doc.text(`Generated: ${generatedAt}`, pageW - marginR, headerH / 2 + 1, { align: 'right' })

    // ── Section title (below the header) ──
    const titleY = headerH + 14
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(20, 20, 20)
    doc.text(`Transactions - ${csrName}`, marginL, titleY)

    // ── Table ──
    const rows = group.transactions.map(p => {
      const name   = p.customer
        ? `${p.customer.first_name} ${p.customer.last_name}`.trim()
        : '—'
      const amount = dollars(p.amount)
      const job    = p.repair_order?.job_number != null
        ? String(p.repair_order.job_number)
        : '—'
      const status = p.payment_status === 'not_paid'    ? 'Not Paid'
                   : p.payment_status === 'not_approved' ? 'Not Approved'
                   : p.payment_status ?? '—'
      const date   = pdfDate(p.date_added ?? p.created_at)
      return [name, amount, job, status, date]
    })

    autoTable(doc, {
      startY: titleY + 7,
      head: [['Customer Name', 'Amount', 'Job #', 'Payment Status', 'Date Added']],
      body: rows,
      margin: { left: marginL, right: marginR },

      styles: {
        fontSize: 8.5,
        cellPadding: { top: 3.5, bottom: 3.5, left: 2, right: 2 },
        textColor: [30, 30, 30],
        lineColor: [220, 220, 220],
        lineWidth: { bottom: 0.2, top: 0, left: 0, right: 0 },
        overflow: 'linebreak',
        valign: 'middle',
      },

      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [30, 30, 30],
        fontStyle: 'bold',
        fontSize: 8.5,
        lineWidth: { bottom: 0.5, top: 0, left: 0, right: 0 },
        lineColor: [180, 180, 180],
      },

      bodyStyles:         { fillColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [255, 255, 255] },

      columnStyles: {
        0: { cellWidth: customerNameW },
        1: { cellWidth: amountW,        halign: 'right' },
        2: { cellWidth: jobNumW },
        3: { cellWidth: paymentStatusW, fontStyle: 'bold' },
        4: { cellWidth: dateAddedW },
      },

      // Right-align the "Amount" header to match body values
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 1) {
          data.cell.styles.halign = 'right'
        }
      },

      tableLineColor: [220, 220, 220],
      tableLineWidth: 0,
      showHead: 'everyPage',
    })
  })

  // ── Page numbers ──────────────────────────────────────────────────────────────
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    doc.text(`Page ${i}/${totalPages}`, pageW / 2, pageH - 10, { align: 'center' })
  }

  doc.save('CSR_Outstanding_Payments_Report.pdf')
}
