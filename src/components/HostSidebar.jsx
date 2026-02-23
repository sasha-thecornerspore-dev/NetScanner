import { Monitor, ChevronRight } from 'lucide-react'

function riskBadge(aiData, ip) {
    if (!aiData?.hosts) return null
    const h = aiData.hosts.find(h => h.ip === ip)
    if (!h) return null
    const cls = h.riskLevel === 'Critical' ? 'badge-critical'
        : h.riskLevel === 'High' ? 'badge-high'
            : h.riskLevel === 'Medium' ? 'badge-medium'
                : 'badge-low'
    return <span className={`host-badge ${cls}`}>{h.riskScore}</span>
}

export default function HostSidebar({ hosts, selected, onSelect, aiData }) {
    const up = hosts.filter(h => h.status === 'up')
    const down = hosts.filter(h => h.status !== 'up')

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <span className="sidebar-title">Hosts</span>
                <span className="text-muted text-sm">{hosts.length > 0 ? `${up.length} up` : '—'}</span>
            </div>
            <div className="sidebar-body">
                {hosts.length === 0 && (
                    <div style={{ padding: '20px 12px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                        <Monitor size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                        <div>No hosts discovered</div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>Run a scan to populate</div>
                    </div>
                )}
                {up.map(h => (
                    <div
                        key={h.ip}
                        className={`host-item ${selected?.ip === h.ip ? 'active' : ''}`}
                        onClick={() => onSelect(h)}
                    >
                        <Monitor size={13} color="var(--green)" />
                        <div className="host-item-info">
                            <div className="host-item-ip">{h.ip}</div>
                            <div className="host-item-name">
                                {h.hostnames[0] || h.macVendor || `${h.ports.filter(p => p.state === 'open').length} open port${h.ports.filter(p => p.state === 'open').length !== 1 ? 's' : ''}`}
                            </div>
                        </div>
                        {riskBadge(aiData, h.ip) || (
                            <span className="host-badge badge-up">{h.ports.filter(p => p.state === 'open').length}p</span>
                        )}
                    </div>
                ))}
                {down.length > 0 && (
                    <>
                        <div style={{ padding: '6px 12px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                            Down / Filtered
                        </div>
                        {down.map(h => (
                            <div
                                key={h.ip}
                                className={`host-item ${selected?.ip === h.ip ? 'active' : ''}`}
                                onClick={() => onSelect(h)}
                            >
                                <Monitor size={13} color="var(--text-muted)" />
                                <div className="host-item-info">
                                    <div className="host-item-ip" style={{ color: 'var(--text-muted)' }}>{h.ip}</div>
                                    <div className="host-item-name">Host down</div>
                                </div>
                                <span className="host-badge badge-closed">✗</span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    )
}
