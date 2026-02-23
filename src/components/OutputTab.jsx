import { useEffect, useRef } from 'react'
import { Radio } from 'lucide-react'

function colorClass(cls) {
    if (cls === 'green') return 'var(--green)'
    if (cls === 'red') return 'var(--red)'
    if (cls === 'yellow') return 'var(--yellow)'
    if (cls === 'blue') return 'var(--blue)'
    return 'var(--text-secondary)'
}

export default function OutputTab({ lines, scanning }) {
    const bottomRef = useRef(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, [lines])

    if (lines.length === 0) {
        return (
            <div className="terminal-empty">
                <div className="terminal-pulse">
                    <Radio size={24} />
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                    {scanning ? 'Scanning…' : 'Ready to scan'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Enter a target and click Scan
                </div>
            </div>
        )
    }

    return (
        <div className="terminal">
            {lines.map((l, i) => (
                <div
                    key={i}
                    className="terminal-line"
                    style={{ color: colorClass(l.cls) }}
                >
                    {l.text}
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    )
}
