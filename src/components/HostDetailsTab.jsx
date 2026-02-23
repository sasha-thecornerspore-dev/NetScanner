import { Monitor, Globe, Cpu, Network } from 'lucide-react'

export default function HostDetailsTab({ host }) {
    if (!host) {
        return (
            <div className="empty-state">
                <Monitor size={32} style={{ opacity: 0.3 }} />
                <span>Select a host from the sidebar</span>
            </div>
        )
    }

    const openPorts = host.ports.filter(p => p.state === 'open')
    const closedPorts = host.ports.filter(p => p.state !== 'open')

    return (
        <div className="detail-pane">
            {/* Identity */}
            <div className="detail-card">
                <div className="detail-card-title">Host Identity</div>
                <div className="detail-row">
                    <span className="detail-key">IP Address</span>
                    <span className="detail-val" style={{ color: 'var(--green)' }}>{host.ip}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-key">Status</span>
                    <span className="detail-val">
                        <span className={host.status === 'up' ? 'text-green' : 'text-red'}>{host.status}</span>
                    </span>
                </div>
                {host.hostnames.length > 0 && (
                    <div className="detail-row">
                        <span className="detail-key">Hostnames</span>
                        <span className="detail-val">{host.hostnames.join(', ')}</span>
                    </div>
                )}
                {host.mac && (
                    <div className="detail-row">
                        <span className="detail-key">MAC Address</span>
                        <span className="detail-val">{host.mac}{host.macVendor ? ` (${host.macVendor})` : ''}</span>
                    </div>
                )}
            </div>

            {/* OS */}
            {host.os.length > 0 && (
                <div className="detail-card">
                    <div className="detail-card-title"><Cpu size={12} style={{ display: 'inline', marginRight: 5 }} />OS Detection</div>
                    {host.os.map((o, i) => (
                        <div className="detail-row" key={i}>
                            <span className="detail-key">{i === 0 ? 'Best match' : `Match ${i + 1}`}</span>
                            <span className="detail-val">{o.name} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({o.accuracy}% accuracy)</span></span>
                        </div>
                    ))}
                </div>
            )}

            {/* Open Ports */}
            {openPorts.length > 0 && (
                <div className="detail-card">
                    <div className="detail-card-title"><Network size={12} style={{ display: 'inline', marginRight: 5 }} />Open Ports ({openPorts.length})</div>
                    <table className="data-table" style={{ marginTop: 4 }}>
                        <thead>
                            <tr>
                                <th>Port</th>
                                <th>Proto</th>
                                <th>Service</th>
                                <th>Product</th>
                                <th>Version</th>
                                <th>Extra</th>
                            </tr>
                        </thead>
                        <tbody>
                            {openPorts.map((p, i) => (
                                <tr key={i}>
                                    <td style={{ color: 'var(--green)', fontWeight: 700 }}>{p.port}</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{p.protocol}</td>
                                    <td>{p.service || '—'}</td>
                                    <td>{p.product || '—'}</td>
                                    <td>{p.version || '—'}</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{p.extraInfo || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Closed Ports */}
            {closedPorts.length > 0 && (
                <div className="detail-card">
                    <div className="detail-card-title">Closed / Filtered Ports ({closedPorts.length})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {closedPorts.slice(0, 60).map((p, i) => (
                            <span key={i} style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 11,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: p.state === 'filtered' ? 'var(--yellow-faint)' : 'var(--red-faint)',
                                color: p.state === 'filtered' ? 'var(--yellow)' : 'var(--red)',
                                border: `1px solid ${p.state === 'filtered' ? '#ffd70030' : '#ff336630'}`,
                            }}>
                                {p.port}
                            </span>
                        ))}
                        {closedPorts.length > 60 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{closedPorts.length - 60} more…</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
