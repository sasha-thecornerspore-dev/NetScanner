import { useState, useRef, useEffect } from 'react'
import { Bot, Send, X, Terminal, Loader, Sparkles, ChevronRight } from 'lucide-react'

export default function CopilotPanel({ isOpen, onClose, scanContext, onHostsDiscovered }) {
    const [messages, setMessages] = useState([
        { role: 'assistant', type: 'text', content: 'I\'m your AI network copilot. Tell me what you\'d like to explore — I can scan targets, analyze results, and explain findings.\n\nTry: *"Scan my local network"* or *"Check localhost for open ports"*' }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const chatEndRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 200)
    }, [isOpen])

    const sendMessage = async () => {
        if (!input.trim() || loading) return

        const userMsg = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', type: 'text', content: userMsg }])
        setLoading(true)

        // Build history for context (last 20 messages)
        const history = messages.slice(-20).map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
        }))

        try {
            const resp = await fetch('/api/copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg,
                    history,
                    scanContext
                })
            })

            if (!resp.ok) {
                const err = await resp.json()
                setMessages(prev => [...prev, { role: 'assistant', type: 'error', content: err.error || 'Something went wrong' }])
                setLoading(false)
                return
            }

            // Process SSE stream
            const reader = resp.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let scanLines = []
            let currentCommand = null

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const event = JSON.parse(line.slice(6))

                        switch (event.type) {
                            case 'thinking':
                                setMessages(prev => [...prev, {
                                    role: 'assistant', type: 'thinking', content: event.text
                                }])
                                break

                            case 'command':
                                currentCommand = event.command
                                scanLines = []
                                setMessages(prev => [...prev, {
                                    role: 'assistant', type: 'command',
                                    content: event.command,
                                    target: event.target
                                }])
                                break

                            case 'scan_output':
                                scanLines.push(event.line)
                                // Update the last scan message with accumulated output
                                setMessages(prev => {
                                    const updated = [...prev]
                                    const lastScan = updated.findLastIndex(m => m.type === 'scan_progress')
                                    if (lastScan >= 0) {
                                        updated[lastScan] = { ...updated[lastScan], content: scanLines.join('\n') }
                                    } else {
                                        updated.push({ role: 'assistant', type: 'scan_progress', content: scanLines.join('\n') })
                                    }
                                    return updated
                                })
                                break

                            case 'scan_done':
                                // Nothing special — we wait for the response
                                break

                            case 'scan_hosts':
                                if (event.hosts?.length && onHostsDiscovered) {
                                    onHostsDiscovered(event.hosts, currentCommand)
                                }
                                break

                            case 'response':
                                setMessages(prev => [...prev, {
                                    role: 'assistant', type: 'text', content: event.text
                                }])
                                if (event.hosts?.length && onHostsDiscovered) {
                                    onHostsDiscovered(event.hosts, currentCommand)
                                }
                                break

                            case 'error':
                                setMessages(prev => [...prev, {
                                    role: 'assistant', type: 'error', content: event.message
                                }])
                                break
                        }
                    } catch { }
                }
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', type: 'error', content: e.message }])
        }

        setLoading(false)
    }

    const suggestions = [
        'Scan localhost',
        'Quick scan my network',
        'Check for vulnerabilities',
        'What ports are commonly dangerous?'
    ]

    if (!isOpen) return null

    return (
        <div className="copilot-panel">
            <div className="copilot-header">
                <div className="copilot-brand">
                    <Bot size={16} />
                    <span>AI Copilot</span>
                    <Sparkles size={10} className="copilot-sparkle" />
                </div>
                <button className="btn-icon" onClick={onClose}><X size={14} /></button>
            </div>

            <div className="copilot-messages">
                {messages.map((msg, i) => (
                    <div key={i} className={`copilot-msg copilot-msg-${msg.role}`}>
                        {msg.role === 'assistant' && (
                            <div className="copilot-msg-avatar">
                                <Bot size={12} />
                            </div>
                        )}
                        <div className={`copilot-msg-body copilot-msg-type-${msg.type}`}>
                            {msg.type === 'thinking' && (
                                <div className="copilot-thinking">
                                    <Loader size={11} className="spin" />
                                    <span>{msg.content}</span>
                                </div>
                            )}
                            {msg.type === 'command' && (
                                <div className="copilot-command">
                                    <div className="copilot-command-label"><Terminal size={10} /> Executing</div>
                                    <code>{msg.content}</code>
                                </div>
                            )}
                            {msg.type === 'scan_progress' && (
                                <div className="copilot-scan-output">
                                    <pre>{msg.content}</pre>
                                </div>
                            )}
                            {msg.type === 'text' && (
                                <div className="copilot-text" dangerouslySetInnerHTML={{
                                    __html: formatMarkdown(msg.content)
                                }} />
                            )}
                            {msg.type === 'error' && (
                                <div className="copilot-error">⚠ {msg.content}</div>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="copilot-msg copilot-msg-assistant">
                        <div className="copilot-msg-avatar"><Bot size={12} /></div>
                        <div className="copilot-msg-body copilot-msg-type-thinking">
                            <div className="copilot-thinking">
                                <Loader size={11} className="spin" />
                                <span>Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            {/* Quick suggestions when chat is empty-ish */}
            {messages.length <= 1 && !loading && (
                <div className="copilot-suggestions">
                    {suggestions.map((s, i) => (
                        <button key={i} className="copilot-chip" onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50) }}>
                            <ChevronRight size={10} /> {s}
                        </button>
                    ))}
                </div>
            )}

            <div className="copilot-input-area">
                <input
                    ref={inputRef}
                    className="copilot-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask me to scan, analyze, or explore..."
                    disabled={loading}
                />
                <button className="copilot-send" onClick={sendMessage} disabled={!input.trim() || loading}>
                    <Send size={14} />
                </button>
            </div>
        </div>
    )
}

// Simple markdown-to-HTML converter for copilot messages
function formatMarkdown(text) {
    if (!text) return ''
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>')
}
