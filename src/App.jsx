import { useState, useEffect, useRef, useCallback } from 'react'
import Toolbar from './components/Toolbar.jsx'
import HostSidebar from './components/HostSidebar.jsx'
import OutputTab from './components/OutputTab.jsx'
import PortsTab from './components/PortsTab.jsx'
import TopologyTab from './components/TopologyTab.jsx'
import HostDetailsTab from './components/HostDetailsTab.jsx'
import AiAnalysisTab from './components/AiAnalysisTab.jsx'
import StatusBar from './components/StatusBar.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import CopilotPanel from './components/CopilotPanel.jsx'

// ─── Default scan profiles ──────────────────────────────────────────────────
const BUILTIN_PROFILES = [
    { id: 'quick', name: 'Quick Scan', command: '-T4 -F' },
    { id: 'intense', name: 'Intense Scan', command: '-T4 -A -v' },
    { id: 'intense-udp', name: 'Intense Scan + UDP', command: '-sS -sU -T4 -A -v' },
    { id: 'ping', name: 'Ping Scan', command: '-sn' },
    { id: 'os', name: 'OS Detection', command: '-O' },
    { id: 'version', name: 'Version Detection', command: '-sV' },
    { id: 'slow-comp', name: 'Slow Comprehensive Scan', command: '-sS -sU -T4 -A -v -PE -PP -PS80,443 -PA3389 -PU40125 -PY -g 53 --script all' },
    { id: 'vuln', name: 'Vulnerability Scan', command: '-sV --script=vuln' },
    { id: 'custom', name: 'Custom…', command: '' },
]

export default function App() {
    const [target, setTarget] = useState('127.0.0.1')
    const [profile, setProfile] = useState(BUILTIN_PROFILES[0])
    const [command, setCommand] = useState(BUILTIN_PROFILES[0].command)
    const [scanning, setScanning] = useState(false)
    const [lines, setLines] = useState([])
    const [hosts, setHosts] = useState([])
    const [selectedHost, setSelectedHost] = useState(null)
    const [activeTab, setActiveTab] = useState('output')
    const [scanMeta, setScanMeta] = useState(null)
    const [aiData, setAiData] = useState(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [nmapOk, setNmapOk] = useState(null)
    const [nmapVersion, setNmapVersion] = useState('')
    const [showSettings, setShowSettings] = useState(false)
    const [userProfiles, setUserProfiles] = useState([])
    const [elapsed, setElapsed] = useState(0)
    const [copilotOpen, setCopilotOpen] = useState(false)
    const scanIdRef = useRef(null)
    const timerRef = useRef(null)
    const esRef = useRef(null)

    // ── Fetch nmap availability on mount
    useEffect(() => {
        fetch('/api/detect-nmap')
            .then(r => r.json())
            .then(d => { setNmapOk(d.available); setNmapVersion(d.version || '') })
            .catch(() => setNmapOk(false))
        fetch('/api/profiles')
            .then(r => r.json())
            .then(setUserProfiles)
            .catch(() => { })
    }, [])

    // ── Profile → command sync
    useEffect(() => {
        if (profile.id !== 'custom') setCommand(profile.command)
    }, [profile])

    const allProfiles = [...BUILTIN_PROFILES, ...userProfiles.map(p => ({ ...p, isUser: true }))]

    // ── Start scan
    const startScan = useCallback(async () => {
        if (!target.trim()) return
        const id = Date.now().toString()
        scanIdRef.current = id
        setScanning(true)
        setLines([])
        setHosts([])
        setAiData(null)
        setSelectedHost(null)
        setScanMeta({ target, command, startTime: Date.now() })
        setElapsed(0)
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

        try {
            const resp = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: target.trim(), command, scanId: id })
            })
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            const reader = resp.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const parts = buffer.split('\n\n')
                buffer = parts.pop()
                for (const part of parts) {
                    if (!part.startsWith('data: ')) continue
                    try {
                        const evt = JSON.parse(part.slice(6))
                        handleScanEvent(evt)
                    } catch { }
                }
            }
        } catch (e) {
            setLines(l => [...l, { text: `Error: ${e.message}`, cls: 'red' }])
        } finally {
            setScanning(false)
            clearInterval(timerRef.current)
        }
    }, [target, command])

    const handleScanEvent = useCallback((evt) => {
        const { type, data } = evt
        if (type === 'start') {
            setLines([{ text: `Starting: ${data.command}`, cls: 'green' }])
        } else if (type === 'output') {
            const line = data.line
            const cls = line.includes('open') ? 'green'
                : line.includes('closed') || line.includes('filtered') ? 'yellow'
                    : line.startsWith('Nmap') || line.startsWith('Note') ? 'blue'
                        : 'info'
            setLines(l => [...l, { text: line, cls }])
        } else if (type === 'hosts') {
            setHosts(data.hosts || [])
            if (data.hosts?.length > 0) setSelectedHost(data.hosts[0])
        } else if (type === 'done') {
            setLines(l => [...l, { text: `\nScan complete. Exit code: ${data.code}`, cls: data.exitOk ? 'green' : 'red' }])
        } else if (type === 'error') {
            setLines(l => [...l, { text: `Error: ${data.message}`, cls: 'red' }])
        }
    }, [])

    // ── Stop scan
    const stopScan = useCallback(async () => {
        if (scanIdRef.current) {
            await fetch('/api/scan/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scanId: scanIdRef.current })
            })
        }
    }, [])

    // ── AI analysis
    const runAiAnalysis = useCallback(async () => {
        if (!hosts.length) return
        setAiLoading(true)
        setActiveTab('ai')
        try {
            const resp = await fetch('/api/ai-analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hosts, target })
            })
            const data = await resp.json()
            if (data.error) setAiData({ error: data.error })
            else setAiData(data)
        } catch (e) {
            setAiData({ error: e.message })
        } finally {
            setAiLoading(false)
        }
    }, [hosts, target])

    const tabs = [
        { id: 'output', label: 'Nmap Output' },
        { id: 'ports', label: 'Ports / Hosts' },
        { id: 'topo', label: 'Topology' },
        { id: 'details', label: 'Host Details' },
        { id: 'ai', label: '✦ AI Analysis', glow: true },
    ]

    return (
        <div className="app-shell">
            <Toolbar
                target={target}
                setTarget={setTarget}
                profile={profile}
                setProfile={setProfile}
                allProfiles={allProfiles}
                command={command}
                setCommand={setCommand}
                scanning={scanning}
                nmapOk={nmapOk}
                onScan={startScan}
                onStop={stopScan}
                onAiAnalyze={runAiAnalysis}
                hostsFound={hosts.length}
                onSettings={() => setShowSettings(true)}
                onCopilot={() => setCopilotOpen(c => !c)}
                copilotOpen={copilotOpen}
            />

            <HostSidebar
                hosts={hosts}
                selected={selectedHost}
                onSelect={h => { setSelectedHost(h); setActiveTab('details') }}
                aiData={aiData}
            />

            <div className="main-content">
                {scanning && <div className="scan-progress-bar"><div className="scan-progress-fill" /></div>}
                <div className="tab-bar">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(t.id)}
                            style={t.glow && activeTab !== t.id ? { color: 'var(--blue)' } : {}}
                        >
                            {t.label}
                            {t.id === 'ai' && aiLoading && <span className="spinner" style={{ width: 10, height: 10 }} />}
                        </button>
                    ))}
                </div>
                <div className="tab-content">
                    {activeTab === 'output' && <OutputTab lines={lines} scanning={scanning} />}
                    {activeTab === 'ports' && <PortsTab hosts={hosts} selected={selectedHost} onSelectHost={setSelectedHost} />}
                    {activeTab === 'topo' && <TopologyTab hosts={hosts} />}
                    {activeTab === 'details' && <HostDetailsTab host={selectedHost} />}
                    {activeTab === 'ai' && (
                        <AiAnalysisTab
                            aiData={aiData}
                            aiLoading={aiLoading}
                            hosts={hosts}
                            target={target}
                            onAiAnalyze={runAiAnalysis}
                        />
                    )}
                </div>
            </div>

            <StatusBar
                scanning={scanning}
                nmapOk={nmapOk}
                nmapVersion={nmapVersion}
                hostsUp={hosts.filter(h => h.status === 'up').length}
                totalHosts={hosts.length}
                elapsed={elapsed}
                target={scanMeta?.target}
            />

            {showSettings && (
                <SettingsModal
                    onClose={() => setShowSettings(false)}
                    userProfiles={userProfiles}
                    setUserProfiles={setUserProfiles}
                />
            )}

            <CopilotPanel
                isOpen={copilotOpen}
                onClose={() => setCopilotOpen(false)}
                scanContext={{ hosts, target, command }}
                onHostsDiscovered={(newHosts, cmd) => {
                    setHosts(newHosts)
                    if (newHosts.length > 0) setSelectedHost(newHosts[0])
                }}
            />
        </div>
    )
}
