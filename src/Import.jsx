import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { readReport } from './readReport'

const FIELDS = [
  ['activity', 'Activity'],
  ['progress', 'Progress'],
  ['issue_blocker', 'Issue / Blocker'],
  ['collaboration', 'Collaboration'],
]

const clean = (v) => (!v || v.trim().toUpperCase() === 'N/A' ? '' : v.trim())
const cleanSection = (s) => Object.fromEntries(FIELDS.map(([k]) => [k, clean(s?.[k])]))
const filled = (s) => Object.fromEntries(FIELDS.map(([k]) => [k, s[k].trim() || 'N/A']))
const hasContent = (s) => FIELDS.some(([k]) => s[k].trim() !== '')
const isIsoDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')

function Import({ members, onImported }) {
  const todayIso = new Date().toLocaleDateString('en-CA')
  const [fallbackDate, setFallbackDate] = useState(todayIso)
  const [status, setStatus] = useState('idle') // idle | parsing | review | saving
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [openKey, setOpenKey] = useState(null)
  const [existing, setExisting] = useState(new Set())
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    supabase
      .from('daily_entries')
      .select('member_id, entry_date')
      .then(({ data, error: err }) => {
        if (err) console.error(err)
        else setExisting(new Set(data.map((e) => `${e.member_id}|${e.entry_date}`)))
      })
  }, [])

  const matchMember = (name) => {
    const n = (name || '').trim().toLowerCase()
    if (!n) return ''
    const exact = members.find((m) => m.name.toLowerCase() === n)
    if (exact) return exact.id
    const first = n.split(' ')[0]
    const matches = members.filter((m) => m.name.toLowerCase().split(' ')[0] === first)
    return matches.length === 1 ? matches[0].id : ''
  }

  const clashes = (r) => r.memberId && existing.has(`${r.memberId}|${r.date}`)

  const handleFile = async (file) => {
    if (!file) return
    setError('')
    setFileName(file.name)
    setStatus('parsing')
    try {
      const payload = await readReport(file)
      const { data, error: fnError } = await supabase.functions.invoke('parse-report', {
        body: { ...payload, today: todayIso },
      })
      if (fnError) throw fnError

      const parsed = (data?.entries || []).map((e, i) => {
        const memberId = matchMember(e.member)
        const date = isIsoDate(e.date) ? e.date : fallbackDate
        return {
          key: `${i}-${e.member}`,
          extractedName: e.member,
          memberId,
          date,
          completed: cleanSection(e.completed),
          today: cleanSection(e.today),
          include: Boolean(memberId) && !existing.has(`${memberId}|${date}`),
        }
      })

      if (parsed.length === 0) {
        setError('No entries were found in that file.')
        setStatus('idle')
        return
      }
      setRows(parsed)
      setStatus('review')
    } catch (err) {
      console.error(err)
      let detail = err.message || 'Unknown error'
      try {
        const body = await err.context?.json()
        if (body?.error) {
          detail = typeof body.error === 'string' ? body.error : JSON.stringify(body.error)
        }
      } catch {
        // not an HTTP error body
      }
      const code = err.context?.status ? ` (${err.context.status})` : ''
      setError(`Could not read that report${code}: ${detail.slice(0, 300)}`)
      setStatus('idle')
    }
  }

  const updateRow = (key, patch) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const updateField = (key, section, field, value) =>
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, [section]: { ...r[section], [field]: value } } : r
      )
    )

  const reset = () => {
    setRows([])
    setOpenKey(null)
    setError('')
    setFileName('')
    setStatus('idle')
  }

  const selected = rows.filter((r) => r.include && r.memberId)

  const save = async () => {
    setError('')
    setStatus('saving')
    const inserts = selected.flatMap((r) => [
      { member_id: r.memberId, entry_date: r.date, section: 'completed', ...filled(r.completed) },
      { member_id: r.memberId, entry_date: r.date, section: 'today', ...filled(r.today) },
    ])
    const { error: insertError } = await supabase.from('daily_entries').insert(inserts)
    if (insertError) {
      console.error(insertError)
      setError('Save failed. Check the console.')
      setStatus('review')
    } else {
      onImported?.()
    }
  }

  if (status === 'idle' || status === 'parsing') {
    return (
      <div>
        <h2 className="page-title">Import report</h2>
        <p className="muted-line">
          Upload a daily report (.docx, .pdf, .xlsx, .txt or .csv). You'll review everything before anything is saved.
        </p>

        <div className="field" style={{ maxWidth: 300, marginBottom: '1.25rem' }}>
          <label className="field-label">Date to use when the report doesn't state one</label>
          <input type="date" value={fallbackDate} onChange={(e) => setFallbackDate(e.target.value)} />
        </div>

        <label
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (status !== 'parsing') handleFile(e.dataTransfer.files[0])
          }}
        >
          <input
            type="file"
            accept=".docx,.pdf,.xlsx,.txt,.csv,.md"
            hidden
            disabled={status === 'parsing'}
            onChange={(e) => {
              handleFile(e.target.files[0])
              e.target.value = ''
            }}
          />
          {status === 'parsing' ? `Reading ${fileName}…` : 'Choose a file or drop it here'}
        </label>

        {error && <p className="form-error">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Review import</h2>
        <button className="btn-ghost" onClick={reset}>Start over</button>
      </div>

      <p className="muted-line">
        {fileName}: {rows.length} {rows.length === 1 ? 'entry' : 'entries'} found. Check the details, untick
        anything you don't want, then import.
      </p>

      {rows.map((r) => {
        const isOpen = openKey === r.key
        return (
          <div key={r.key} className={`import-row ${r.include ? '' : 'excluded'}`}>
            <div className="import-head">
              <input
                type="checkbox"
                checked={r.include}
                disabled={!r.memberId}
                onChange={(e) => updateRow(r.key, { include: e.target.checked })}
              />
              <select
                value={r.memberId}
                onChange={(e) => {
                  const id = e.target.value
                  updateRow(r.key, {
                    memberId: id,
                    include: Boolean(id) && !existing.has(`${id}|${r.date}`),
                  })
                }}
              >
                <option value="">
                  {r.extractedName ? `Match "${r.extractedName}"…` : 'Choose member…'}
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={r.date}
                onChange={(e) => updateRow(r.key, { date: e.target.value })}
              />
              <button className="btn-ghost" onClick={() => setOpenKey(isOpen ? null : r.key)}>
                {isOpen ? 'Done' : 'Edit'}
              </button>
            </div>

            {clashes(r) && (
              <p className="import-note">This person already has entries on this date.</p>
            )}

            {isOpen
              ? ['completed', 'today'].map((section) => (
                  <div key={section} className="entry-section">
                    <h3 className="entry-section-title">
                      {section === 'completed' ? 'Completed' : 'Today'}
                    </h3>
                    <div className="field-grid">
                      {FIELDS.map(([key, label]) => (
                        <div className="field" key={key}>
                          <label className="field-label">{label}</label>
                          <textarea
                            rows={2}
                            value={r[section][key]}
                            onChange={(e) => updateField(r.key, section, key, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              : ['completed', 'today'].map((section) => (
                  <div key={section} className="import-section">
                    <span className="history-section-label">
                      {section === 'completed' ? 'Completed' : 'Today'}
                    </span>
                    {hasContent(r[section]) ? (
                      FIELDS.filter(([k]) => r[section][k]).map(([k, label]) => (
                        <p key={k} className={`line ${k === 'issue_blocker' ? 'warn' : ''}`}>
                          <span className="line-label">{label}</span>
                          {r[section][k]}
                        </p>
                      ))
                    ) : (
                      <p className="empty-state">Nothing reported.</p>
                    )}
                  </div>
                ))}
          </div>
        )
      })}

      <div className="import-footer">
        <button className="btn-primary" disabled={selected.length === 0 || status === 'saving'} onClick={save}>
          {status === 'saving'
            ? 'Importing…'
            : `Import ${selected.length} ${selected.length === 1 ? 'entry' : 'entries'}`}
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  )
}

export default Import