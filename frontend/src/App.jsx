import { useEffect, useState, useRef } from "react"
import ForceGraph2D from "react-force-graph-2d"

const API = "http://localhost:8000"
const WS = "ws://localhost:8000/ws/live"

export default function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [alerts, setAlerts] = useState([])
  const [feed, setFeed] = useState([])
  const [stats, setStats] = useState({ total: 0, flagged: 0, highRisk: 0 })
  const wsRef = useRef(null)

  useEffect(() => {
    // Load graph data
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
        setGraphData({ nodes, links })
        setStats({
          total: nodes.length,
          flagged: nodes.filter(n => n.is_fraud).length,
          highRisk: nodes.filter(n => n.risk_score > 0.7).length,
        })
      })

    // Load top alerts
    fetch(`${API}/alerts`)
      .then(r => r.json())
      .then(setAlerts)

    // Live WebSocket feed
    wsRef.current = new WebSocket(WS)
    wsRef.current.onmessage = (e) => {
      const ev = JSON.parse(e.data)
      setFeed(prev => [ev, ...prev].slice(0, 30))
    }

    return () => wsRef.current?.close()
  }, [])

  const nodeColor = (node) => {
    if (node.risk_score > 0.8) return "#ef4444"
    if (node.risk_score > 0.5) return "#f97316"
    if (node.risk_score > 0.3) return "#eab308"
    return "#22c55e"
  }

  return (
    <div style={{
      display: "flex", height: "100vh",
      background: "#0f172a", color: "#f1f5f9",
      fontFamily: "monospace", overflow: "hidden"
    }}>

      {/* LEFT — graph canvas */}
      <div style={{ flex: 1, position: "relative" }}>

        {/* Header */}
        <div style={{
          position: "absolute", top: 16, left: 16, zIndex: 10
        }}>
          <h1 style={{
            margin: 0, fontSize: 18,
            color: "#38bdf8", letterSpacing: 2
          }}>
            ◈ FRAUD GRAPH MONITOR
          </h1>
          <div style={{
            display: "flex", gap: 16,
            marginTop: 6, fontSize: 11, color: "#94a3b8"
          }}>
            <span>🟢 Low</span>
            <span>🟡 Medium</span>
            <span>🟠 High</span>
            <span>🔴 Fraud</span>
          </div>
        </div>

        <ForceGraph2D
          graphData={graphData}
          nodeColor={nodeColor}
          nodeRelSize={5}
          linkColor={l => l.is_fraud ? "#ef444466" : "#33415566"}
          linkWidth={l => l.is_fraud ? 2 : 0.5}
          backgroundColor="#0f172a"
          nodeLabel={n =>
            `${n.id} | risk: ${(n.risk_score * 100).toFixed(0)}%`
          }
        />
      </div>

      {/* RIGHT — sidebar */}
      <div style={{
        width: 300,
        borderLeft: "1px solid #1e293b",
        display: "flex", flexDirection: "column",
        overflow: "hidden"
      }}>

        {/* Stats row */}
        <div style={{ padding: 16, borderBottom: "1px solid #1e293b" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8
          }}>
            {[
              ["Accounts", stats.total, "#38bdf8"],
              ["Flagged", stats.flagged, "#f97316"],
              ["High Risk", stats.highRisk, "#ef4444"],
            ].map(([label, val, color]) => (
              <div key={label} style={{
                background: "#1e293b", borderRadius: 8,
                padding: "8px 6px", textAlign: "center"
              }}>
                <div style={{
                  fontSize: 20, fontWeight: 700, color
                }}>{val}</div>
                <div style={{
                  fontSize: 10, color: "#94a3b8", marginTop: 2
                }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top alerts */}
        <div style={{
          padding: 16,
          borderBottom: "1px solid #1e293b"
        }}>
          <div style={{
            fontSize: 10, color: "#94a3b8",
            letterSpacing: 1, marginBottom: 8
          }}>
            TOP FRAUD ALERTS
          </div>
          {alerts.slice(0, 6).map(a => (
            <div key={a.account_id} style={{
              display: "flex", justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: "1px solid #1e293b22",
              fontSize: 11
            }}>
              <span style={{
                color: "#cbd5e1",
                overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", maxWidth: 160
              }}>
                #{a.account_id}
              </span>
              <span style={{
                color: a.risk_score > 0.85 ? "#ef4444" : "#f97316",
                fontWeight: 700, flexShrink: 0
              }}>
                {(a.risk_score * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>

        {/* Live feed */}
        <div style={{
          padding: 16, overflowY: "auto", flex: 1
        }}>
          <div style={{
            fontSize: 10, color: "#94a3b8",
            letterSpacing: 1, marginBottom: 8
          }}>
            ⚡ LIVE TRANSACTIONS
          </div>
          {feed.map((ev, i) => (
            <div key={i} style={{
              padding: "6px 8px", marginBottom: 4,
              borderRadius: 6,
              background: ev.flagged ? "#7f1d1d33" : "#1e293b",
              border: ev.flagged
                ? "1px solid #ef444444"
                : "1px solid transparent",
              fontSize: 11
            }}>
              <div style={{
                color: ev.flagged ? "#fca5a5" : "#94a3b8",
                overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}>
                {ev.src} → {ev.dst}
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 2
              }}>
                <span style={{ color: "#64748b" }}>
                  ${ev.amount.toLocaleString()}
                </span>
                <span style={{
                  color: ev.flagged ? "#ef4444" : "#22c55e"
                }}>
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