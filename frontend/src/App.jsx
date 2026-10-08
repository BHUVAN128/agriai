import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, Bell, CircleHelp, Leaf, Radio, Sprout, Wind } from "lucide-react";
import Controls from "./components/Controls.jsx";
import MapView from "./components/MapView.jsx";
import MetricsCard from "./components/MetricsCard.jsx";
import VoiceUI from "./components/VoiceUI.jsx";
import { createRoute, getOptions, sendVoiceCommand, simulateIncident } from "./services/api.js";

const initialShipment = {
  farm_id: "farm_pune",
  target_market_id: "market_nashik",
  produce_type: "Tomatoes",
  capacity_kg: 1000,
};

function App() {
  const [options, setOptions] = useState(null);
  const [shipment, setShipment] = useState(initialShipment);
  const [route, setRoute] = useState(null);
  const [result, setResult] = useState(null);
  const [delay, setDelay] = useState(30);
  const [temperature, setTemperature] = useState(34);
  const [nodeId, setNodeId] = useState("Node_B");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getOptions().then(setOptions).catch((issue) => setError(`Could not connect to the API: ${issue.message}`));
  }, []);

  const shipmentName = useMemo(
    () => options?.markets?.find((market) => market.id === shipment.target_market_id)?.name || "Target market",
    [options, shipment.target_market_id],
  );

  async function run(task) {
    setLoading(true);
    setError("");
    try {
      await task();
    } catch (issue) {
      setError(issue.message);
    } finally {
      setLoading(false);
    }
  }

  function generateRoute() {
    return run(async () => {
      const planned = await createRoute(shipment);
      setRoute(planned);
      setResult(null);
    });
  }

  function runSimulation() {
    if (!route) {
      setError("Generate a baseline route before simulating an incident.");
      return;
    }
    return run(async () => {
      const simulated = await simulateIncident({
        ...shipment,
        delay_mins: delay,
        temp_celsius: temperature,
        node_id: nodeId,
      });
      setResult(simulated);
    });
  }

  async function runVoiceCommand(text) {
    if (!route) throw new Error("Generate a baseline route before reporting an incident.");
    setLoading(true);
    setError("");
    try {
      const response = await sendVoiceCommand(text, shipment);
      setResult(response);
      setDelay(response.incident.delay_mins);
      setTemperature(response.incident.temp_celsius);
      setNodeId(response.incident.node_id);
      return response;
    } catch (issue) {
      setError(issue.message);
      throw issue;
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell min-h-screen">
      <header className="topbar">
        <a className="brand" href="#" aria-label="AgriRoute home">
          <span className="brand-mark"><Sprout size={21} /></span>
          <span><strong>agri<span>route</span></strong><small>INTELLIGENCE FOR THE LAST MILE</small></span>
        </a>
        <div className="topbar-right"><span className="system-status"><i /> SYSTEM OPERATIONAL</span><button className="icon-button" title="Notifications"><Bell size={17} /></button><div className="avatar">GA</div></div>
      </header>

      <section className="welcome-row">
        <div><div className="eyebrow"><span>FIELD OPERATIONS</span><span className="eyebrow-line" /></div><h1>Freshness in <em>motion.</em></h1><p>Monitor your produce, anticipate spoilage, protect every shipment.</p></div>
        <div className="weather-chip"><span className="weather-symbol"><Wind size={18} /></span><div><small>REGIONAL CONDITIONS</small><strong>Warm · 28°C</strong></div><span className="weather-separator" /><div><small>NETWORK</small><strong className="network-live"><i /> Live</strong></div></div>
      </section>

      {error && <div className="error-banner"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

      <MetricsCard route={route} result={result} />

      <div className="dashboard-grid">
        <div className="left-column">
          <Controls
            options={options}
            shipment={shipment}
            setShipment={setShipment}
            delay={delay}
            setDelay={setDelay}
            temperature={temperature}
            setTemperature={setTemperature}
            nodeId={nodeId}
            setNodeId={setNodeId}
            onGenerate={generateRoute}
            onSimulate={runSimulation}
            loading={loading}
          />
          <VoiceUI onCommand={runVoiceCommand} busy={loading} />
        </div>

        <section className="panel map-panel">
          <div className="map-header">
            <div className="panel-title"><span className="section-icon"><Radio size={17} /></span><div><h2>Live route monitor</h2><p>{route ? `${route.nodes[0].name} → ${shipmentName}` : "Regional logistics network"}</p></div></div>
            <span className={`route-badge ${result ? "route-alert" : ""}`}><i /> {result ? result.route_status.replace("_", " ") : route ? "ROUTE ACTIVE" : "AWAITING ROUTE"}</span>
          </div>
          <MapView route={route} result={result} />
          <div className="map-footer">
            <div className="footer-stat"><small>ROUTE DISTANCE</small><strong>{route ? `${route.distance_km} km` : "—"}</strong></div>
            <div className="footer-stat"><small>EXPECTED ARRIVAL</small><strong>{route ? `${(route.eta_minutes / 60).toFixed(1)} hrs` : "—"}</strong></div>
            <div className="footer-stat"><small>PRODUCE TYPE</small><strong>{shipment.produce_type}</strong></div>
            {result && <div className="footer-stat recovery"><small>RECOVERY PLAN</small><strong>{result.decision.action.replace("_", " ")}</strong></div>}
          </div>
          {result && <div className="decision-banner">
            <span className="decision-mark"><Activity size={16} /></span>
            <div>
              <strong>{result.decision.reason}</strong>
              <p>{result.summary}</p>
              {result.flash_sale && <div className="recovery-details">
                <span>{result.flash_sale.discount_percent}% OFF</span>
                <span>${result.flash_sale.sale_value.toLocaleString("en-US")} sale value</span>
                <span>{result.flash_sale.alerts_sent} buyer alerts · {result.flash_sale.radius_km} km</span>
              </div>}
              {result.decision.destination && <div className="recovery-details">
                <span>NEW DESTINATION</span>
                <span>{result.decision.destination.name}</span>
                <span>{result.detour_route.eta_minutes} min detour ETA</span>
              </div>}
            </div>
            <ArrowUpRight size={17} />
          </div>}
        </section>
      </div>

      <footer className="page-footer"><span><Leaf size={13} /> Built for resilient food supply chains</span><span><CircleHelp size={13} /> Simulation uses prototype data · Notifications are mocked</span><span>GENZ AL <b>·</b> CODIENYCH-2026-0050</span></footer>
    </main>
  );
}

export default App;
