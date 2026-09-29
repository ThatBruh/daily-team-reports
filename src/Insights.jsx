import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from './supabaseClient'

const RANGES = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7', label: '7 days', days: 6 },
  { key: '30', label: '30 days', days: 29 },
  { key: 'all', label: 'All', days: null },
]

const PALETTE = ['#4fd1a5', '#6ea8fe', '#b794f6', '#f28b9b', '#7fd3e0', '#c8d36b', '#9aa3b8']

const has = (v) => v && v.trim() !== '' && v !== 'N/A'

const isoDaysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}

function PieCard({ title, data, emptyText }) {
  const total = data.reduce((n, d) => n + d.value, 0)

  return (
    <div className="chart-card">
      <h3 className="section-heading">{title}</h3>
      {total === 0 ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        <div className="chart-body">
          <div className="chart-plot">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1c1f27',
                    border: '1px solid #2a2e38',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  itemStyle={{ color: '#e8e9ed' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-center">{total}</div>
          </div>

          <ul className="legend">
            {data.map((d) => (
              <li key={d.name}>
                <span className="dot" style={{ background: d.color }} />
                <span className="legend-name">{d.name}</span>
                <span className="legend-val">{d.value}</span>
                <span className="legend-pct">{Math.round((d.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Insights() {
  const [entries, setEntries] = useState([])
  const [range, setRange] = useState('7')

  useEffect(() => {
    supabase
      .from('daily_entries')
      .select('*, team_members(name)')
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setEntries(data)
      })
  }, [])

  const rangeDef = RANGES.find((r) => r.key === range)
  const cutoff = rangeDef.days === null ? null : isoDaysAgo(rangeDef.days)

  // Completed and pending items in range, with exact duplicates collapsed
  const seen = new Set()
  const completedByPerson = new Map()
  let completedCount = 0
  let pendingCount = 0

  entries.forEach((e) => {
    if (cutoff !== null && e.entry_date < cutoff) return
    if (!(has(e.activity) || has(e.progress) || has(e.collaboration))) return
    const sig = `${e.section}|${e.member_id}|${e.entry_date}|${e.activity}|${e.progress}|${e.collaboration}`
    if (seen.has(sig)) return
    seen.add(sig)

    if (e.section === 'completed') {
      completedCount++
      const name = e.team_members?.name || 'Unknown'
      completedByPerson.set(name, (completedByPerson.get(name) || 0) + 1)
    } else if (e.section === 'today') {
      pendingCount++
    }
  })

  // Open issues (all time), same grouping as the dashboard
  const groups = new Map()
  entries
    .filter((e) => has(e.issue_blocker))
    .forEach((e) => {
      const key = `${e.member_id}|${e.issue_blocker.trim().toLowerCase()}`
      const g = groups.get(key) || { name: e.team_members?.name || 'Unknown', resolved: true }
      if (!e.blocker_resolved) g.resolved = false
      groups.set(key, g)
    })

  const issuesByPerson = new Map()
  let openCount = 0
  groups.forEach((g) => {
    if (g.resolved) return
    openCount++
    issuesByPerson.set(g.name, (issuesByPerson.get(g.name) || 0) + 1)
  })

  // One stable color per person across both person charts
  const names = [...new Set([...completedByPerson.keys(), ...issuesByPerson.keys()])].sort()
  const colorFor = (name) => PALETTE[names.indexOf(name) % PALETTE.length]

  const toSlices = (map) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, color: colorFor(name) }))

  const statusData = [
    { name: 'Completed', value: completedCount, color: '#4fd1a5' },
    { name: 'Pending', value: pendingCount, color: '#6b7385' },
    { name: 'Open issues', value: openCount, color: '#f2a65a' },
  ].filter((d) => d.value > 0)

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Insights</h2>
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

      <p className="muted-line">
        Completed and pending follow the range above. Open issues always include everything still unresolved.
      </p>

      <div className="chart-grid">
        <PieCard title="Work breakdown" data={statusData} emptyText="No activity in this range." />
        <PieCard
          title="Completed by person"
          data={toSlices(completedByPerson)}
          emptyText="Nothing completed in this range."
        />
        <PieCard
          title="Open issues by person"
          data={toSlices(issuesByPerson)}
          emptyText="No open issues."
        />
      </div>
    </div>
  )
}

export default Insights