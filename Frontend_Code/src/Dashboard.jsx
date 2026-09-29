import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const RANGES = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7', label: '7 days', days: 6 },
  { key: '30', label: '30 days', days: 29 },
  { key: 'all', label: 'All', days: null },
]

const has = (v) => v && v.trim() !== '' && v !== 'N/A'

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

const isoDaysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

const daysBetween = (fromIso, toIso) =>
  Math.round((new Date(`${toIso}T00:00:00`) - new Date(`${fromIso}T00:00:00`)) / 86400000)

function Dashboard({ members }) {
  const [entries, setEntries] = useState([])
  const [range, setRange] = useState('7')
  const [showResolved, setShowResolved] = useState(false)
  const today = new Date().toLocaleDateString('en-CA')

  const load = () =>
    supabase
      .from('daily_entries')
      .select('*, team_members(name)')
      .order('entry_date', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setEntries(data)
      })

  useEffect(() => {
    load()
  }, [])

  const rangeDef = RANGES.find((r) => r.key === range)
  const cutoff = rangeDef.days === null ? null : isoDaysAgo(rangeDef.days)
  const inRange = (e) => cutoff === null || e.entry_date >= cutoff

  const loggedIds = new Set(entries.filter((e) => e.entry_date === today).map((e) => e.member_id))
  const loggedCount = members.filter((m) => loggedIds.has(m.id)).length
  const notLogged = members.filter((m) => !loggedIds.has(m.id))

  const issues = useMemo(() => {
    const groups = new Map()
    entries
      .filter((e) => has(e.issue_blocker))
      .forEach((e) => {
        const key = `${e.member_id}|${e.issue_blocker.trim().toLowerCase()}`
        const g = groups.get(key) || {
          key,
          member: e.team_members?.name,
          text: e.issue_blocker.trim(),
          ids: [],
          dates: [],
          resolved: true,
        }
        g.ids.push(e.id)
        g.dates.push(e.entry_date)
        if (!e.blocker_resolved) g.resolved = false
        groups.set(key, g)
      })
    return [...groups.values()].map((g) => ({
      ...g,
      firstSeen: g.dates.reduce((a, b) => (a < b ? a : b)),
      lastSeen: g.dates.reduce((a, b) => (a > b ? a : b)),
    }))
  }, [entries])

  const openIssues = issues
    .filter((i) => !i.resolved)
    .sort((a, b) => a.firstSeen.localeCompare(b.firstSeen))
  const resolvedIssues = issues
    .filter((i) => i.resolved && (cutoff === null || i.lastSeen >= cutoff))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))

  const setResolved = async (issue, value) => {
    const { error } = await supabase
      .from('daily_entries')
      .update({ blocker_resolved: value })
      .in('id', issue.ids)
    if (error) {
      console.error(error)
      alert('Could not update. Check the console.')
    } else {
      load()
    }
  }

  // date -> people -> items, with exact duplicates collapsed
  const feed = (section) => {
    const byDate = new Map()
    entries
      .filter(
        (e) =>
          e.section === section &&
          inRange(e) &&
          (has(e.activity) || has(e.progress) || has(e.collaboration))
      )
      .forEach((e) => {
        if (!byDate.has(e.entry_date)) byDate.set(e.entry_date, new Map())
        const people = byDate.get(e.entry_date)
        if (!people.has(e.member_id)) {
          people.set(e.member_id, {
            id: e.member_id,
            name: e.team_members?.name || 'Unknown',
            items: [],
            seen: new Set(),
          })
        }
        const person = people.get(e.member_id)
        const sig = `${e.activity}|${e.progress}|${e.collaboration}`
        if (person.seen.has(sig)) return
        person.seen.add(sig)
        person.items.push(e)
      })
    return [...byDate.entries()].map(([date, people]) => [date, [...people.values()]])
  }

  const completedFeed = feed('completed')
  const pendingFeed = feed('today')
  const countItems = (f) =>
    f.reduce((n, [, people]) => n + people.reduce((m, p) => m + p.items.length, 0), 0)

  const renderFeed = (title, days, emptyText) => (
    <section>
      <h3 className="section-heading">
        {title}
        <span className="count">{countItems(days)}</span>
      </h3>
      {days.length === 0 ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        days.map(([date, people]) => (
          <div key={date} className="day">
            <div className="day-label">{date === today ? 'Today' : shortDate(date)}</div>
            {people.map((p) => (
              <div key={p.id} className="person">
                <span className="avatar">{initials(p.name)}</span>
                <div className="person-body">
                  <span className="person-name">{p.name}</span>
                  {p.items.map((e) => (
                    <div key={e.id} className="item">
                      {has(e.activity) && <p className="item-main">{e.activity}</p>}
                      {has(e.progress) && (
                        <p className="line">
                          <span className="line-label">Progress</span>
                          {e.progress}
                        </p>
                      )}
                      {has(e.collaboration) && (
                        <p className="line">
                          <span className="line-label">Collaboration</span>
                          {e.collaboration}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  )

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <div className="range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={range === r.key ? 'active' : ''}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">
            {loggedCount}
            <span className="stat-of">/{members.length}</span>
          </span>
          <span className="stat-label">logged today</span>
        </div>
        <div className="stat">
          <span className={`stat-value ${openIssues.length > 0 ? 'warn' : ''}`}>{openIssues.length}</span>
          <span className="stat-label">open issues</span>
        </div>
        <div className="stat">
          <span className="stat-value">{countItems(completedFeed)}</span>
          <span className="stat-label">completed</span>
        </div>
        <div className="stat">
          <span className="stat-value">{countItems(pendingFeed)}</span>
          <span className="stat-label">pending</span>
        </div>
      </div>

      {notLogged.length > 0 && (
        <p className="muted-line">Not logged today: {notLogged.map((m) => m.name).join(', ')}</p>
      )}

      <h3 className="section-heading">
        Open issues
        <span className="count">{openIssues.length}</span>
      </h3>
      {openIssues.length === 0 ? (
        <p className="empty-state">No open issues.</p>
      ) : (
        <ul className="blocker-list">
          {openIssues.map((i) => {
            const n = daysBetween(i.firstSeen, today)
            return (
              <li key={i.key} className="blocker-item">
                <div className="blocker-top">
                  <div>
                    <span className="blocker-name">{i.member}</span>
                    <p className="blocker-text">{i.text}</p>
                    <p className="blocker-meta">
                      {n === 0
                        ? 'First logged today'
                        : `Open ${n} day${n === 1 ? '' : 's'}, first logged ${shortDate(i.firstSeen)}`}
                    </p>
                  </div>
                  <button className="btn-ghost" onClick={() => setResolved(i, true)}>
                    Mark resolved
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {resolvedIssues.length > 0 && (
        <>
          <button className="link-btn" onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? 'Hide' : 'Show'} resolved ({resolvedIssues.length})
          </button>
          {showResolved && (
            <ul className="blocker-list" style={{ marginTop: '0.75rem' }}>
              {resolvedIssues.map((i) => (
                <li key={i.key} className="blocker-item resolved">
                  <div className="blocker-top">
                    <div>
                      <span className="blocker-name">{i.member}</span>
                      <p className="blocker-text">{i.text}</p>
                      <p className="blocker-meta">Last logged {shortDate(i.lastSeen)}</p>
                    </div>
                    <button className="btn-ghost" onClick={() => setResolved(i, false)}>
                      Reopen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="dash-cols">
        {renderFeed('Completed', completedFeed, 'Nothing completed in this range.')}
        {renderFeed('Pending', pendingFeed, 'Nothing pending in this range.')}
      </div>
    </div>
  )
}

export default Dashboard