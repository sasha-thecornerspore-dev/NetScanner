import { Wifi, Square, Play, Settings, Sparkles, AlertTriangle, CheckCircle, Bot } from 'lucide-react'

export default function Toolbar({
    target, setTarget, profile, setProfile, allProfiles,
    command, setCommand, scanning, nmapOk,
    onScan, onStop, onAiAnalyze, hostsFound, onSettings,
    onCopilot, copilotOpen
}) {
    const handleProfileChange = e => {
        const sel = allProfiles.find(p => p.id === e.target.value)
        if (sel) setProfile(sel)
    }

    return (
        <div className="toolbar">
            {/* Brand */}
            <div className="toolbar-brand">
                <Wifi size={16} color="var(--green)" />
                <span className="toolbar-brand-name">NetScanner AI</span>
            </div>

            {/* Target */}
            <input
                className="toolbar-input toolbar-target"
                placeholder="Target (IP / CIDR / host)"
                value={target}
                onChange={e => setTarget(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !scanning && onScan()}
                spellCheck={false}
            />

            {/* Profile */}
            <select
                className="toolbar-select"
                value={profile.id}
                onChange={handleProfileChange}
            >
                {allProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.isUser ? ' ★' : ''}</option>
                ))}
            </select>

            {/* Command preview */}
            <input
                className="toolbar-input toolbar-cmd"
                value={`nmap ${command} ${target}`}
                onChange={e => {
                    const raw = e.target.value.replace(/^nmap\s*/i, '').replace(target, '').trim()
                    setCommand(raw)
                    setProfile({ id: 'custom', name: 'Custom…', command: raw })
                }}
                spellCheck={false}
                title="Editable nmap command"
            />

            {/* Nmap status indicator */}
            {nmapOk === false && (
                <span title="nmap not found — install nmap and set path in Settings" style={{ color: 'var(--red)', cursor: 'help', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={14} />
                    <span style={{ fontSize: 11 }}>No nmap</span>
                </span>
            )}
            {nmapOk === true && (
                <span title="nmap available" style={{ color: 'var(--green)', display: 'flex', alignItems: 'center' }}>
                    <CheckCircle size={14} />
                </span>
            )}

            {/* Scan / Cancel */}
            <button
                className={`btn btn-scan ${scanning ? 'scanning' : ''}`}
                onClick={scanning ? onStop : onScan}
                disabled={!target.trim()}
            >
                {scanning
                    ? <><Square size={12} />Cancel</>
                    : <><Play size={12} />Scan</>
                }
            </button>

            {/* AI Analyze */}
            <button
                className="btn btn-ai"
                onClick={onAiAnalyze}
                disabled={!hostsFound}
                title={hostsFound ? 'Run AI analysis on scan results' : 'Run a scan first'}
            >
                <Sparkles size={12} /> AI Analyze
            </button>

            {/* AI Copilot */}
            <button
                className={`btn btn-copilot ${copilotOpen ? 'active' : ''}`}
                onClick={onCopilot}
                title="AI Copilot — conversational network exploration"
            >
                <Bot size={13} /> Copilot
            </button>

            {/* Settings */}
            <button className="btn-icon" onClick={onSettings} title="Settings">
                <Settings size={15} />
            </button>
        </div>
    )
}
