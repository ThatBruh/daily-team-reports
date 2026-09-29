import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, ShadingType,
} from 'docx'

const FIELDS = [
  ['activity', 'Activity'],
  ['progress', 'Progress'],
  ['issue_blocker', 'Issue / Blocker'],
  ['collaboration', 'Collaboration'],
]

const COLS = [1826, 3600, 3600] // adds up to the A4 content width

const cell = (text, width, { bold = false, fill, color } = {}) =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({ children: [new TextRun({ text: text || 'N/A', bold, color, size: 20 })] }),
    ],
  })

const isRealBlocker = (key, value) => key === 'issue_blocker' && value && value !== 'N/A'

const memberTable = (sections) =>
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: COLS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell('', COLS[0], { fill: 'E8ECF1' }),
          cell('Completed', COLS[1], { bold: true, fill: 'E8ECF1' }),
          cell('Today', COLS[2], { bold: true, fill: 'E8ECF1' }),
        ],
      }),
      ...FIELDS.map(([key, label]) => {
        const done = sections.completed?.[key]
        const next = sections.today?.[key]
        return new TableRow({
          children: [
            cell(label, COLS[0], { bold: true }),
            cell(done, COLS[1], { color: isRealBlocker(key, done) ? 'B45309' : undefined }),
            cell(next, COLS[2], { color: isRealBlocker(key, next) ? 'B45309' : undefined }),
          ],
        })
      }),
    ],
  })

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportDocx(date, grouped) {
  const prettyDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Daily Team Report')] }),
    new Paragraph({
      spacing: { after: 300 },
      children: [new TextRun({ text: prettyDate, color: '666666' })],
    }),
  ]

  Object.entries(grouped).forEach(([name, sections]) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 120 },
        children: [new TextRun(name)],
      }),
      memberTable(sections)
    )
  })

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  })

  download(await Packer.toBlob(doc), `daily-report-${date}.docx`)
}