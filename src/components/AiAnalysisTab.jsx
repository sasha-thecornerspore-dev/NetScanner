import { useState } from 'react'
import { Sparkles, ShieldAlert, ShieldCheck, ShieldOff, AlertCircle, Loader } from 'lucide-react'

function riskColor(level) {
    return level === 'Critical' ? 'var(--red)'
        : level === 'High' ? 'var(--orange)'
            : level === 'Medium' ? 'var(--yellow)'
                : level === 'Low' ? 'var(--green)'
                    : 'var(--blue)'
}

function RiskGauge({ score, level }) {
    const color = riskColor(level)
    return (
        <div className="risk-gauge">
            <div className="risk-bar-track">
                <div className="risk-bar-fill" style={{ width: `${score}%`, background: color }} />
            </div>
            <span className="risk-score-label" style={{ color }}>{score}</span>
        </div>
    )
}

export default function AiAnalysisTab({ aiData, aiLoading, hosts, target, onAiAnalyze }) {
    const [question, setQuestion] = useState('')
    const [answer, setAnswer] = useState('')
    const [asking, setAsking] = useState(false)

    const askQuestion = async () => {
        if (!question.trim() || !hosts.length) return
        setAsking(true)
        setAnswer('')
        try {
            const resp = await fetch('/api/ai-analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hosts, target, question })
            })
            const data = await resp.json()
            setAnswer(data.answer || data.error || 'No response.')
        } catch (e) {
            setAnswer(`Error: ${e.message}`)
        } finally {
            setAsking(false)
        }
    }

    if (!hosts.length) {
        return (
            <div className="empty-state">
                <Sparkles size={32} style={{ opacity: 0.4, color: 'var(--blue)' }} />
                <span>Run a scan first, then click <strong>AI Analyze</strong></span>
            </div>
        )
    }

    if (aiLoading) {
        return (
            <div className="empty-state" style={{ gap: 12 }}>
                <div style={{ color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Gemini AI is analyzing your scan…</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Evaluating {hosts.length} host{hosts.length !== 1 ? 's' : ''} for risks and vulnerabilities
                </div>
            </div>
        )
    }

    if (!aiData) {
        return (
            <div className="empty-state">
                <Sparkles size={32} style={{ color: 'var(--blue)', opacity: 0.6 }} />
                <span>Click <strong style={{ color: 'var(--blue)' }}>AI Analyze</strong> in the toolbar to generate security insights</span>
                <button className="btn btn-ai" onClick={onAiAnalyze} style={{ marginTop: 8 }}>
                    <Sparkles size={13} /> Analyze {hosts.length} Host{hosts.length !== 1 ? 's' : ''}
                </button>
            </div>
        )
    }

    if (aiData.error) {
        return (
            <div className="ai-pane">
                <div className="ai-summary-card" style={{ borderColor: 'var(--red)', background: 'var(--red-faint)' }}>
                    <div className="ai-summary-header">
                        <AlertCircle size={16} color="var(--red)" />
                        <span style={{ color: 'var(--red)', fontWeight: 600 }}>AI Analysis Error</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{aiData.error}</div>
                    <button className="btn btn-ghost" onClick={onAiAnalyze} style={{ marginTop: 10 }}>Retry</button>
                </div>
            </div>
        )
    }

    return (
        <div className="ai-pane">
            {/* Summary */}
            {aiData.summary && (
                <div className="ai-summary-card">
                    <div className="ai-summary-header">
                        <Sparkles size={15} color="var(--blue)" />
                        <span style={{ fontWeight: 700, fontSize: 13 }}>Executive Summary</span>
                        {aiData.overallRisk && (
                            <span className={`host-badge ${aiData.overallRisk === 'Critical' ? 'badge-critical'
                                    : aiData.overallRisk === 'High' ? 'badge-high'
                                        : aiData.overallRisk === 'Medium' ? 'badge-medium'
                                            : 'badge-low'
                                }`} style={{ marginLeft: 'auto' }}>
                                {aiData.overallRisk} Risk
                            </span>
                        )}
                    </div>
                    <div className="ai-summary-text">{aiData.summary}</div>
                </div>
            )}

            {/* Per-host findings */}
            {(aiData.hosts || []).map((h, i) => (
                <div key={i} className="ai-host-row">
                    <div className="ai-host-header">
                        {h.riskLevel === 'Critical' ? <ShieldOff size={15} color="var(--red)" />
                            : h.riskLevel === 'High' ? <ShieldAlert size={15} color="var(--orange)" />
                                : <ShieldCheck size={15} color="var(--green)" />}
                        <span className="ai-host-ip">{h.ip}</span>
                        <span className={`host-badge ${h.riskLevel === 'Critical' ? 'badge-critical'
                                : h.riskLevel === 'High' ? 'badge-high'
                                    : h.riskLevel === 'Medium' ? 'badge-medium'
                                        : 'badge-low'
                            }`}>{h.riskLevel}</span>
                    </div>

                    <RiskGauge score={h.riskScore || 0} level={h.riskLevel || 'Low'} />

                    {h.findings?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Findings</div>
                            <ul className="ai-list">
                                {h.findings.map((f, j) => <li key={j}>{f}</li>)}
                            </ul>
                        </div>
                    )}

                    {h.recommendations?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--green)', marginBottom: 4 }}>Remediation</div>
                            <ul className="ai-list">
                                {h.recommendations.map((r, j) => (
                                    <li key={j} style={{ color: 'var(--green)' }}>{r}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ))}

            {/* Q&A Chat */}
            <div className="ai-chat-box">
                <div className="ai-chat-label">
                    <Sparkles size={11} color="var(--blue)" />
                    Ask AI about this scan
                </div>
                <div className="ai-chat-row">
                    <input
                        className="ai-chat-input"
                        placeholder="e.g. Is port 22 a risk? What services should I close?"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !asking && askQuestion()}
                    />
                    <button className="btn btn-ai" onClick={askQuestion} disabled={asking || !question.trim()}>
                        {asking ? <span className="spinner" /> : <Sparkles size={12} />}
                        Ask
                    </button>
                </div>
                {answer && <div className="ai-answer">{answer}</div>}
            </div>
        </div>
    )
}
