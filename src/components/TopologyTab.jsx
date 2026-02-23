import { useEffect, useRef, useState } from 'react'

const RISK_COLORS = {
    Critical: '#ff3366',
    High: '#ff7c00',
    Medium: '#ffd700',
    Low: '#00ff9f',
    Unknown: '#7e97b8',
}

export default function TopologyTab({ hosts }) {
    const canvasRef = useRef(null)
    const stateRef = useRef({ nodes: [], links: [], dragging: null, offsetX: 0, offsetY: 0, scale: 1, panX: 0, panY: 0 })
    const animRef = useRef(null)
    const [tooltip, setTooltip] = useState(null)

    useEffect(() => {
        if (!hosts.length) return
        const canvas = canvasRef.current
        if (!canvas) return

        const W = canvas.offsetWidth
        const H = canvas.offsetHeight
        canvas.width = W
        canvas.height = H

        const cx = W / 2
        const cy = H / 2

        // Build nodes — gateway in center, hosts in ring
        const router = { id: 'router', label: 'Gateway', x: cx, y: cy, isRouter: true, vx: 0, vy: 0 }
        const nodes = [router]
        const links = []

        hosts.filter(h => h.status === 'up').forEach((h, i) => {
            const angle = (i / Math.max(hosts.filter(x => x.status === 'up').length, 1)) * Math.PI * 2
            const r = Math.min(W, H) * 0.28
            const x = cx + Math.cos(angle) * r + (Math.random() - 0.5) * 30
            const y = cy + Math.sin(angle) * r + (Math.random() - 0.5) * 30
            nodes.push({ id: h.ip, label: h.ip, hostname: h.hostnames[0] || '', ports: h.ports.filter(p => p.state === 'open').length, x, y, vx: 0, vy: 0, isRouter: false })
            links.push({ source: 'router', target: h.ip })
        })

        stateRef.current.nodes = nodes
        stateRef.current.links = links
        stateRef.current.scale = 1
        stateRef.current.panX = 0
        stateRef.current.panY = 0

        function draw() {
            const ctx = canvas.getContext('2d')
            const { nodes, links, scale, panX, panY } = stateRef.current
            ctx.clearRect(0, 0, W, H)

            // Grid
            ctx.save()
            ctx.strokeStyle = '#1a2235'
            ctx.lineWidth = 0.5
            const gs = 40 * scale
            const ox = (panX % gs + gs) % gs
            const oy = (panY % gs + gs) % gs
            for (let x = ox; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
            for (let y = oy; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
            ctx.restore()

            ctx.save()
            ctx.translate(panX, panY)
            ctx.scale(scale, scale)

            // Links
            for (const link of links) {
                const src = nodes.find(n => n.id === link.source)
                const tgt = nodes.find(n => n.id === link.target)
                if (!src || !tgt) continue
                ctx.beginPath()
                ctx.moveTo(src.x, src.y)
                ctx.lineTo(tgt.x, tgt.y)
                ctx.strokeStyle = '#1e3a5f'
                ctx.lineWidth = 1.5 / scale
                ctx.setLineDash([4, 4])
                ctx.stroke()
                ctx.setLineDash([])
            }

            // Nodes
            for (const node of nodes) {
                const isRouter = node.isRouter
                const r = isRouter ? 22 : 16

                // Glow
                const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 2.5)
                grd.addColorStop(0, isRouter ? '#00ff9f55' : '#00b4ff33')
                grd.addColorStop(1, 'transparent')
                ctx.beginPath()
                ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2)
                ctx.fillStyle = grd
                ctx.fill()

                // Circle
                ctx.beginPath()
                ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
                ctx.fillStyle = isRouter ? '#0a1f14' : '#0a1422'
                ctx.fill()
                ctx.strokeStyle = isRouter ? '#00ff9f' : '#00b4ff'
                ctx.lineWidth = 1.5 / scale
                ctx.stroke()

                // Icon text
                ctx.fillStyle = isRouter ? '#00ff9f' : '#00b4ff'
                ctx.font = `bold ${isRouter ? 12 : 10}px "JetBrains Mono", monospace`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText(isRouter ? '⌂' : '⬡', node.x, node.y)

                // Label
                ctx.fillStyle = '#e2e8f0'
                ctx.font = `${isRouter ? 11 : 10}px "JetBrains Mono", monospace`
                ctx.textBaseline = 'top'
                ctx.fillText(node.label, node.x, node.y + r + 4)
                if (node.hostname) {
                    ctx.fillStyle = '#7e97b8'
                    ctx.font = '9px Inter, sans-serif'
                    ctx.fillText(node.hostname, node.x, node.y + r + 17)
                }
                if (!isRouter && node.ports !== undefined) {
                    ctx.fillStyle = '#00ff9f'
                    ctx.font = '9px "JetBrains Mono", monospace'
                    ctx.textBaseline = 'bottom'
                    ctx.fillText(`${node.ports}p`, node.x, node.y - r - 3)
                }
            }
            ctx.restore()
            animRef.current = requestAnimationFrame(draw)
        }

        if (animRef.current) cancelAnimationFrame(animRef.current)
        draw()

        // Mouse interactions
        let isPanning = false, lastX = 0, lastY = 0
        function getNode(mx, my) {
            const { nodes, scale, panX, panY } = stateRef.current
            const wx = (mx - panX) / scale
            const wy = (my - panY) / scale
            return nodes.find(n => {
                const r = n.isRouter ? 22 : 16
                return Math.hypot(n.x - wx, n.y - wy) < r
            })
        }
        function onMouseDown(e) {
            const rect = canvas.getBoundingClientRect()
            const mx = e.clientX - rect.left
            const my = e.clientY - rect.top
            const node = getNode(mx, my)
            if (node) {
                stateRef.current.dragging = node
                stateRef.current.offsetX = node.x - (mx - stateRef.current.panX) / stateRef.current.scale
                stateRef.current.offsetY = node.y - (my - stateRef.current.panY) / stateRef.current.scale
            } else {
                isPanning = true; lastX = mx; lastY = my
            }
        }
        function onMouseMove(e) {
            const rect = canvas.getBoundingClientRect()
            const mx = e.clientX - rect.left
            const my = e.clientY - rect.top
            const { dragging, scale, panX, panY, offsetX, offsetY } = stateRef.current
            if (dragging) {
                dragging.x = (mx - panX) / scale + offsetX
                dragging.y = (my - panY) / scale + offsetY
            } else if (isPanning) {
                stateRef.current.panX += mx - lastX
                stateRef.current.panY += my - lastY
                lastX = mx; lastY = my
            }
            // Tooltip
            const hovered = getNode(mx, my)
            if (hovered && !hovered.isRouter) {
                setTooltip({ x: e.clientX, y: e.clientY, node: hovered })
            } else {
                setTooltip(null)
            }
        }
        function onMouseUp() { stateRef.current.dragging = null; isPanning = false }
        function onWheel(e) {
            e.preventDefault()
            const delta = e.deltaY > 0 ? 0.9 : 1.1
            stateRef.current.scale = Math.max(0.3, Math.min(3, stateRef.current.scale * delta))
        }

        canvas.addEventListener('mousedown', onMouseDown)
        canvas.addEventListener('mousemove', onMouseMove)
        canvas.addEventListener('mouseup', onMouseUp)
        canvas.addEventListener('wheel', onWheel, { passive: false })

        return () => {
            cancelAnimationFrame(animRef.current)
            canvas.removeEventListener('mousedown', onMouseDown)
            canvas.removeEventListener('mousemove', onMouseMove)
            canvas.removeEventListener('mouseup', onMouseUp)
            canvas.removeEventListener('wheel', onWheel)
        }
    }, [hosts])

    if (!hosts.length || hosts.filter(h => h.status === 'up').length === 0) {
        return (
            <div className="topology-empty">
                <span style={{ fontSize: 32 }}>🕸️</span>
                <span style={{ fontSize: 13 }}>No hosts to display</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Run a scan to see the network topology</span>
            </div>
        )
    }

    return (
        <div className="topology-canvas-wrapper">
            <canvas ref={canvasRef} className="topology-canvas" style={{ display: 'block', cursor: 'grab' }} />
            {tooltip && (
                <div style={{
                    position: 'fixed',
                    left: tooltip.x + 12,
                    top: tooltip.y - 10,
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 11,
                    fontFamily: 'var(--mono)',
                    color: 'var(--text-primary)',
                    pointerEvents: 'none',
                    zIndex: 50,
                    boxShadow: '0 8px 24px #000a',
                }}>
                    <div style={{ color: 'var(--blue)', fontWeight: 700, marginBottom: 4 }}>{tooltip.node.label}</div>
                    {tooltip.node.hostname && <div style={{ color: 'var(--text-muted)' }}>{tooltip.node.hostname}</div>}
                    <div style={{ color: 'var(--green)' }}>{tooltip.node.ports} open port{tooltip.node.ports !== 1 ? 's' : ''}</div>
                </div>
            )}
            <div style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                scroll to zoom • drag to pan • drag nodes
            </div>
        </div>
    )
}
