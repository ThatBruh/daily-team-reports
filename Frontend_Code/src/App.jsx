import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import EntryForm from './EntryForm'
import History from './History'
import Dashboard from './Dashboard'
import Insights from './Insights'
import Import from './Import'
import Team from './Team'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'insights', label: 'Insights' },
  { key: 'entry', label: 'New Entry' },
  { key: 'import', label: 'Import' },
  { key: 'history', label: 'History' },
  { key: 'team', label: 'Team' },
]

function App() {
  const [members, setMembers] = useState([])
  const [view, setView] = useState('dashboard')

  const loadMembers = () =>
    supabase
      .from('team_members')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setMembers(data)
      })

  useEffect(() => {
    loadMembers()
  }, [])

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="sidebar-title">Standup Tracker</h1>
        <p className="sidebar-date">{todayLabel}</p>
        <nav>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? 'active' : ''}`}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        {view === 'dashboard' && <Dashboard members={members} />}
        {view === 'insights' && <Insights />}
        {view === 'entry' && <EntryForm members={members} onSaved={() => setView('dashboard')} />}
        {view === 'import' && <Import members={members} onImported={() => setView('dashboard')} />}
        {view === 'history' && <History />}
        {view === 'team' && <Team members={members} onChange={loadMembers} />}
      </main>
    </div>
  )
}

export default App