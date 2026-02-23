import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseStringPromise } from 'xml2js';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ── Data directories ──────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

async function ensureDataDir() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    for (const f of [PROFILES_FILE, HISTORY_FILE, SETTINGS_FILE]) {
        try { await fs.access(f); }
        catch { await fs.writeFile(f, f === SETTINGS_FILE ? JSON.stringify({ nmapPath: 'nmap', geminiKey: '' }) : JSON.stringify([])); }
    }
}
await ensureDataDir();

// ── Active scans ──────────────────────────────────────────────────────────────
const activeScans = new Map(); // scanId -> child process

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
    const s = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
    res.json(s);
});
app.post('/api/settings', async (req, res) => {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
});

// ── Detect nmap ───────────────────────────────────────────────────────────────
app.get('/api/detect-nmap', async (req, res) => {
    const settings = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
    const nmapBin = settings.nmapPath || 'nmap';
    const proc = spawn(nmapBin, ['--version']);
    let out = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => out += d);
    proc.on('close', code => {
        const match = out.match(/Nmap version ([\d.]+)/i);
        res.json({ available: code === 0, version: match ? match[1] : null, raw: out.trim() });
    });
    proc.on('error', () => res.json({ available: false, version: null, raw: 'nmap not found in PATH' }));
});

// ── Scan (SSE streaming) ──────────────────────────────────────────────────────
app.post('/api/scan', async (req, res) => {
    const { target, command, scanId } = req.body;
    if (!target || !command) return res.status(400).json({ error: 'target and command required' });

    const settings = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
    const nmapBin = settings.nmapPath || 'nmap';

    // Parse command into args (strip leading "nmap" if present)
    const rawArgs = command.trim().replace(/^nmap\s+/i, '').split(/\s+/);
    // Always add XML output to stderr-equivalent stream for parsing
    const args = [...rawArgs, '-oX', '-', target];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`);

    send('start', { target, command: `${nmapBin} ${args.join(' ')}` });

    let xmlOutput = '';
    let capturingXml = false;
    let textOutput = '';

    const proc = spawn(nmapBin, args, { shell: false });
    if (scanId) activeScans.set(scanId, proc);

    proc.stdout.on('data', chunk => {
        const str = chunk.toString();
        // Collect XML: nmap -oX - sends XML to stdout when combined with text output
        // We capture everything and separate later
        xmlOutput += str;
        // Stream lines to client
        const lines = str.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
                // Filter out XML lines for raw display
                if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<') && !trimmed.startsWith('>')) {
                    textOutput += line + '\n';
                    send('output', { line });
                } else {
                    // Still send XML-tagged lines so we can stream silently
                }
            }
        }
    });

    proc.stderr.on('data', chunk => {
        const str = chunk.toString();
        textOutput += str;
        const lines = str.split('\n');
        for (const line of lines) {
            if (line.trim()) send('output', { line });
        }
    });

    proc.on('close', async (code) => {
        if (scanId) activeScans.delete(scanId);

        send('done', { code, exitOk: code === 0 });

        // Parse XML and extract host data
        let hosts = [];
        try {
            const xmlStart = xmlOutput.indexOf('<?xml');
            if (xmlStart !== -1) {
                const xmlStr = xmlOutput.substring(xmlStart);
                const result = await parseStringPromise(xmlStr);
                hosts = parseNmapHosts(result);
            }
        } catch (e) {
            console.error('XML parse error:', e.message);
        }

        send('hosts', { hosts });

        // Save to history
        try {
            const hist = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8'));
            hist.unshift({
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                target,
                command,
                hostCount: hosts.length,
                hosts,
                rawOutput: textOutput,
            });
            await fs.writeFile(HISTORY_FILE, JSON.stringify(hist.slice(0, 50), null, 2));
        } catch (e) { console.error('History save error:', e.message); }

        res.end();
    });

    proc.on('error', (err) => {
        send('error', { message: err.message });
        res.end();
    });

    req.on('close', () => {
        if (proc && !proc.killed) proc.kill();
    });
});

// ── Stop scan ─────────────────────────────────────────────────────────────────
app.post('/api/scan/stop', (req, res) => {
    const { scanId } = req.body;
    if (scanId && activeScans.has(scanId)) {
        activeScans.get(scanId).kill('SIGTERM');
        activeScans.delete(scanId);
        res.json({ ok: true });
    } else {
        res.json({ ok: false, message: 'No active scan found' });
    }
});

// ── Ping ──────────────────────────────────────────────────────────────────────
app.post('/api/ping', async (req, res) => {
    const { host } = req.body;
    const isWin = process.platform === 'win32';
    const args = isWin ? ['-n', '4', host] : ['-c', '4', host];
    const cmd = isWin ? 'ping' : 'ping';
    const proc = spawn(cmd, args);
    let out = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => out += d);
    proc.on('close', code => res.json({ alive: code === 0, output: out }));
    proc.on('error', e => res.json({ alive: false, output: e.message }));
});

// ── Profiles ──────────────────────────────────────────────────────────────────
app.get('/api/profiles', async (req, res) => {
    const profiles = JSON.parse(await fs.readFile(PROFILES_FILE, 'utf8'));
    res.json(profiles);
});
app.post('/api/profiles', async (req, res) => {
    const profiles = JSON.parse(await fs.readFile(PROFILES_FILE, 'utf8'));
    const newProfile = { id: Date.now().toString(), ...req.body };
    profiles.push(newProfile);
    await fs.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2));
    res.json(newProfile);
});
app.delete('/api/profiles/:id', async (req, res) => {
    let profiles = JSON.parse(await fs.readFile(PROFILES_FILE, 'utf8'));
    profiles = profiles.filter(p => p.id !== req.params.id);
    await fs.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2));
    res.json({ ok: true });
});

// ── History ───────────────────────────────────────────────────────────────────
app.get('/api/history', async (req, res) => {
    const hist = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8'));
    // Return summary without full rawOutput for brevity
    res.json(hist.map(({ rawOutput, ...rest }) => rest));
});
app.get('/api/history/:id', async (req, res) => {
    const hist = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8'));
    const entry = hist.find(h => h.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
});

// ── AI Analysis ───────────────────────────────────────────────────────────────
app.post('/api/ai-analyze', async (req, res) => {
    const { hosts, target, question } = req.body;
    const settings = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
    const apiKey = settings.geminiKey;

    if (!apiKey) return res.status(400).json({ error: 'Gemini API key not configured. Go to Settings to add it.' });

    const hostsStr = JSON.stringify(hosts, null, 2);
    const prompt = question
        ? `You are a cybersecurity expert. Given these nmap scan results for target "${target}":\n${hostsStr}\n\nAnswer this question: ${question}`
        : `You are a cybersecurity expert analyzing nmap scan results. For the target "${target}", provide:
1. An executive summary of findings
2. For each host, a risk score from 0-100, list of vulnerabilities or concerns per open port, and remediation recommendations
3. Overall security posture rating (Critical/High/Medium/Low/Informational)

Scan results:
${hostsStr}

Respond in JSON format:
{
  "summary": "...",
  "overallRisk": "High|Medium|Low|Critical|Informational",
  "hosts": [
    {
      "ip": "...",
      "riskScore": 0-100,
      "riskLevel": "Critical|High|Medium|Low",
      "findings": ["..."],
      "recommendations": ["..."]
    }
  ]
}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
                })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            return res.status(500).json({ error: `Gemini API error: ${err}` });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (question) {
            return res.json({ answer: text });
        }

        // Extract JSON from response
        const jsonMatch = text.match(/```json\n?([\s\S]+?)\n?```/) || text.match(/(\{[\s\S]+\})/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                return res.json(parsed);
            } catch { }
        }
        res.json({ summary: text, overallRisk: 'Unknown', hosts: [] });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Helper: parse nmap XML hosts ──────────────────────────────────────────────
function parseNmapHosts(result) {
    const hosts = [];
    const nmaprun = result?.nmaprun;
    if (!nmaprun?.host) return hosts;

    const rawHosts = Array.isArray(nmaprun.host) ? nmaprun.host : [nmaprun.host];

    for (const h of rawHosts) {
        const status = h.status?.[0]?.$?.state || 'unknown';
        const addrList = Array.isArray(h.address) ? h.address : (h.address ? [h.address] : []);
        let ip = '', mac = '', macVendor = '';
        for (const a of addrList) {
            if (a.$?.addrtype === 'ipv4') ip = a.$?.addr || '';
            if (a.$?.addrtype === 'mac') { mac = a.$?.addr || ''; macVendor = a.$?.vendor || ''; }
        }

        const hostnames = [];
        const hnList = h.hostnames?.[0]?.hostname || [];
        for (const hn of (Array.isArray(hnList) ? hnList : [hnList])) {
            if (hn?.$?.name) hostnames.push(hn.$.name);
        }

        const ports = [];
        const portList = h.ports?.[0]?.port || [];
        for (const p of (Array.isArray(portList) ? portList : [portList])) {
            if (!p?.$) continue;
            const service = p.service?.[0]?.$;
            ports.push({
                port: parseInt(p.$.portid),
                protocol: p.$.protocol,
                state: p.state?.[0]?.$?.state || 'unknown',
                service: service?.name || '',
                product: service?.product || '',
                version: service?.version || '',
                extraInfo: service?.extrainfo || '',
            });
        }

        const os = [];
        const osMatches = h.os?.[0]?.osmatch || [];
        for (const o of (Array.isArray(osMatches) ? osMatches : [osMatches]).slice(0, 3)) {
            if (o?.$) os.push({ name: o.$.name, accuracy: o.$.accuracy });
        }

        hosts.push({ ip, mac, macVendor, status, hostnames, ports, os });
    }
    return hosts;
}

// ── AI Copilot ────────────────────────────────────────────────────────────────
// The copilot translates plain-language requests into nmap actions and executes them.
app.post('/api/copilot', async (req, res) => {
    const { message, history, scanContext } = req.body;
    const settings = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
    const apiKey = settings.geminiKey;
    const nmapBin = settings.nmapPath || 'nmap';

    if (!apiKey) return res.status(400).json({ error: 'Gemini API key not configured. Go to Settings to add it.' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);

    // Build conversation history for Gemini
    const systemPrompt = `You are an expert network security AI copilot embedded in NetScanner AI, a Zenmap-like network reconnaissance tool. You help users explore networks by translating their plain-language requests into nmap commands and executing them.

Your capabilities:
1. **run_nmap_scan** — Execute any nmap scan by specifying target and arguments
2. **analyze_results** — Provide security analysis of scan results
3. **explain_service** — Explain what a network service/port does and its security implications

Rules:
- When a user asks to scan something, ALWAYS use the run_nmap_scan function. Do NOT just describe what command to run.
- Be proactive: after showing scan results, suggest follow-up scans (e.g., "I noticed SSH on port 22 — want me to check for known vulnerabilities?")
- Keep responses concise but informative
- When explaining results, highlight security concerns first
- If the user's request is ambiguous about the target, ask for clarification
- You can run multiple scans in sequence if needed for complex requests

Current session context:
${scanContext ? `Previously scanned hosts: ${JSON.stringify(scanContext.hosts || [])}
Last target: ${scanContext.target || 'none'}
Last command: ${scanContext.command || 'none'}` : 'No previous scans in this session.'}`;

    const geminiHistory = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I\'m your network security copilot. I can run scans, analyze results, and help you explore your network. What would you like to do?' }] },
    ];

    // Add conversation history
    if (history && Array.isArray(history)) {
        for (const msg of history) {
            geminiHistory.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        }
    }

    // Add the new user message
    geminiHistory.push({ role: 'user', parts: [{ text: message }] });

    // Define function declarations for Gemini
    const tools = [{
        functionDeclarations: [
            {
                name: 'run_nmap_scan',
                description: 'Execute an nmap network scan against a target. Use this whenever the user asks to scan, probe, check, or explore a network target.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        target: {
                            type: 'STRING',
                            description: 'The target to scan (IP address, hostname, CIDR range, e.g., "192.168.1.0/24", "scanme.nmap.org", "localhost")'
                        },
                        args: {
                            type: 'STRING',
                            description: 'Nmap arguments/flags (e.g., "-T4 -F" for quick scan, "-sV" for version detection, "-sV --script=vuln" for vulnerability scan, "-O" for OS detection, "-p 80,443" for specific ports). Do NOT include the target here.'
                        },
                        explanation: {
                            type: 'STRING',
                            description: 'Brief explanation of what this scan will do, shown to the user before execution'
                        }
                    },
                    required: ['target', 'args', 'explanation']
                }
            },
            {
                name: 'explain_service',
                description: 'Explain what a network service or port does and its security implications',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        port: { type: 'INTEGER', description: 'Port number' },
                        service: { type: 'STRING', description: 'Service name' },
                        product: { type: 'STRING', description: 'Product/version info if available' }
                    },
                    required: ['port', 'service']
                }
            }
        ]
    }];

    try {
        // Call Gemini with function calling
        const geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: geminiHistory,
                    tools,
                    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
                })
            }
        );

        if (!geminiResp.ok) {
            const err = await geminiResp.text();
            send('error', { message: `Gemini API error: ${err}` });
            return res.end();
        }

        const geminiData = await geminiResp.json();
        const candidate = geminiData.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        // Check if Gemini wants to call a function
        const functionCall = parts.find(p => p.functionCall);
        const textPart = parts.find(p => p.text);

        if (functionCall) {
            const { name, args } = functionCall.functionCall;

            if (name === 'run_nmap_scan') {
                const { target, args: nmapArgs, explanation } = args;

                // Tell the user what we're doing
                send('thinking', { text: explanation });
                send('command', { command: `nmap ${nmapArgs} ${target}`, target, args: nmapArgs });

                // Actually run the nmap scan
                const scanArgs = nmapArgs.trim().split(/\s+/).concat(['-oX', '-', target]);
                const proc = spawn(nmapBin, scanArgs, { shell: false });

                let xmlOutput = '';
                let textOutput = '';

                proc.stdout.on('data', chunk => {
                    const str = chunk.toString();
                    xmlOutput += str;
                    for (const line of str.split('\n')) {
                        const trimmed = line.trim();
                        if (trimmed && !trimmed.startsWith('<?xml') && !trimmed.startsWith('<') && !trimmed.startsWith('>')) {
                            textOutput += line + '\n';
                            send('scan_output', { line });
                        }
                    }
                });

                proc.stderr.on('data', chunk => {
                    const str = chunk.toString();
                    textOutput += str;
                    for (const line of str.split('\n')) {
                        if (line.trim()) send('scan_output', { line });
                    }
                });

                proc.on('close', async (code) => {
                    send('scan_done', { code });

                    // Parse results
                    let hosts = [];
                    try {
                        const xmlStart = xmlOutput.indexOf('<?xml');
                        if (xmlStart !== -1) {
                            const result = await parseStringPromise(xmlOutput.substring(xmlStart));
                            hosts = parseNmapHosts(result);
                        }
                    } catch (e) { console.error('Copilot XML parse:', e.message); }

                    send('scan_hosts', { hosts });

                    // Now ask Gemini to interpret the results
                    const interpretHistory = [...geminiHistory, {
                        role: 'model',
                        parts: [{ functionCall: functionCall.functionCall }]
                    }, {
                        role: 'user',
                        parts: [{ functionResponse: {
                            name: 'run_nmap_scan',
                            response: {
                                scanComplete: true,
                                exitCode: code,
                                hostsFound: hosts.length,
                                hosts: hosts,
                                rawOutput: textOutput.slice(0, 3000)
                            }
                        }}]
                    }];

                    try {
                        const interpretResp = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: interpretHistory,
                                    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
                                })
                            }
                        );

                        if (interpretResp.ok) {
                            const iData = await interpretResp.json();
                            const iText = iData.candidates?.[0]?.content?.parts?.[0]?.text || 'Scan complete.';
                            send('response', { text: iText, hosts });
                        } else {
                            send('response', { text: `Scan complete. Found ${hosts.length} host(s).`, hosts });
                        }
                    } catch (e) {
                        send('response', { text: `Scan complete. Found ${hosts.length} host(s). (AI interpretation unavailable)`, hosts });
                    }

                    res.end();
                });

                proc.on('error', err => {
                    send('error', { message: `Nmap error: ${err.message}. Is nmap installed and in PATH?` });
                    res.end();
                });

                req.on('close', () => { if (proc && !proc.killed) proc.kill(); });
                return; // Don't end response — the scan process will end it

            } else if (name === 'explain_service') {
                // For explain_service, we just return the text that Gemini would have generated
                send('response', { text: textPart?.text || `Port ${args.port} (${args.service}): This is a well-known service.` });
                res.end();
                return;
            }
        }

        // No function call — just a text response
        if (textPart) {
            send('response', { text: textPart.text });
        } else {
            send('response', { text: 'I\'m not sure how to help with that. Try asking me to scan a target or analyze your network!' });
        }
        res.end();

    } catch (e) {
        send('error', { message: e.message });
        res.end();
    }
});

app.listen(PORT, () => console.log(`NetScanner API running on http://localhost:${PORT}`));
