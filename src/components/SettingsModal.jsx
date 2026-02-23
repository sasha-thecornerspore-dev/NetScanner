import { useState, useEffect } from 'react'
import { Settings, X, Plus, Trash2, Key, Terminal, BookMarked } from 'lucide-react'

const DEFAULT_PROFILES = [
    { name: 'Quick Scan', command: '-T4 -F' },
    { name: 'Intense Scan', command: '-T4 -A -v' },
    { name: 'Ping Scan', command: '-sn' },
    { name: 'Vulnerability', command: '-sV --script=vuln' },
]

export default function SettingsModal({ onClose, userProfiles, setUserProfiles }) {
    const [settings, setSettings] = useState({ nmapPath: 'nmap', geminiKey: '' })
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [tab, setTab] = useState('general') // 'general' | 'profiles'
    const [newName, setNewName] = useState('')
    const [newCmd, setNewCmd] = useState('')

    useEffect(() => {
        fetch('/api/settings').then(r => r.json()).then(setSettings).catch(() => { })
    }, [])

    const save = async () => {
        setSaving(true)
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch { }
        setSaving(false)
    }

    const addProfile = async () => {
        if (!newName.trim() || !newCmd.trim()) return
        const resp = await fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim(), command: newCmd.trim() })
        })
        const created = await resp.json()
        setUserProfiles(p => [...p, created])
        setNewName(''); setNewCmd('')
    }

    const deleteProfile = async (id) => {
        await fetch(`/api/profiles/${id}`, { method: 'DELETE' })
        setUserProfiles(p => p.filter(x => x.id !== id))
    }

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-title">
                    <Settings size={16} color="var(--green)" />
                    Settings
                    <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={onClose}><X size={15} /></button>
                </div>

                {/* Tab bar */}
                <div className="tab-bar" style={{ marginBottom: 16, marginLeft: -4 }}>
                    <button className={`tab-btn ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>
                        <Terminal size={11} /> General
                    </button>
                    <button className={`tab-btn ${tab === 'profiles' ? 'active' : ''}`} onClick={() => setTab('profiles')}>
                        <BookMarked size={11} /> Profiles
                    </button>
                </div>

                {tab === 'general' && (
                    <>
                        <div className="form-group">
                            <label className="form-label"><Terminal size={11} style={{ display: 'inline', marginRight: 4 }} />Nmap Binary Path</label>
                            <input
                                className="form-input"
                                value={settings.nmapPath}
                                onChange={e => setSettings(s => ({ ...s, nmapPath: e.target.value }))}
                                placeholder="nmap  (or full path e.g. C:\Program Files (x86)\Nmap\nmap.exe)"
                            />
                            <div className="form-hint">Leave as <code>nmap</code> if it's in your system PATH</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label"><Key size={11} style={{ display: 'inline', marginRight: 4 }} />Gemini API Key</label>
                            <input
                                className="form-input"
                                type="password"
                                value={settings.geminiKey}
                                onChange={e => setSettings(s => ({ ...s, geminiKey: e.target.value }))}
                                placeholder="AIza..."
                                autoComplete="off"
                            />
                            <div className="form-hint">
                                Get a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>aistudio.google.com</a>. Required for AI Analysis.
                            </div>
                        </div>
                        <div className="form-hint" style={{ marginBottom: 12, padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            💡 <strong>nmap Installation:</strong> Download from <a href="https://nmap.org/download.html" target="_blank" rel="noreferrer" style={{ color: 'var(--green)' }}>nmap.org</a>. On Windows, install the official installer and ensure it's added to PATH.
                        </div>
                    </>
                )}

                {tab === 'profiles' && (
                    <>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Custom scan profiles (saved below built-in profiles)</div>
                        {userProfiles.length === 0 && (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '10px 0' }}>No custom profiles yet.</div>
                        )}
                        {userProfiles.map(p => (
                            <div className="profile-item" key={p.id}>
                                <div className="profile-item-name">{p.name}</div>
                                <div className="profile-item-cmd">{p.command}</div>
                                <button className="btn-icon" onClick={() => deleteProfile(p.id)} title="Delete"><Trash2 size={13} color="var(--red)" /></button>
                            </div>
                        ))}
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>NEW PROFILE</div>
                            <div className="form-group">
                                <input className="form-input" placeholder="Profile name" value={newName} onChange={e => setNewName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <input className="form-input" placeholder="nmap arguments (e.g. -T4 -sV -p 80,443)" value={newCmd} onChange={e => setNewCmd(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addProfile()} />
                            </div>
                            <button className="btn btn-ghost" onClick={addProfile} style={{ fontSize: 12 }}>
                                <Plus size={12} /> Add Profile
                            </button>
                        </div>
                    </>
                )}

                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    {tab === 'general' && (
                        <button className="btn btn-scan" onClick={save} disabled={saving}>
                            {saving ? <span className="spinner" /> : null}
                            {saved ? '✓ Saved!' : 'Save Settings'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
