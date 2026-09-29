import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { exportDocx } from './exportReport'
import { exportPdf, exportXlsx } from './exportFiles'

const fieldLabels = {
  activity: 'Activity',
  progress: 'Progress',
  issue_blocker: 'Issue / Blocker',
  collaboration: 'Collaboration',
}

function History() {
  const [entries, setEntries] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    supabase
      .from('daily_entries')
      .select('*, team_members(name)')
      .order('entry_date', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        else {
          setEntries(data)
          if (data.length > 0) setSelectedDate(data[0].entry_date)
        }
      })
  }, [])

  const dates = [...new Set(entries.map((e) => e.entry_date))]

  const groupByMember = (dateEntries) => {
    const grouped = {}
    dateEntries.forEach((e) => {
      const name = e.team_members?.name || 'Unknown'
      if (!grouped[name]) grouped[name] = {}
      grouped[name][e.section] = e
    })
    return grouped
  }

  const grouped = selectedDate
    ? groupByMember(entries.filter((e) => e.entry_date === selectedDate))
    : {}

  return (
    <div>
     <div className="page-header">
  <h2 className="page-title">History</h2>
  <div className="export-actions">
    {[
      ['Word', exportDocx],
      ['PDF', exportPdf],
      ['Excel', exportXlsx],
    ].map(([label, fn]) => (
      <button
        key={label}
        className="btn-ghost"
        disabled={!selectedDate || Object.keys(grouped).length === 0}
        onClick={() => fn(selectedDate, grouped)}
      >
        {label}
      </button>
    ))}
  </div>
</div>
      <div className="history-layout">
        <div className="date-list">
          {dates.length === 0 && <p className="empty-state">No entries yet.</p>}
          {dates.map((date) => (
            <button
              key={date}
              className={`date-item ${date === selectedDate ? 'active' : ''}`}
              onClick={() => setSelectedDate(date)}
            >
              {date}
            </button>
          ))}
        </div>

        <div className="history-detail">
          {Object.entries(grouped).map(([name, sections]) => (
            <div key={name} className="history-member">
              <h3 className="history-member-name">{name}</h3>
              {['completed', 'today'].map((section) => (
                <div key={section} className="history-section">
                  <span className="history-section-label">{section}</span>
                  {sections[section] ? (
                    <dl className="history-fields">
                      {Object.keys(fieldLabels).map((f) => {
                        const value = sections[section][f]
                        const isBlocker = f === 'issue_blocker' && value && value !== 'N/A'
                        return (
                          <div key={f} className="history-field-row">
                            <dt>{fieldLabels[f]}</dt>
                            <dd className={isBlocker ? 'is-blocker' : ''}>{value}</dd>
                          </div>
                        )
                      })}
                    </dl>
                  ) : (
                    <p className="empty-state">No entry logged.</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default History