import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import ForceGraph2D from "react-force-graph-2d"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
const API = API_BASE
const WS = API_BASE.replace("http", "ws") + "/ws/live"

// TD Brand Colors
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
  // State Variables
  const [graphData, setGraphData]       = useState({ nodes: [], links: [] })
  const [alerts, setAlerts]             = useState([])
  const [feed, setFeed]                 = useState([])
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

  const clearInvestigation = useCallback(() => {
    setGraphData({ nodes: [], links: [] })
    setSelectedAccount(null)
    setHighlightNodes(new Set())
    setAccountProfile(null)
    setClusterProfile(null)
    setRightTab("alerts")
  }, [])

  const degreeMap = useMemo(() => {
    const map = new Map()
    graphData.links.forEach((l) => {
      const src = typeof l.source === "object" ? l.source.id : l.source
      const tgt = typeof l.target === "object" ? l.target.id : l.target
      map.set(src, (map.get(src) || 0) + 1)
      map.set(tgt, (map.get(tgt) || 0) + 1)
    })
    return map
  }, [graphData.links])

  // Initial Data Fetch
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

  // Account Investigation
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

  // Cluster Investigation
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

  // Graph Node Click
  const handleNodeClick = useCallback((node) => {
    investigateAccount(node.id)
  }, [investigateAccount])

  // Graph Rendering (size scales with transaction count; selected = white)
  const nodeColor = (node) => {
    if (highlightNodes.has(node.id)) return "#ffffff"
    if (node.risk_score > 0.7) return C.red
    if (node.risk_score > 0.4) return C.amber
    return C.mint
  }

  const nodeVal = (node) => {
    const degree = degreeMap.get(node.id) || 0
    const base = highlightNodes.has(node.id) ? 14 : node.risk_score > 0.7 ? 8 : 5
    const fromDegree = Math.min(degree * 0.5, 14)
    return base + fromDegree
  }

  const linkColor = (l) => {
    return l.is_fraud ? C.red + "88" : C.text + "44"
  }

  const linkWidth = (l) => l.is_fraud ? 2.5 : 1

  // ── Custom Node Renderer (radius scales with transaction count; selected = white) ─
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const risk = node.risk_score ?? 0
    const pct = (risk * 100).toFixed(0)
    const isHighlighted = highlightNodes.has(node.id)
    const degree = degreeMap.get(node.id) || 0
    const baseRadius = isHighlighted ? 9 : risk > 0.7 ? 7 : 5
    const radius = baseRadius + Math.min(degree * 0.4, 12)

    // Node color
    let color = C.mint
    if (isHighlighted) color = "#ffffff"
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
  }, [highlightNodes, degreeMap])

  const nodePointerAreaPaint = useCallback((node, color, ctx) => {
    const degree = degreeMap.get(node.id) || 0
    const base = (node.risk_score ?? 0) > 0.7 ? 10 : 7
    const r = base + Math.min(degree * 0.4, 12) + 3
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [degreeMap])

  const hasGraph = graphData.nodes.length > 0
  const selectedNodeRisk = selectedAccount
    ? (accountProfile?.risk_score ?? graphData.nodes.find((n) => n.id === selectedAccount)?.risk_score ?? 0)
    : 0
  const showSarButton = selectedAccount && selectedNodeRisk > 0.4

  // Render (outer layout: B&W dreamy; graph: colors unchanged)
  return (
    <div className="app">
      <aside className="panel panel-left">
        <div className="panel-header">
          <span>Live transactions</span>
          <span className="live-pill">LIVE</span>
        </div>
        <div className="panel-body">
          {feed.map((ev, i) => (
            <div
              key={i}
              onClick={() => investigateAccount(ev.dst)}
              className={`card card-clickable ${ev.flagged ? "card-flagged" : ""}`}
            >
              <div className="row">
                <span className="mono" style={{ fontSize: 11, color: ev.flagged ? C.red : "var(--layout-text-secondary)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.src} → {ev.dst}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: ev.flagged ? C.red : C.mint }}>{ev.flagged ? "⚠" : "✓"}</span>
              </div>
              <div className="row-meta" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>${ev.amount?.toLocaleString()}</span>
                <span>{ev.type}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main style={{ flex: 1, position: "relative", height: "100vh", overflow: "hidden" }}>
        <header className="app-header">
          <div className="app-logo" style={{ background: C.green, color: "#fff" }}>TD</div>
          <div>
            <h1 className="app-title">Argus</h1>
            <div className="app-subtitle">AML Investigation</div>
          </div>
        </header>

        <div className="legend">
          <span style={{ color: "#ffffff" }}>● Selected</span>
          <span style={{ color: C.red }}>● High risk</span>
          <span style={{ color: C.amber }}>● Medium</span>
          <span style={{ color: C.mint }}>● Low</span>
        </div>

        {hasGraph && (
          <div className="graph-info-bar">
            {selectedAccount && (
              <>
                <span style={{ fontWeight: 600, color: "var(--layout-text)" }}>Investigating</span>
                <span className="mono" style={{ color: "var(--layout-text)" }}>{selectedAccount}</span>
              </>
            )}
            <span>{graphData.nodes.length} accounts</span>
            <span>{graphData.links.length} transactions</span>
            {showSarButton && (
              <button
                type="button"
                className="graph-info-bar-sar"
                onClick={() => setRightTab("profile")}
                title="View SAR report for this account"
                aria-label="Open SAR report"
              >
                SAR report
              </button>
            )}
            <button
              type="button"
              className="graph-info-bar-close"
              onClick={clearInvestigation}
              title="Clear and return to overview"
              aria-label="Close investigation"
            >
              Close
            </button>
          </div>
        )}

        {!hasGraph && !graphLoading && (
          <div className="empty-state">
            <div className="empty-state-text">
              Select an account from <strong>Alerts</strong> or a cluster from <strong>Clusters</strong> to view the transaction network.
            </div>
          </div>
        )}

        {graphLoading && (
          <div className="loading-state">
            <div className="loading-state-text">Loading network…</div>
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
      </main>

      <aside className="panel panel-right">
        <div className="tabs">
          {[
            ["alerts", "Alerts"],
            ["clusters", "Clusters"],
            ["profile", "Report"],
          ].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setRightTab(key)} className={`tab ${rightTab === key ? "active" : ""}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="panel-body">
          {rightTab === "alerts" && (
            <>
              <div className="section-label">
                Alerts <span className="section-label-muted">(click to investigate)</span>
              </div>
              {alerts.slice(0, 15).map((a) => (
                <div
                  key={a.account_id}
                  onClick={() => investigateAccount(a.account_id)}
                  className={`card card-clickable ${selectedAccount === a.account_id ? "selected" : ""}`}
                >
                  <div className="row">
                    <span className="mono" style={{ fontSize: 11, color: "var(--layout-text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.account_id}
                    </span>
                    <span style={{ fontWeight: 600, color: a.risk_score > 0.85 ? C.red : C.amber }}>{(a.risk_score * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {rightTab === "clusters" && (
            <>
              <div className="section-label">
                Clusters <span className="section-label-muted">({clusters.length})</span>
              </div>
              {clusters.map((c, i) => (
                <div key={c.id || i} onClick={() => investigateCluster(c)} className="card card-clickable">
                  <div className="row">
                    <span style={{ fontWeight: 600, fontSize: "var(--layout-s4)", color: "var(--layout-text)" }}>{c.id || `R-${i + 1}`}</span>
                    <span style={{ fontSize: 11, color: "var(--layout-text-secondary)" }}>{c.size} accounts</span>
                  </div>
                  <div className="row-meta" style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--layout-s2)" }}>
                    <span style={{ color: "var(--layout-text)" }}>${c.total_amount?.toLocaleString()}</span>
                    <span style={{ color: "var(--layout-text-tertiary)" }}>View report →</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: "var(--layout-s2)", flexWrap: "wrap" }}>
                    {c.accounts.slice(0, 3).map((a) => (
                      <span key={a.account_id} className="badge">
                        {a.account_id.slice(0, 10)}… {(a.risk_score * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {rightTab === "profile" && (
            <>
              {profileLoading && <div className="sidebar-empty">Generating report…</div>}
              {!profileLoading && accountProfile && <ProfileCard profile={accountProfile} type="account" />}
              {!profileLoading && clusterProfile && <ProfileCard profile={clusterProfile} type="cluster" />}
              {!profileLoading && !accountProfile && !clusterProfile && (
                <div className="sidebar-empty">Select an account or cluster to view the investigation report.</div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}


function ProfileCard({ profile, type }) {
  const isCluster = type === "cluster"
  const title = isCluster ? profile.ring_id : profile.account_id
  const profileText = profile.profile || ""
  const sections = {}
  let currentKey = null
  for (const line of profileText.split("\n")) {
    const match = line.match(/^([A-Z ]+):(.*)/)
    if (match && ["TYPOLOGY", "SEVERITY", "SUMMARY", "RED FLAGS", "OBSERVATIONS", "TRANSACTION PATTERN", "STRUCTURAL PATTERN", "CONNECTED ENTITIES", "RECOMMENDED ACTION"].includes(match[1].trim())) {
      currentKey = match[1].trim()
      sections[currentKey] = match[2].trim()
    } else if (currentKey) {
      sections[currentKey] = (sections[currentKey] || "") + "\n" + line
    }
  }
  const severity = (sections["SEVERITY"] || "").trim()

  return (
    <div>
      <div className="profile-card">
        <div className="profile-card-header">
          <div>
            <div className="profile-card-title">{isCluster ? "Cluster" : "Account"}</div>
            <div className="profile-card-value">{title}</div>
          </div>
          <span className="profile-badge">{severity || "—"}</span>
        </div>
        {!isCluster && profile.risk_score !== undefined && (
          <div className="profile-body-muted" style={{ display: "flex", gap: "var(--layout-s4)", marginTop: "var(--layout-s2)" }}>
            <span>Risk <strong style={{ color: profile.risk_score > 0.7 ? C.red : C.mint }}>{(profile.risk_score * 100).toFixed(1)}%</strong></span>
            <span>Sent <strong style={{ color: "var(--layout-text)" }}>{profile.transactions_sent}</strong></span>
            <span>Received <strong style={{ color: "var(--layout-text)" }}>{profile.transactions_received}</strong></span>
          </div>
        )}
        {!isCluster && (profile.total_sent > 0 || profile.total_received > 0) && (
          <div className="profile-body-muted" style={{ display: "flex", gap: "var(--layout-s4)", marginTop: "var(--layout-s1)" }}>
            <span>Out <strong style={{ color: "var(--layout-text)" }}>${profile.total_sent?.toLocaleString()}</strong></span>
            <span>In <strong style={{ color: "var(--layout-text)" }}>${profile.total_received?.toLocaleString()}</strong></span>
          </div>
        )}
        {isCluster && (
          <div className="profile-body-muted" style={{ display: "flex", gap: "var(--layout-s4)", marginTop: "var(--layout-s2)" }}>
            <span>Accounts <strong style={{ color: "var(--layout-text)" }}>{profile.accounts?.length}</strong></span>
            <span>Volume <strong style={{ color: "var(--layout-text)" }}>${profile.total_amount?.toLocaleString()}</strong></span>
          </div>
        )}
      </div>

      {sections["TYPOLOGY"] && (
        <div className="profile-badge" style={{ marginBottom: "var(--layout-s3)", background: "rgba(250,250,250,0.08)", borderColor: "rgba(250,250,250,0.15)", color: "var(--layout-text)" }}>
          {sections["TYPOLOGY"].trim()}
        </div>
      )}

      {sections["SUMMARY"] && <div className="profile-section profile-body">{sections["SUMMARY"].trim()}</div>}

      {(sections["RED FLAGS"] || sections["OBSERVATIONS"]) && (
        <div className="profile-section">
          <div className="profile-section-title">{sections["RED FLAGS"] ? "Red flags" : "Observations"}</div>
          <ul className="profile-bullets" style={{ listStyle: "none", paddingLeft: "var(--layout-s3)" }}>
            {(sections["RED FLAGS"] || sections["OBSERVATIONS"]).trim().split("\n").filter((l) => l.trim().startsWith("•") || l.trim().startsWith("-")).map((line, i) => (
              <li key={i}>{line.trim()}</li>
            ))}
          </ul>
        </div>
      )}

      {(sections["TRANSACTION PATTERN"] || sections["STRUCTURAL PATTERN"]) && (
        <div className="profile-section profile-callout">
          <div className="profile-section-title" style={{ marginBottom: "var(--layout-s2)" }}>
            {sections["TRANSACTION PATTERN"] ? "Transaction pattern" : "Structural pattern"}
          </div>
          {(sections["TRANSACTION PATTERN"] || sections["STRUCTURAL PATTERN"]).trim()}
        </div>
      )}

      {sections["CONNECTED ENTITIES"] && (
        <div className="profile-section">
          <div className="profile-section-title">Connected entities</div>
          <div className="profile-body-muted mono" style={{ fontSize: 11 }}>{sections["CONNECTED ENTITIES"].trim()}</div>
        </div>
      )}

      {sections["RECOMMENDED ACTION"] && (
        <div className="profile-section profile-action">
          <div className="profile-action-title">Recommended action</div>
          {sections["RECOMMENDED ACTION"].trim()}
        </div>
      )}
    </div>
  )
}