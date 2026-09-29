import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'

const FIELDS = [
  ['activity', 'Activity'],
  ['progress', 'Progress'],
  ['issue_blocker', 'Issue / Blocker'],
  ['collaboration', 'Collaboration'],
]

const BLOCKER_ROW = 2 // index of issue_blocker in FIELDS

const longDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

const isRealBlocker = (value) => value && value !== 'N/A'

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPdf(date, grouped) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  doc.setFontSize(20)
  doc.setTextColor(20)
  doc.text('Daily Team Report', 40, 50)
  doc.setFontSize(11)
  doc.setTextColor(110)
  doc.text(longDate(date), 40, 70)

  let y = 105
  Object.entries(grouped).forEach(([name, sections]) => {
    if (y > 620) {
      doc.addPage()
      y = 50
    }
    doc.setFontSize(14)
    doc.setTextColor(20)
    doc.text(name, 40, y)

    autoTable(doc, {
      startY: y + 10,
      head: [['', 'Completed', 'Today']],
      body: FIELDS.map(([key, label]) => [
        label,
        sections.completed?.[key] || 'N/A',
        sections.today?.[key] || 'N/A',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [232, 236, 241], textColor: 20 },
      styles: { fontSize: 10, cellPadding: 6, lineColor: [210, 214, 220] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 95 } },
      didParseCell: (data) => {
        if (
          data.section === 'body' &&
          data.row.index === BLOCKER_ROW &&
          data.column.index > 0 &&
          isRealBlocker(data.cell.raw)
        ) {
          data.cell.styles.textColor = [180, 83, 9]
        }
      },
    })

    y = doc.lastAutoTable.finalY + 32
  })

  doc.save(`daily-report-${date}.pdf`)
}

export async function exportXlsx(date, grouped) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(date)

  ws.columns = [
    { header: 'Team member', key: 'member', width: 18 },
    { header: 'Field', key: 'field', width: 18 },
    { header: 'Completed', key: 'completed', width: 48 },
    { header: 'Today', key: 'today', width: 48 },
  ]

  const header = ws.getRow(1)
  header.font = { bold: true }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF1' } }

  Object.entries(grouped).forEach(([name, sections]) => {
    FIELDS.forEach(([key, label]) => {
      const done = sections.completed?.[key] || 'N/A'
      const next = sections.today?.[key] || 'N/A'
      const row = ws.addRow({ member: name, field: label, completed: done, today: next })

      row.alignment = { vertical: 'top', wrapText: true }
      if (key === 'issue_blocker') {
        if (isRealBlocker(done)) row.getCell('completed').font = { color: { argb: 'FFB45309' } }
        if (isRealBlocker(next)) row.getCell('today').font = { color: { argb: 'FFB45309' } }
      }
    })
  })

  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = 'A1:D1'

  const buffer = await wb.xlsx.writeBuffer()
  download(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `daily-report-${date}.xlsx`
  )
}