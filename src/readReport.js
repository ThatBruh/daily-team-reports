import mammoth from 'mammoth/mammoth.browser'
import ExcelJS from 'exceljs'

const MAX_BYTES = 10 * 1024 * 1024

const cellText = (v) => {
  if (v == null) return ''
  if (v instanceof Date) return v.toLocaleDateString('en-CA')
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('')
    if (v.text) return String(v.text)
    if (v.result !== undefined) return String(v.result)
    return ''
  }
  return String(v)
}

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export async function readReport(file) {
  if (file.size > MAX_BYTES) throw new Error('That file is over 10 MB.')
  const name = file.name.toLowerCase()

  if (name.endsWith('.pdf')) return { pdf: await toBase64(file) }

  if (name.endsWith('.docx')) {
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
    return { text: value }
  }

  if (name.endsWith('.xlsx')) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await file.arrayBuffer())
    const lines = []
    wb.eachSheet((ws) => {
      lines.push(`Sheet: ${ws.name}`)
      ws.eachRow((row) => {
        lines.push(Array.from(row.values).slice(1).map(cellText).join(' | '))
      })
    })
    return { text: lines.join('\n') }
  }

  if (/\.(txt|csv|md)$/.test(name)) return { text: await file.text() }

  throw new Error('Unsupported file type. Use .docx, .pdf, .xlsx, .txt or .csv.')
}