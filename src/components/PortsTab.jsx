import { useState } from 'react'

function stateClass(state) {
    if (state === 'open') return 'port-state-open'
    if (state === 'closed') return 'port-state-closed'
    return 'port-state-filtered'
}

export default function PortsTab({ hosts, selected, onSelectHost }) {
    const [view, setView] = useState('byPort') // 'byPort' | 'byHost'

    const allPorts = []
    for (const h of hosts) {
        for (const p of h.ports) {
            allPorts.push({ ...p, host: h })
        }
    }

    if (hosts.length === 0) {
        return (
            <div className="empty-state">
                <span style={{ fontSize: 28 }}>🔌</span>
                <span>No results yet — run a scan</span>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Sub-nav */}
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                {['byPort', 'byHost'].map(v => (
                    <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`tab-btn ${view === v ? 'active' : ''}`}
                        style={{ padding: '4px 12px', fontSize: 11 }}
                    >
                        {v === 'byPort' ? 'Ports View' : 'Host View'}
                    </button>
                ))}
            </div>

            <div className="data-table-wrapper">
                {view === 'byPort' ? (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Host</th>
                                <th>Port</th>
                                <th>Protocol</th>
                                <th>State</th>
                                <th>Service</th>
                                <th>Product / Version</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allPorts.length === 0 && (
                                <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No ports found in scan results</td></tr>
                            )}
                            {allPorts.map((p, i) => (
                                <tr key={i} style={{ cursor: 'pointer' }} onClick={() => onSelectHost(p.host)}>
                                    <td style={{ color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 12 }}>{p.host.ip}</td>
                                    <td style={{ fontWeight: 600, fontSize: 13 }}>{p.port}</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{p.protocol}</td>
                                    <td><span className={stateClass(p.state)}>{p.state}</span></td>
                                    <td>{p.service || '—'}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{[p.product, p.version].filter(Boolean).join(' ') || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    hosts.map(h => (
                        <div key={h.ip} style={{ marginBottom: 16 }}>
                            <div style={{
                                padding: '8px 12px',
                                background: 'var(--bg-panel)',
                                borderRadius: 'var(--radius)',
                                marginBottom: 4,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                border: '1px solid var(--border)'
                            }} onClick={() => onSelectHost(h)}>
                                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--green)' }}>{h.ip}</span>
                                {h.hostnames[0] && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{h.hostnames[0]}</span>}
                                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11 }}>
                                    {h.os[0]?.name || h.macVendor || ''}
                                </span>
                                <span className="host-badge badge-up">{h.ports.filter(p => p.state === 'open').length} open</span>
                            </div>
                            {h.ports.length > 0 && (
                                <table className="data-table" style={{ marginLeft: 8 }}>
                                    <thead>
                                        <tr>
                                            <th>Port</th>
                                            <th>State</th>
                                            <th>Service</th>
                                            <th>Version</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {h.ports.map((p, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 600 }}>{p.port}/{p.protocol}</td>
                                                <td><span className={stateClass(p.state)}>{p.state}</span></td>
                                                <td>{p.service || '—'}</td>
                                                <td style={{ color: 'var(--text-secondary)' }}>{[p.product, p.version].filter(Boolean).join(' ') || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
