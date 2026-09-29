import { useState } from 'react'
import { supabase } from './supabaseClient'

function Team({ members, onChange }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const add = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      return alert(`${trimmed} is already on the team`)
    }
    setSaving(true)
    const { error } = await supabase.from('team_members').insert({ name: trimmed })
    setSaving(false)
    if (error) {
      console.error(error)
      alert('Could not add member. Check the console.')
    } else {
      setName('')
      onChange()
    }
  }

  const deactivate = async (member) => {
    if (!confirm(`Remove ${member.name} from the active team? Their past entries stay in History.`)) return
    const { error } = await supabase.from('team_members').update({ active: false }).eq('id', member.id)
    if (error) console.error(error)
    else onChange()
  }

  return (
    <div>
      <h2 className="page-title">Team</h2>

      <form className="add-member" onSubmit={add}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
        />
        <button className="btn-primary" disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : 'Add member'}
        </button>
      </form>

      <ul className="member-list">
        {members.map((m) => (
          <li key={m.id} className="member-row">
            <span>{m.name}</span>
            <button className="btn-ghost" onClick={() => deactivate(m)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Team