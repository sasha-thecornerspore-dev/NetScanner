# NetScanner AI

**AI-infused network reconnaissance tool** — a modern, Zenmap-inspired interface powered by Google Gemini AI for automated security analysis.

![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Nmap](https://img.shields.io/badge/nmap-required-orange)

---

## ✨ Features

- 🔍 **Full Nmap Integration** — Run any nmap scan with built-in profiles (Quick, Intense, Vulnerability, OS Detection, etc.)
- 📡 **Live Streaming Output** — Watch nmap results appear in real-time in a terminal-style display
- 🗺️ **Network Topology Map** — Interactive canvas visualization of discovered hosts with zoom, pan, and drag
- 📊 **Ports & Services Table** — Dual-view sortable table of open ports, services, and versions
- 🤖 **AI Security Analysis** — Google Gemini analyzes scan results and provides:
  - Risk scores (0–100) per host
  - Vulnerability findings per open port
  - Remediation recommendations
  - Executive security summary
- 💬 **AI Q&A Chat** — Ask natural language questions about your scan results
- 💾 **Profile Manager** — Save and reuse custom scan configurations
- 📜 **Scan History** — Automatically stores your last 50 scans
- ⚙️ **Settings Panel** — Configure nmap path and Gemini API key
- 🎨 **Dark Cyberpunk UI** — Premium terminal aesthetic with glowing accents and animations

---

## 📸 Interface

The interface mirrors Zenmap's layout:

| Section | Description |
|---|---|
| **Toolbar** | Target input, profile selector, editable command preview, Scan/Cancel, AI Analyze |
| **Host Sidebar** | Discovered hosts with status, open port count, and AI risk badges |
| **Nmap Output** | Live-streaming terminal output |
| **Ports / Hosts** | Sortable table with port/host dual-view |
| **Topology** | Interactive network graph |
| **Host Details** | Deep-dive: IP, MAC, OS, all ports |
| **AI Analysis** | Gemini-powered security insights with risk gauges and Q&A chat |
| **Status Bar** | Scan progress, host count, elapsed time, nmap version |

---

## 🚀 Getting Started

### Prerequisites

- **[Node.js](https://nodejs.org/)** v18+
- **[Nmap](https://nmap.org/download.html)** installed and in your system PATH
- **[Google Gemini API Key](https://aistudio.google.com/apikey)** (for AI features — optional)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/sasha-thecornerspore-dev/NetScanner.git
cd NetScanner

# Install dependencies
npm install

# Start the app (backend + frontend)
npm run dev
```

Then open **http://localhost:5173** in your browser.

### First-Time Setup

1. Click the ⚙️ **Settings** icon in the toolbar
2. Verify your **Nmap Binary Path** (leave as `nmap` if it's in PATH)
3. Paste your **Gemini API Key** for AI analysis features
4. Click **Save Settings**

---

## 🔧 Usage

1. **Enter a target** — IP address, hostname, or CIDR range (e.g., `192.168.1.0/24`)
2. **Select a profile** — Quick Scan, Intense, Vulnerability, OS Detection, or Custom
3. **Click Scan** — Watch results stream live in the terminal tab
4. **Explore results** — Switch between Ports, Topology, Host Details tabs
5. **Click AI Analyze** — Get Gemini-powered security insights and risk scores
6. **Ask AI questions** — Use the chat box in the AI Analysis tab

### Built-in Scan Profiles

| Profile | Nmap Command |
|---|---|
| Quick Scan | `-T4 -F` |
| Intense Scan | `-T4 -A -v` |
| Intense + UDP | `-sS -sU -T4 -A -v` |
| Ping Scan | `-sn` |
| OS Detection | `-O` |
| Version Detection | `-sV` |
| Vulnerability Scan | `-sV --script=vuln` |

---

## 📦 Desktop App

Build a standalone Windows installer:

```bash
npm run build
npm run electron:pack
```

The installer will be in the `dist-release/` folder.

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Frontend | React 18, Vite 5 |
| Backend | Express 4, Node.js |
| Scanning | Nmap (via child_process) |
| AI | Google Gemini 2.0 Flash |
| Desktop | Electron 30 |
| Visualization | HTML5 Canvas |

---

## 📁 Project Structure

```
NetScanner/
├── server.js               # Express API (nmap, AI, profiles, history)
├── electron-main.js        # Electron desktop shell
├── index.html              # Entry HTML
├── vite.config.js          # Vite + proxy config
├── package.json            # Dependencies & scripts
└── src/
    ├── main.jsx            # React entry
    ├── App.jsx             # Main app component
    ├── index.css           # Dark cyberpunk design system
    └── components/
        ├── Toolbar.jsx         # Target + Profile + Scan controls
        ├── HostSidebar.jsx     # Discovered hosts list
        ├── OutputTab.jsx       # Live terminal output
        ├── PortsTab.jsx        # Ports/Services table
        ├── TopologyTab.jsx     # Network topology graph
        ├── HostDetailsTab.jsx  # Host deep-dive
        ├── AiAnalysisTab.jsx   # AI insights + Q&A chat
        ├── StatusBar.jsx       # Scan progress bar
        └── SettingsModal.jsx   # Config panel
```

---

## ⚠️ Important Notes

- **Nmap must be installed separately.** NetScanner is a GUI wrapper — it calls the `nmap` binary on your system.
- **Run as Administrator** for full scan capabilities (SYN scans, OS detection, etc.)
- **AI features require a Gemini API key** — get one free at [aistudio.google.com](https://aistudio.google.com/apikey)
- Scan results are stored locally in the `data/` folder

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Built with ❤️ by [Antigravity](https://github.com/sasha-thecornerspore-dev)**
