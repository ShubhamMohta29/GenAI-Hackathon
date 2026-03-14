import { useEffect, useState, useRef, useCallback } from "react"
import ForceGraph2D from "react-force-graph-2d"

const API = "http://localhost:8000"
const WS = "ws://localhost:8000/ws/live"

export default function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [alerts, setAlerts] = useState([])
  const [feed, setFeed] = useState([])
  const [stats, setStats] = useState({ total: 0, flagged: 0, highRisk: 0 })
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedTx, setSelectedTx] = useState(null)
  const [nodeRiskFilter, setNodeRiskFilter] = useState("high")
  const [highlightNodes, setHighlightNodes] = useState(new Set())
  const [activePanel, setActivePanel] = useState(null) // "flagged" | "highRisk" | null
  const wsRef = useRef(null)
  const graphRef = useRef(null)
  const nodesRef = useRef([])

  useEffect(() => {
    fetch(`${API}/graph`)
      .then(r => r.json())
      .then(d => {
        const nodes = d.nodes.map(n => ({ ...n, id: n.id }))
        const links = d.edges.map(e => ({
          source: e.src,
          target: e.dst,
          amount: e.amount,
          is_fraud: e.is_fraud
        }))
        nodesRef.current = nodes
        setGraphData({ nodes, links })
        setStats({
          total: nodes.length,
          flagged: nodes.filter(n => n.is_fraud).length,
          highRisk: nodes.filter(n => n.risk_score > 0.7).length,
        })
      })

    fetch(`${API}/alerts`)
      .then(r => r.json())
      .then(setAlerts)

    wsRef.current = new WebSocket(WS)
    wsRef.current.onmessage = (e) => {
      const ev = JSON.parse(e.data)
      setFeed(prev => [ev, ...prev].slice(0, 30))
    }

    return () => wsRef.current?.close()
  }, [])
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node)
    setActivePanel(null)
    const relatedLinks = graphData.links.filter(
      l => (l.source.id ?? l.source) === node.id || (l.target.id ?? l.target) === node.id
    )
    const relatedNodeIds = new Set([node.id])
    relatedLinks.forEach(l => {
      relatedNodeIds.add(l.source.id ?? l.source)
      relatedNodeIds.add(l.target.id ?? l.target)
    })
    setHighlightNodes(relatedNodeIds)
    if (graphRef.current && node.x !== undefined) {
      graphRef.current.centerAt(node.x, node.y, 800)
      graphRef.current.zoom(6, 800)
    }
  }, [graphData.links])

  const zoomToNode = useCallback((nodeId) => {
    setHighlightNodes(new Set([nodeId]))
    if (graphRef.current) {
      const node = nodesRef.current.find(n => n.id === nodeId)
      if (node && node.x !== undefined) {
        graphRef.current.centerAt(node.x, node.y, 800)
        graphRef.current.zoom(6, 800)
      }
    }
  }, [])

  const handleTxClick = useCallback((ev) => {
    setSelectedTx(ev)
    setActivePanel(null)
    const nodes = new Set([ev.src, ev.dst])
    setHighlightNodes(nodes)
    if (graphRef.current) {
      const node = nodesRef.current.find(n => n.id === ev.dst)
      if (node && node.x !== undefined) {
        graphRef.current.centerAt(node.x, node.y, 800)
        graphRef.current.zoom(6, 800)
      }
    }
  }, [])

  const handleAlertClick = useCallback((accountId) => {
    setSelectedTx(null)
    setActivePanel(null)
    zoomToNode(accountId)
  }, [zoomToNode])

  const handleStatClick = (type) => {
    // Toggle off if already active
    if (activePanel === type) {
      setActivePanel(null)
      setHighlightNodes(new Set())
      if (graphRef.current) graphRef.current.zoomToFit(600, 40)
      return
    }

    setActivePanel(type)
    setSelectedTx(null)

    // Highlight ALL matching nodes in the graph
    const matchingIds = type === "flagged"
      ? nodesRef.current.filter(n => n.is_fraud).map(n => n.id)
      : nodesRef.current.filter(n => n.risk_score > 0.7).map(n => n.id)

    setHighlightNodes(new Set(matchingIds))
    if (graphRef.current) graphRef.current.zoomToFit(600, 40)
  }

  const handleClose = () => {
    setSelectedTx(null)
    setActivePanel(null)
    setHighlightNodes(new Set())
    if (graphRef.current) graphRef.current.zoomToFit(600, 40)
  }

  // Filtered node lists for the panels
  const flaggedNodes = nodesRef.current.filter(n => n.is_fraud).sort((a, b) => b.risk_score - a.risk_score)
  const highRiskNodes = nodesRef.current.filter(n => n.risk_score > 0.7).sort((a, b) => b.risk_score - a.risk_score)
  const panelNodes = activePanel === "flagged" ? flaggedNodes : activePanel === "highRisk" ? highRiskNodes : []
  const panelTitle = activePanel === "flagged" ? "⚠ FLAGGED ACCOUNTS" : "🔴 HIGH RISK ACCOUNTS"
  const panelColor = activePanel === "flagged" ? "#f97316" : "#ef4444"

  const nodeColor = (node) => {
    if (highlightNodes.size > 0) {
      if (highlightNodes.has(node.id)) {
        // In panel mode: use the category color
        if (activePanel === "flagged") return "#f97316"
        if (activePanel === "highRisk") return "#ef4444"
        // In tx mode: src = blue, dst = pink
        if (selectedTx) return node.id === selectedTx.src ? "#38bdf8" : "#f43f5e"
        return "#f43f5e"
      }
      // Dim everything else
      return "#1e293b88"
    }
    if (node.risk_score > 0.8) return "#ef4444"
    if (node.risk_score > 0.5) return "#f97316"
    if (node.risk_score > 0.3) return "#eab308"
    return "#22c55e"
  }

  const nodeVal = (node) => {
    if (highlightNodes.has(node.id)) return activePanel ? 8 : 12
    return highlightNodes.size > 0 ? 2 : 4
  }

  const linkColor = (l) => {
    if (highlightNodes.size > 0) {
      const srcId = typeof l.source === "object" ? l.source.id : l.source
      const dstId = typeof l.target === "object" ? l.target.id : l.target
      if (!activePanel && highlightNodes.has(srcId) && highlightNodes.has(dstId)) return "#38bdf8"
      return "#1e293b22"
    }
    return l.is_fraud ? "#ef444466" : "#33415566"
  }

  const linkWidth = (l) => {
    const srcId = typeof l.source === "object" ? l.source.id : l.source
    const dstId = typeof l.target === "object" ? l.target.id : l.target
    if (!activePanel && highlightNodes.has(srcId) && highlightNodes.has(dstId)) return 3
    return l.is_fraud ? 2 : 0.5
  }

  return (
    <div style={{
      display: "flex", height: "100vh", width: "100vw",
      background: "#0f172a", color: "#f1f5f9",
      fontFamily: "monospace", overflow: "hidden"
    }}>
      {/* LEFT — graph canvas */}
      <div style={{ flex: 1, position: "relative", height: "100vh", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10 }}>
          <h1 style={{ margin: 0, fontSize: 18, color: "#38bdf8", letterSpacing: 2 }}>
            ◈ FRAUD GRAPH MONITOR
          </h1>
          <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
            <span>🟢 Low</span><span>🟡 Medium</span><span>🟠 High</span><span>🔴 Fraud</span>
          </div>
        </div>

        {/* Active filter badge */}
        {activePanel && (
          <div style={{
            position: "absolute", top: 16, right: 16, zIndex: 10,
            background: `${panelColor}22`, border: `1px solid ${panelColor}66`,
            borderRadius: 6, padding: "4px 12px", fontSize: 11, color: panelColor
          }}>
            {highlightNodes.size} {activePanel === "flagged" ? "flagged" : "high risk"} accounts highlighted
          </div>
        )}

        {/* Filtered node list panel */}
        {activePanel && (
          <div style={{
            position: "absolute", top: 70, left: 16, zIndex: 20,
            background: "#0f172aee", border: `1px solid ${panelColor}44`,
            borderRadius: 10, padding: "14px 16px", width: 300, maxHeight: 420,
            backdropFilter: "blur(8px)", boxShadow: `0 0 24px ${panelColor}22`,
            display: "flex", flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ color: panelColor, fontSize: 11, letterSpacing: 1 }}>{panelTitle}</span>
              <button onClick={handleClose} style={{
                background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16
              }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {panelNodes.slice(0, 50).map(node => (
                <div
                  key={node.id}
                  onClick={() => zoomToNode(node.id)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 8px", marginBottom: 4, borderRadius: 6,
                    background: "#1e293b", border: "1px solid transparent",
                    cursor: "pointer", fontSize: 11, transition: "border 0.15s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.border = `1px solid ${panelColor}66`}
                  onMouseLeave={e => e.currentTarget.style.border = "1px solid transparent"}
                >
                  <span style={{ color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                    #{node.id}
                  </span>
                  <span style={{ color: node.risk_score > 0.85 ? "#ef4444" : "#f97316", fontWeight: 700, flexShrink: 0 }}>
                    {(node.risk_score * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedNode && (
          <div style={{
            position: "absolute", top: 70, left: 16, zIndex: 20,
            background: "#0f172aee", border: "1px solid #eab308",
            borderRadius: 10, padding: "14px 16px", width: 300, maxHeight: 420,
            backdropFilter: "blur(8px)", boxShadow: "0 0 24px #eab30822",
            display: "flex", flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ color: "#eab308", fontSize: 11, letterSpacing: 1 }}>◈ ACCOUNT #{selectedNode.id}</div>
                <div style={{ fontSize: 10, marginTop: 2, color: selectedNode.risk_score > 0.7 ? "#ef4444" : "#eab308" }}>
                  Risk: {(selectedNode.risk_score * 100).toFixed(0)}%
                </div>
              </div>
              <button onClick={() => { setSelectedNode(null); setHighlightNodes(new Set()); graphRef.current?.zoomToFit(600, 40) }}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
              {[
                { label: "🔴 High",   key: "high",   color: "#ef4444" },
                { label: "🟡 Medium", key: "medium", color: "#eab308" },
              ].map(f => (
                <button key={f.key} onClick={() => setNodeRiskFilter(f.key)} style={{
                  flex: 1, padding: "5px 0", fontSize: 10, cursor: "pointer",
                  borderRadius: 4, fontWeight: 600,
                  background: nodeRiskFilter === f.key ? `${f.color}33` : "#1e293b",
                  border: `1px solid ${nodeRiskFilter === f.key ? f.color : "#334155"}`,
                  color: nodeRiskFilter === f.key ? f.color : "#64748b",
                  transition: "all 0.15s"
                }}>{f.label}</button>
              ))}
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {(() => {
                const list = graphData.links
                  .filter(l =>
                    (l.source.id ?? l.source) === selectedNode.id ||
                    (l.target.id ?? l.target) === selectedNode.id
                  )
                  .map(l => {
                    const isOut = (l.source.id ?? l.source) === selectedNode.id
                    const otherId = isOut ? (l.target.id ?? l.target) : (l.source.id ?? l.source)
                    const other = graphData.nodes.find(n => n.id === otherId) ?? {}
                    return { id: otherId, direction: isOut ? "OUT TO" : "IN FROM", amount: l.amount, is_fraud: l.is_fraud, risk_score: other.risk_score ?? 0 }
                  })
                  .filter(a => nodeRiskFilter === "high" ? a.risk_score > 0.7 : a.risk_score > 0.3 && a.risk_score <= 0.7)

                if (list.length === 0)
                  return <div style={{ color: "#475569", fontSize: 11, textAlign: "center", marginTop: 16 }}>No accounts in this risk range</div>

                return list.map((a, idx) => {
                  const rc = a.risk_score > 0.7 ? "#ef4444" : "#eab308"
                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 8px", background: "#1e293b55", borderRadius: 4, marginBottom: 4 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ color: a.direction === "OUT TO" ? "#38bdf8" : "#f43f5e", fontSize: 10, fontWeight: "bold" }}>{a.direction}</span>
                        <span style={{ color: "#cbd5e1", fontSize: 11 }}>#{a.id}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <span style={{ color: "#f1f5f9", fontSize: 11 }}>${a.amount?.toLocaleString()}</span>
                        <span style={{ color: rc, fontSize: 9, fontWeight: "bold" }}>{(a.risk_score * 100).toFixed(0)}% risk</span>
                        {a.is_fraud && <span style={{ color: "#ef4444", fontSize: 9 }}>⚠ FRAUD</span>}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        )}

        {/* Transaction detail overlay */}
        {selectedTx && (
          <div style={{
            position: "absolute", bottom: 24, left: 24, zIndex: 20,
            background: "#0f172aee", border: "1px solid #38bdf8",
            borderRadius: 10, padding: "16px 20px", minWidth: 280,
            backdropFilter: "blur(8px)", boxShadow: "0 0 24px #38bdf822"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ color: "#38bdf8", fontSize: 11, letterSpacing: 1 }}>◈ TRANSACTION DETAIL</span>
              <button onClick={handleClose} style={{
                background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16
              }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 12 }}>
              <div>
                <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>FROM</div>
                <div style={{ color: "#38bdf8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{selectedTx.src}</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>TO</div>
                <div style={{ color: "#f43f5e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{selectedTx.dst}</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>AMOUNT</div>
                <div style={{ color: "#f1f5f9" }}>${selectedTx.amount?.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>RISK SCORE</div>
                <div style={{ color: selectedTx.risk_score > 0.7 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                  {(selectedTx.risk_score * 100).toFixed(0)}%
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>STATUS</div>
                <div style={{
                  display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                  background: selectedTx.flagged ? "#7f1d1d55" : "#14532d55",
                  color: selectedTx.flagged ? "#fca5a5" : "#86efac",
                  border: `1px solid ${selectedTx.flagged ? "#ef444444" : "#22c55e44"}`
                }}>
                  onNodeClick={handleNodeClick}
                  linkDirectionalArrowLength={l => {
                    const srcId = typeof l.source === "object" ? l.source.id : l.source
                    const dstId = typeof l.target === "object" ? l.target.id : l.target
                    if (highlightNodes.size > 0 && highlightNodes.has(srcId) && highlightNodes.has(dstId)) return 4
                    return 2
                  }}
                  linkDirectionalArrowRelPos={1}
                  {selectedTx.flagged ? "⚠ FLAGGED FOR FRAUD" : "✓ CLEAR"}
                </div>
              </div>
            </div>
          </div>
        )}

        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeColor={nodeColor}
          nodeVal={nodeVal}
          nodeRelSize={5}
          linkColor={linkColor}
          linkWidth={linkWidth}
          backgroundColor="#0f172a"
          nodeLabel={n => `${n.id} | risk: ${(n.risk_score * 100).toFixed(0)}%`}
          onNodeClick={handleNodeClick}
          linkDirectionalArrowLength={l => {
            const srcId = typeof l.source === "object" ? l.source.id : l.source
            const dstId = typeof l.target === "object" ? l.target.id : l.target
            if (highlightNodes.size > 0 && highlightNodes.has(srcId) && highlightNodes.has(dstId)) return 4
            return 2
          }}
          linkDirectionalArrowRelPos={1}
        />
      </div>

      {/* RIGHT — sidebar */}
      <div style={{
        width: 320, height: "100vh",
        borderLeft: "1px solid #1e293b",
        display: "flex", flexDirection: "column",
        overflow: "hidden", flexShrink: 0
      }}>
        {/* Stats row — clickable cards */}
        <div style={{ padding: 16, borderBottom: "1px solid #1e293b" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              ["Accounts", stats.total, "#38bdf8", null],
              ["Flagged", stats.flagged, "#f97316", "flagged"],
              ["High Risk", stats.highRisk, "#ef4444", "highRisk"],
            ].map(([label, val, color, panelKey]) => (
              <div
                key={label}
                onClick={() => panelKey && handleStatClick(panelKey)}
                style={{
                  background: activePanel === panelKey ? `${color}22` : "#1e293b",
                  borderRadius: 8, padding: "8px 6px", textAlign: "center",
                  cursor: panelKey ? "pointer" : "default",
                  border: activePanel === panelKey ? `1px solid ${color}66` : "1px solid transparent",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => { if (panelKey) e.currentTarget.style.border = `1px solid ${color}44` }}
                onMouseLeave={e => { if (panelKey && activePanel !== panelKey) e.currentTarget.style.border = "1px solid transparent" }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{label}</div>
                {panelKey && <div style={{ fontSize: 9, color: color, marginTop: 3, opacity: 0.7 }}>
                  {activePanel === panelKey ? "click to clear" : "click to view"}
                </div>}
              </div>
            ))}
          </div>
        </div>

        {/* Top alerts — clickable */}
        <div style={{ padding: 16, borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, marginBottom: 8 }}>
            TOP FRAUD ALERTS <span style={{ color: "#475569" }}>(click to locate)</span>
          </div>
          {alerts.slice(0, 6).map(a => (
            <div
              key={a.account_id}
              onClick={() => handleAlertClick(a.account_id)}
              style={{
                display: "flex", justifyContent: "space-between",
                padding: "6px 8px", marginBottom: 3,
                borderRadius: 6, border: "1px solid transparent",
                cursor: "pointer", fontSize: 11, transition: "all 0.15s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "#1e293b"
                e.currentTarget.style.border = "1px solid #ef444433"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.border = "1px solid transparent"
              }}
            >
              <span style={{ color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                #{a.account_id}
              </span>
              <span style={{ color: a.risk_score > 0.85 ? "#ef4444" : "#f97316", fontWeight: 700, flexShrink: 0 }}>
                {(a.risk_score * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>

        {/* Live feed */}
        <div style={{ padding: 16, overflowY: "auto", flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, marginBottom: 8 }}>
            ⚡ LIVE TRANSACTIONS <span style={{ color: "#475569" }}>(click to inspect)</span>
          </div>
          {feed.map((ev, i) => (
            <div
              key={i}
              onClick={() => handleTxClick(ev)}
              style={{
                padding: "6px 8px", marginBottom: 4, borderRadius: 6,
                background: selectedTx === ev ? "#1e3a5f" : ev.flagged ? "#7f1d1d33" : "#1e293b",
                border: selectedTx === ev ? "1px solid #38bdf8" : ev.flagged ? "1px solid #ef444444" : "1px solid transparent",
                fontSize: 11, cursor: "pointer", transition: "background 0.15s, border 0.15s"
              }}
            >
              <div style={{ color: ev.flagged ? "#fca5a5" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ev.src} → {ev.dst}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ color: "#64748b" }}>${ev.amount?.toLocaleString()}</span>
                <span style={{ color: ev.flagged ? "#ef4444" : "#22c55e" }}>
                  {ev.flagged ? "⚠ FLAGGED" : "✓ ok"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}