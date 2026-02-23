import { Activity, Wifi, WifiOff, Clock, Server } from 'lucide-react'

function formatElapsed(s) {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function StatusBar({ scanning, nmapOk, nmapVersion, hostsUp, totalHosts, elapsed, target }) {
    return (
        <div className="statusbar">
            <div className="statusbar-segment">
                <div className={`statusbar-dot ${scanning ? 'green' : nmapOk ? '' : 'red'}`} />
                <span>{scanning ? 'Scanning…' : 'Ready'}</span>
            </div>

            <span className="statusbar-sep">|</span>

            {target && (
                <>
                    <div className="statusbar-segment">
                        <Server size={11} />
                        <span>{target}</span>
                    </div>
                    <span className="statusbar-sep">|</span>
                </>
            )}

            {totalHosts > 0 && (
                <>
                    <div className="statusbar-segment">
                        <Wifi size={11} color="var(--green)" />
                        <span style={{ color: 'var(--green)' }}>{hostsUp} up</span>
                        {totalHosts > hostsUp && <span> / {totalHosts} total</span>}
                    </div>
                    <span className="statusbar-sep">|</span>
                </>
            )}

            {scanning && (
                <>
                    <div className="statusbar-segment">
                        <Clock size={11} />
                        <span>{formatElapsed(elapsed)}</span>
                    </div>
                    <span className="statusbar-sep">|</span>
                </>
            )}

            <div className="statusbar-grow" />

            <div className="statusbar-segment">
                {nmapOk === true && <Wifi size={11} color="var(--green)" />}
                {nmapOk === false && <WifiOff size={11} color="var(--red)" />}
                <span>{nmapOk === true ? `nmap ${nmapVersion}` : nmapOk === false ? 'nmap not found' : 'Detecting nmap…'}</span>
            </div>

            <span className="statusbar-sep">|</span>
            <span style={{ color: 'var(--green)', opacity: 0.7 }}>NetScanner AI v1.0</span>
        </div>
    )
}
