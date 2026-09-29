import { useState } from 'react'
import { supabase } from './supabaseClient'
import { parseNotes } from './parseNotes'

const emptySection = { activity: '', progress: '', issue_blocker: '', collaboration: '' }
const fieldLabels = {
  activity: 'Activity',
  progress: 'Progress',
  issue_blocker: 'Issue / Blocker',
  collaboration: 'Collaboration',
}

const toFields = (s) => ({
  activity: s?.activity ?? '',
  progress: s?.progress ?? '',
  issue_blocker: s?.issue_blocker ?? '',
  collaboration: s?.collaboration ?? '',
})

function EntryForm({ members, onSaved }) {
  const [memberId, setMemberId] = useState('')
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [completed, setCompleted] = useState({ ...emptySection })
  const [today, setToday] = useState({ ...emptySection })
  const [rawNotes, setRawNotes] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  const fill = (obj) => {
    const filled = {}
    for (const key in obj) filled[key] = obj[key].trim() === '' ? 'N/A' : obj[key].trim()
    return filled
  }

  const handleParse = async () => {
    const text = rawNotes.trim()
    if (!text) return
    setParsing(true)
    try {
      const result = await parseNotes(text)
      setCompleted(toFields(result.completed))
      setToday(toFields(result.today))
    } catch (err) {
      console.error(err)
      alert('Sorting failed. Check the console.')
    } finally {
      setParsing(false)
    }
  }

  const handleSave = async () => {
    if (!memberId) return alert('Pick a team member first')
    setSaving(true)
    const rows = [
      { member_id: memberId, entry_date: date, section: 'completed', ...fill(completed) },
      { member_id: memberId, entry_date: date, section: 'today', ...fill(today) },
    ]
    const { error } = await supabase.from('daily_entries').insert(rows)
    setSaving(false)
    if (error) {
      console.error(error)
      alert('Save failed. Check the console.')
    } else {
      setCompleted({ ...emptySection })
      setToday({ ...emptySection })
      setRawNotes('')
      onSaved?.()
    }
  }

  const renderSection = (label, state, setState) => (
    <div className="entry-section">
      <h3 className="entry-section-title">{label}</h3>
      <div className="field-grid">
        {Object.keys(emptySection).map((field) => (
          <div className="field" key={field}>
            <label className="field-label">{fieldLabels[field]}</label>
            <textarea
              rows={2}
              value={state[field]}
              onChange={(e) => setState({ ...state, [field]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <h2 className="page-title">New Entry</h2>

      <div className="entry-meta">
        <div className="field">
          <label className="field-label">Team member</label>
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Select…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="field parse-box" style={{ maxWidth: 640, marginBottom: '2rem' }}>
        <label className="field-label">Paste notes (optional)</label>
        <textarea
          rows={4}
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
          placeholder="e.g. yesterday finished the auth0 sso setup, today working on keycloak and supporting Paul with his deployment"
        />
        <button
          type="button"
          className="btn-ghost"
          onClick={handleParse}
          disabled={parsing || !rawNotes.trim()}
        >
          {parsing ? 'Sorting…' : 'Sort into Completed and Today'}
        </button>
      </div>

      {renderSection('Completed', completed, setCompleted)}
      {renderSection('Today', today, setToday)}

      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save entry'}
      </button>
    </div>
  )
}

export default EntryForm