import { useEffect, useState, useRef, useCallback } from "react"
import ForceGraph2D from "react-force-graph-2d"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
const API = API_BASE
const WS = API_BASE.replace("http", "ws") + "/ws/live"

// ── TD Brand Colors ──────────────────────────────────────
const C = {
  bg: "#0a0f1a",
  panel: "#111827",
  card: "#1e293b",
  border: "#1e293b",
  text: "#e2e8f0",
  muted: "#94a3b8",
  dim: "#475569",
  green: "#00B140",
  greenDim: "#00B14033",
  red: "#ef4444",
  amber: "#f59e0b",
  blue: "#38bdf8",
  pink: "#f43f5e",
  mint: "#10b981",
}

export default function App() {
  // ── State ──────────────────────────────────────────────
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [alerts, setAlerts] = useState([])
  const [feed, setFeed] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [highlightNodes, setHighlightNodes] = useState(new Set())

  // AI features
  const [clusters, setClusters] = useState([])
  const [accountProfile, setAccountProfile] = useState(null)
  const [clusterProfile, setClusterProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [graphLoading, setGraphLoading] = useState(false)
  const [rightTab, setRightTab] = useState("alerts")

  const wsRef = useRef(null)
  const graphRef = useRef(null)

  // ── Initial Data Fetch ─────────────────────────────────
  useEffect(() => {
    const headers = { "ngrok-skip-browser-warning": "true" }
    fetch(`${API}/alerts`, { headers }).then(r => r.json()).then(setAlerts)
    fetch(`${API}/rings`, { headers }).then(r => r.json()).then(d => setClusters(d.rings || []))

    wsRef.current = new WebSocket(WS)
    wsRef.current.onmessage = (e) => {
      const ev = JSON.parse(e.data)
      setFeed(prev => [ev, ...prev].slice(0, 40))
    }
    return () => wsRef.current?.close()
  }, [])

  // ── Account Investigation ──────────────────────────────
  const investigateAccount = useCallback(async (accountId) => {
    setSelectedAccount(accountId)
    setClusterProfile(null)
    setRightTab("profile")

    // Fetch graph neighborhood + AI profile in parallel
    setGraphLoading(true)
    setProfileLoading(true)

    const headers = { "ngrok-skip-browser-warning": "true" }
    const [graphRes, profileRes] = await Promise.allSettled([
      fetch(`${API}/graph/${accountId}`, { headers }).then(r => r.json()),
      fetch(`${API}/profile/${accountId}`, { headers }).then(r => r.json()),
    ])

    if (graphRes.status === "fulfilled") {
      const d = graphRes.value
      const nodes = d.nodes.map(n => ({ ...n, id: n.id }))
      const links = d.edges.map(e => ({
        source: e.src, target: e.dst,
        amount: e.amount, is_fraud: e.is_fraud,
        timestamp: e.timestamp, tx_type: e.tx_type
      }))
      setGraphData({ nodes, links })
      setHighlightNodes(new Set([accountId]))
      setTimeout(() => {
        if (graphRef.current) graphRef.current.zoomToFit(600, 60)
      }, 500)
    }
    setGraphLoading(false)

    if (profileRes.status === "fulfilled") {
      setAccountProfile(profileRes.value)
    } else {
      setAccountProfile({ error: "Failed to load profile." })
    }
    setProfileLoading(false)
  }, [])

  // ── Cluster Investigation ──────────────────────────────
  const investigateCluster = useCallback(async (cluster) => {
    setSelectedAccount(null)
    setAccountProfile(null)
    setRightTab("profile")
    setProfileLoading(true)

    // Build a combined graph from all accounts in the cluster
    const ids = cluster.accounts.map(a => a.account_id)
    setHighlightNodes(new Set(ids))

    // Fetch cluster profile
    const headers = { "ngrok-skip-browser-warning": "true" }
    try {
      const res = await fetch(`${API}/profile/ring/${cluster.id}`, { headers })
      const data = await res.json()
      setClusterProfile(data)
    } catch { setClusterProfile({ error: "Failed to load cluster profile." }) }
    setProfileLoading(false)

    // Fetch graph for the first account in the cluster to show something
    setGraphLoading(true)
    try {
      const res = await fetch(`${API}/graph/${ids[0]}`, { headers })
      const d = await res.json()
      const nodes = d.nodes.map(n => ({ ...n, id: n.id }))
      const links = d.edges.map(e => ({
        source: e.src, target: e.dst,
        amount: e.amount, is_fraud: e.is_fraud,
        timestamp: e.timestamp, tx_type: e.tx_type
      }))
      setGraphData({ nodes, links })
      setTimeout(() => {
        if (graphRef.current) graphRef.current.zoomToFit(600, 60)
      }, 500)
    } catch { }
    setGraphLoading(false)
  }, [])

  // ── Graph Node Click ───────────────────────────────────
  const handleNodeClick = useCallback((node) => {
    investigateAccount(node.id)
  }, [investigateAccount])

  // ── Graph Rendering ────────────────────────────────────
  const nodeColor = (node) => {
    if (highlightNodes.has(node.id)) return C.text
    if (node.risk_score > 0.7) return C.red
    if (node.risk_score > 0.4) return C.amber
    return C.mint
  }

  const nodeVal = (node) => {
    if (highlightNodes.has(node.id)) return 16
    if (node.risk_score > 0.7) return 8
    return 5
  }

  const linkColor = (l) => {
    return l.is_fraud ? C.red + "88" : C.text + "44"
  }

  const linkWidth = (l) => l.is_fraud ? 2.5 : 1

  // ── Custom Node Renderer (professional risk % display) ─
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const risk = node.risk_score ?? 0
    const pct = (risk * 100).toFixed(0)
    const isHighlighted = highlightNodes.has(node.id)
    const radius = isHighlighted ? 9 : (risk > 0.7 ? 7 : 5)

    // Node color
    let color = C.mint
    if (isHighlighted) color = C.text
    else if (risk > 0.7) color = C.red
    else if (risk > 0.4) color = C.amber

    // Outer glow for high-risk / highlighted nodes
    if (risk > 0.7 || isHighlighted) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI)
      ctx.fillStyle = color + "20"
      ctx.fill()
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius + 1.5, 0, 2 * Math.PI)
      ctx.strokeStyle = color + "55"
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Main circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()

    // Inner highlight (subtle shine)
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius * 0.55, 0, 2 * Math.PI)
    ctx.fillStyle = "rgba(255,255,255,0.12)"
    ctx.fill()

    // Risk % label below the node
    const labelSize = Math.max(9 / globalScale, 2.2)
    ctx.font = `600 ${labelSize}px "Inter", "Segoe UI", system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "top"

    // Badge background
    const labelY = node.y + radius + 2
    const textWidth = ctx.measureText(`${pct}%`).width
    const padX = labelSize * 0.4
    const padY = labelSize * 0.15
    ctx.fillStyle = C.panel + "dd"
    ctx.beginPath()
    const bRadius = labelSize * 0.3
    const bx = node.x - textWidth / 2 - padX
    const by = labelY - padY
    const bw = textWidth + padX * 2
    const bh = labelSize + padY * 2
    ctx.roundRect(bx, by, bw, bh, bRadius)
    ctx.fill()
    ctx.strokeStyle = color + "66"
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Text
    ctx.fillStyle = color
    ctx.fillText(`${pct}%`, node.x, labelY)
  }, [highlightNodes])

  const nodePointerAreaPaint = useCallback((node, color, ctx) => {
    const radius = (node.risk_score ?? 0) > 0.7 ? 10 : 7
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [])

  const hasGraph = graphData.nodes.length > 0

  // ── Render ─────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: C.bg, color: C.green, overflow: "hidden" }}>

      {/* ═══════ FAR LEFT: Live Transactions Panel ═══════ */}
      <div style={{
        width: 280, height: "100vh", borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
        background: C.panel
      }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13 }}>⚡</span>
          <span style={{ fontSize: 11, color: C.muted, letterSpacing: 1, fontWeight: 600 }}>LIVE TRANSACTIONS</span>
          <span style={{
            marginLeft: "auto", fontSize: 9, padding: "2px 8px", borderRadius: 10,
            background: C.green + "18", color: C.green, fontWeight: 600
          }}>LIVE</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", minHeight: 0 }}>
          {feed.map((ev, i) => (
            <div key={i} onClick={() => investigateAccount(ev.dst)}
              style={{
                padding: "8px 10px", marginBottom: 4, borderRadius: 8,
                background: ev.flagged ? C.red + "0d" : C.card,
                border: ev.flagged ? `1px solid ${C.red}22` : "1px solid transparent",
                fontSize: 11, cursor: "pointer", transition: "all 0.15s"
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="mono" style={{ color: ev.flagged ? "#fca5a5" : C.muted, fontSize: 10, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.src} → {ev.dst}
                </span>
                <span style={{ color: ev.flagged ? C.red : C.mint, fontSize: 10, fontWeight: 600 }}>
                  {ev.flagged ? "⚠" : "✓"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, color: C.dim, fontSize: 10 }}>
                <span>${ev.amount?.toLocaleString()}</span>
                <span>{ev.type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ CENTER: Graph Canvas ═══════ */}
      <div style={{ flex: 1, position: "relative", height: "100vh", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ position: "absolute", top: 20, left: 24, zIndex: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "linear-gradient(135deg, #0a7a33, #00b050)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 14, color: "white", letterSpacing: -1
          }}>TD</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.green, letterSpacing: 1 }}>Argus</h1>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>AML Investigation Dashboard</div>
          </div>
        </div>

        {/* Legend */}
        <div style={{
          position: "absolute", top: 20, right: 20, zIndex: 10,
          display: "flex", gap: 12, fontSize: 10, color: C.muted,
          background: C.panel + "cc", borderRadius: 8, padding: "6px 14px",
          border: `1px solid ${C.border}`, backdropFilter: "blur(8px)"
        }}>
          <span style={{ color: C.text }}>● Selected</span>
          <span style={{ color: C.red }}>● High Risk</span>
          <span style={{ color: C.amber }}>● Medium</span>
          <span style={{ color: C.mint }}>● Low</span>
        </div>

        {/* Graph info bar */}
        {selectedAccount && hasGraph && (
          <div style={{
            position: "absolute", bottom: 20, left: 24, zIndex: 10,
            background: C.panel + "ee", borderRadius: 10, padding: "10px 16px",
            border: `1px solid ${C.text}33`, backdropFilter: "blur(12px)",
            display: "flex", gap: 20, alignItems: "center", fontSize: 11
          }}>
            <span style={{ color: C.text, fontWeight: 600 }}>◈ INVESTIGATING</span>
            <span className="mono" style={{ color: C.text }}>{selectedAccount}</span>
            <span style={{ color: C.muted }}>{graphData.nodes.length} accounts</span>
            <span style={{ color: C.muted }}>{graphData.links.length} transactions</span>
          </div>
        )}

        {/* Empty state */}
        {!hasGraph && !graphLoading && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            textAlign: "center", zIndex: 5
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔍</div>
            <div style={{ fontSize: 14, color: C.dim, maxWidth: 280, lineHeight: 1.6 }}>
              Select an account from the <b style={{ color: C.muted }}>Alerts</b> list or a cluster from <b style={{ color: C.muted }}>Clusters</b> to investigate its transaction network.
            </div>
          </div>
        )}

        {/* Loading state */}
        {graphLoading && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            textAlign: "center", zIndex: 5
          }}>
            <div style={{ fontSize: 14, color: C.green }}>Loading network graph...</div>
          </div>
        )}

        {/* Graph */}
        {hasGraph && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={0.85}
            linkDirectionalArrowColor={linkColor}
            backgroundColor={C.bg}
            nodeLabel={n => `${n.id}\nRisk: ${(n.risk_score * 100).toFixed(0)}%`}
            onNodeClick={handleNodeClick}
            cooldownTicks={80}
          />
        )}
      </div>

      {/* ═══════ RIGHT: Sidebar ═══════ */}
      <div style={{
        width: 360, height: "100vh", borderLeft: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
        background: C.panel
      }}>

        {/* Tab Switcher */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
          {[
            ["alerts", "Alerts"],
            ["clusters", "Clusters"],
            ["profile", "AI Report"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setRightTab(key)}
              style={{
                flex: 1, padding: "12px 0", fontSize: 11, fontWeight: 600,
                letterSpacing: 0.5, cursor: "pointer",
                background: rightTab === key ? C.text + "15" : "transparent",
                color: rightTab === key ? C.text : C.muted,
                border: "none", borderBottom: rightTab === key ? `2px solid ${C.text}` : "2px solid transparent",
                transition: "all 0.2s"
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, minHeight: 0 }}>

          {/* ─── Alerts Tab ─── */}
          {rightTab === "alerts" && <>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 10, fontWeight: 600 }}>
              TOP FRAUD ALERTS <span style={{ color: C.dim }}>(click to investigate)</span>
            </div>
            {alerts.slice(0, 15).map(a => (
              <div key={a.account_id} onClick={() => investigateAccount(a.account_id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 12px", marginBottom: 4, borderRadius: 8,
                  background: selectedAccount === a.account_id ? C.text + "15" : C.card,
                  border: selectedAccount === a.account_id ? `1px solid ${C.text}55` : "1px solid transparent",
                  cursor: "pointer", fontSize: 12, transition: "all 0.15s"
                }}
                onMouseEnter={e => { if (selectedAccount !== a.account_id) e.currentTarget.style.borderColor = C.red + "44" }}
                onMouseLeave={e => { if (selectedAccount !== a.account_id) e.currentTarget.style.borderColor = "transparent" }}
              >
                <span className="mono" style={{ color: C.muted, fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.account_id}
                </span>
                <span style={{ color: a.risk_score > 0.85 ? C.red : C.amber, fontWeight: 700 }}>
                  {(a.risk_score * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </>}

          {/* ─── Clusters Tab ─── */}
          {rightTab === "clusters" && <>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 10, fontWeight: 600 }}>
              SUSPICIOUS CLUSTERS <span style={{ color: C.dim }}>({clusters.length} detected)</span>
            </div>
            {clusters.map((c, i) => (
              <div key={c.id || i} onClick={() => investigateCluster(c)}
                style={{
                  padding: "10px 12px", marginBottom: 6, borderRadius: 10,
                  background: C.card, cursor: "pointer",
                  border: "1px solid transparent", transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.amber + "44"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.amber }}>{c.id || `R-${i + 1}`}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{c.size} accounts</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                    ${c.total_amount?.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: C.red + "15", color: "#fca5a5" }}>
                    View Report →
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                  {c.accounts.slice(0, 3).map(a => (
                    <span key={a.account_id} className="mono" style={{
                      fontSize: 9, padding: "2px 6px", borderRadius: 4,
                      background: a.risk_score > 0.7 ? C.red + "18" : C.card,
                      color: a.risk_score > 0.7 ? "#fca5a5" : C.dim,
                      border: `1px solid ${a.risk_score > 0.7 ? C.red + "33" : C.border}`
                    }}>
                      {a.account_id.slice(0, 10)}… {(a.risk_score * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </>}

          {/* ─── AI Profile Tab ─── */}
          {rightTab === "profile" && <>
            {profileLoading && (
              <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>🔍</div>
                <div style={{ fontSize: 12 }}>Generating AI report...</div>
              </div>
            )}

            {!profileLoading && accountProfile && <ProfileCard profile={accountProfile} type="account" />}
            {!profileLoading && clusterProfile && <ProfileCard profile={clusterProfile} type="cluster" />}

            {!profileLoading && !accountProfile && !clusterProfile && (
              <div style={{ textAlign: "center", padding: 40, color: C.dim }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
                <div style={{ fontSize: 12 }}>Click an account or cluster to generate an AI investigation report.</div>
              </div>
            )}
          </>}
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════
//  AI Profile Card Component
// ══════════════════════════════════════════════════════════
function ProfileCard({ profile, type }) {
  const isCluster = type === "cluster"
  const title = isCluster ? profile.ring_id : profile.account_id
  const profileText = profile.profile || ""

  // Parse SAR text into sections
  const sections = {}
  const lines = profileText.split("\n")
  let currentKey = null
  for (const line of lines) {
    const match = line.match(/^([A-Z ]+):(.*)/)
    if (match && ["TYPOLOGY", "SEVERITY", "SUMMARY", "RED FLAGS", "OBSERVATIONS", "TRANSACTION PATTERN", "STRUCTURAL PATTERN", "CONNECTED ENTITIES", "RECOMMENDED ACTION"].includes(match[1].trim())) {
      currentKey = match[1].trim()
      sections[currentKey] = match[2].trim()
    } else if (currentKey) {
      sections[currentKey] = (sections[currentKey] || "") + "\n" + line
    }
  }

  const severityColor = { "CRITICAL": C.red, "HIGH": "#f97316", "MEDIUM": C.amber, "LOW": C.mint, "REVIEW": C.blue }
  const severity = (sections["SEVERITY"] || "").trim()
  const sevColor = severityColor[severity] || C.muted

  return (
    <div>
      {/* Header */}
      <div style={{
        background: C.card, borderRadius: 12, padding: "14px 16px", marginBottom: 12,
        border: `1px solid ${sevColor}33`
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 2 }}>{isCluster ? "CLUSTER" : "ACCOUNT"}</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
          </div>
          <div style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: sevColor + "18", color: sevColor, border: `1px solid ${sevColor}44`
          }}>
            {severity || "N/A"}
          </div>
        </div>

        {!isCluster && profile.risk_score !== undefined && (
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: C.muted }}>
            <span>Risk: <b style={{ color: profile.risk_score > 0.7 ? C.red : C.mint }}>{(profile.risk_score * 100).toFixed(1)}%</b></span>
            <span>Sent: <b style={{ color: C.text }}>{profile.transactions_sent}</b></span>
            <span>Received: <b style={{ color: C.text }}>{profile.transactions_received}</b></span>
          </div>
        )}

        {!isCluster && (profile.total_sent > 0 || profile.total_received > 0) && (
          <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: C.muted }}>
            <span>Total Out: <b style={{ color: C.text }}>${profile.total_sent?.toLocaleString()}</b></span>
            <span>Total In: <b style={{ color: C.text }}>${profile.total_received?.toLocaleString()}</b></span>
          </div>
        )}

        {isCluster && (
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: C.muted }}>
            <span>Accounts: <b style={{ color: C.text }}>{profile.accounts?.length}</b></span>
            <span>Volume: <b style={{ color: C.text }}>${profile.total_amount?.toLocaleString()}</b></span>
          </div>
        )}
      </div>

      {/* Typology */}
      {sections["TYPOLOGY"] && (
        <div style={{
          display: "inline-block", padding: "4px 12px", borderRadius: 6,
          background: C.text + "15", color: C.text, fontSize: 11, fontWeight: 600,
          marginBottom: 12, border: `1px solid ${C.text}33`
        }}>
          {sections["TYPOLOGY"].trim()}
        </div>
      )}

      {/* Summary */}
      {sections["SUMMARY"] && (
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 14, fontWeight: 500 }}>
          {sections["SUMMARY"].trim()}
        </div>
      )}

      {/* Red Flags / Observations */}
      {(sections["RED FLAGS"] || sections["OBSERVATIONS"]) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.amber, fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>
            {sections["RED FLAGS"] ? "RED FLAGS" : "OBSERVATIONS"}
          </div>
          {(sections["RED FLAGS"] || sections["OBSERVATIONS"]).trim().split("\n").filter(l => l.trim().startsWith("•") || l.trim().startsWith("-")).map((line, i) => (
            <div key={i} style={{
              fontSize: 12, color: C.muted, padding: "4px 0", paddingLeft: 8,
              borderLeft: `2px solid ${C.amber}44`
            }}>
              {line.trim()}
            </div>
          ))}
        </div>
      )}

      {/* Transaction / Structural Pattern */}
      {(sections["TRANSACTION PATTERN"] || sections["STRUCTURAL PATTERN"]) && (
        <div style={{
          background: C.card, borderRadius: 8, padding: 12, marginBottom: 14,
          fontSize: 12, color: C.muted, lineHeight: 1.6,
          borderLeft: `3px solid ${C.blue}66`
        }}>
          <div style={{ fontSize: 10, color: C.blue, fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>
            {sections["TRANSACTION PATTERN"] ? "TRANSACTION PATTERN" : "STRUCTURAL PATTERN"}
          </div>
          {(sections["TRANSACTION PATTERN"] || sections["STRUCTURAL PATTERN"]).trim()}
        </div>
      )}

      {/* Connected Entities */}
      {sections["CONNECTED ENTITIES"] && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.dim, fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>CONNECTED ENTITIES</div>
          <div className="mono" style={{ fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
            {sections["CONNECTED ENTITIES"].trim()}
          </div>
        </div>
      )}

      {/* Recommended Action */}
      {sections["RECOMMENDED ACTION"] && (
        <div style={{
          background: C.red + "10", borderRadius: 8, padding: 12,
          border: `1px solid ${C.red}33`, fontSize: 12, color: "#fca5a5", lineHeight: 1.5
        }}>
          <div style={{ fontSize: 10, color: C.red, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>RECOMMENDED ACTION</div>
          {sections["RECOMMENDED ACTION"].trim()}
        </div>
      )}
    </div>
  )
}