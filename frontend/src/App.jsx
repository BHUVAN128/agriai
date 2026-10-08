import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CircleHelp,
  Flame,
  Leaf,
  Radio,
  Sprout,
  Tractor,
  Wind,
} from "lucide-react";
import Controls from "./components/Controls.jsx";
import MapView from "./components/MapView.jsx";
import MetricsCard from "./components/MetricsCard.jsx";
import Navbar from "./components/Navbar.jsx";
import VoiceUI from "./components/VoiceUI.jsx";
import FarmerDashboard from "./pages/FarmerDashboard.jsx";
import FlashSaleDashboard from "./pages/FlashSaleDashboard.jsx";
import {
  createDriverAlert,
  createRoute,
  getFarmerAlerts,
  getFlashDeals,
  getOptions,
  sendVoiceCommand,
  simulateIncident,
} from "./services/api.js";

const initialShipment = {
  farm_id: "farm_perambalur_valley",
  target_market_id: "market_perambalur_mandi",
  produce_type: "Tomatoes",
  capacity_kg: 1000,
};

function App() {
  const [activeTab, setActiveTab] = useState("control"); // "control" | "farmer" | "buyer"
  const [options, setOptions] = useState(null);
  const [shipment, setShipment] = useState(initialShipment);
  const [route, setRoute] = useState(null);
  const [result, setResult] = useState(null);
  const [delay, setDelay] = useState(90);
  const [temperature, setTemperature] = useState(34);
  const [nodeId, setNodeId] = useState("Node_P2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alertCount, setAlertCount] = useState(1);
  const [dealCount, setDealCount] = useState(1);

  // Poll counts for Navbar badges
  const refreshBadgeCounts = async () => {
    try {
      const [alertRes, dealRes] = await Promise.all([
        getFarmerAlerts().catch(() => ({ unread_count: 0 })),
        getFlashDeals().catch(() => ({ active_count: 0 })),
      ]);
      setAlertCount(alertRes.unread_count || 0);
      setDealCount(dealRes.active_count || 0);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    getOptions()
      .then((opts) => {
        setOptions(opts);
        if (opts?.farms?.length > 0) {
          setShipment((curr) => ({
            ...curr,
            farm_id: opts.farms[0].id,
            target_market_id: opts.markets[0]?.id || curr.target_market_id,
          }));
        }
        if (opts?.waypoints?.length > 0) {
          setNodeId(opts.waypoints[0].id);
        }
      })
      .catch((issue) =>
        setError(`Could not connect to the API: ${issue.message}`)
      );

    refreshBadgeCounts();
    const interval = setInterval(refreshBadgeCounts, 6000);
    return () => clearInterval(interval);
  }, []);

  const shipmentName = useMemo(
    () =>
      options?.markets?.find((market) => market.id === shipment.target_market_id)
        ?.name || "Target market",
    [options, shipment.target_market_id]
  );

  async function run(task) {
    setLoading(true);
    setError("");
    try {
      await task();
      refreshBadgeCounts();
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

  function handleOptimalRouteSelected(optimalRoute) {
    setRoute(optimalRoute);
    setResult(null);
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
      refreshBadgeCounts();
    });
  }

  async function handleSimulateDriverAlert() {
    return run(async () => {
      const res = await createDriverAlert({
        truck_id: "TRK-102",
        node_id: nodeId || "Node_P2",
        delay_mins: delay || 60,
        temp_celsius: temperature || 35,
        produce_type: shipment.produce_type,
        capacity_kg: shipment.capacity_kg,
      });
      setResult(res);
      refreshBadgeCounts();
      setActiveTab("farmer");
    });
  }

  async function runVoiceCommand(text) {
    if (!route)
      throw new Error(
        "Generate a baseline route before reporting an incident."
      );
    setLoading(true);
    setError("");
    try {
      const response = await sendVoiceCommand(text, shipment);
      setResult(response);
      setDelay(response.incident.delay_mins);
      setTemperature(response.incident.temp_celsius);
      setNodeId(response.incident.node_id);
      refreshBadgeCounts();
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
      {/* Top Navbar with Page Tabs */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alertCount}
        dealCount={dealCount}
        onSimulateDriverAlert={handleSimulateDriverAlert}
      />

      {/* Global Error Banner */}
      {error && (
        <div className="error-banner">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {/* VIEW 1: FARMER PORTAL */}
      {activeTab === "farmer" && (
        <section className="py-6">
          <FarmerDashboard
            onSwitchToFlashSales={() => setActiveTab("buyer")}
            latestSimulatedResult={result}
          />
        </section>
      )}

      {/* VIEW 2: BUYER & RESTAURANT FLASH SALES */}
      {activeTab === "buyer" && (
        <section className="py-6">
          <FlashSaleDashboard />
        </section>
      )}

      {/* VIEW 3: MAIN LOGISTICS CONTROL (Current Core Dashboard) */}
      {activeTab === "control" && (
        <>
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <span>LOGISTICS OPERATIONS</span>
                <span className="eyebrow-line" />
              </div>
              <h1>
                Freshness in <em>motion.</em>
              </h1>
              <p>
                Dynamic route optimization, multi-node perishability evaluation, and incident rerouting.
              </p>
            </div>
            <div className="weather-chip">
              <span className="weather-symbol">
                <Wind size={18} />
              </span>
              <div>
                <small>REGIONAL CONDITIONS</small>
                <strong>Warm · 28°C</strong>
              </div>
              <span className="weather-separator" />
              <div>
                <small>NETWORK</small>
                <strong className="network-live">
                  <i /> Live
                </strong>
              </div>
            </div>
          </section>

          {/* Dynamic Metrics Cards */}
          <MetricsCard route={route} result={result} />

          {/* Dashboard Main Grid */}
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
                onOptimalRouteSelected={handleOptimalRouteSelected}
                loading={loading}
              />
              <VoiceUI onCommand={runVoiceCommand} busy={loading} />
            </div>

            <section className="panel map-panel">
              <div className="map-header">
                <div className="panel-title">
                  <span className="section-icon">
                    <Radio size={17} />
                  </span>
                  <div>
                    <h2>Live route monitor</h2>
                    <p>
                      {route
                        ? `${route.nodes[0]?.name} → ${shipmentName}`
                        : "Regional logistics network"}
                    </p>
                  </div>
                </div>
                <span
                  className={`route-badge ${
                    result ? "route-alert" : ""
                  }`}
                >
                  <i />{" "}
                  {result
                    ? result.route_status.replace("_", " ")
                    : route
                    ? "ROUTE ACTIVE"
                    : "AWAITING ROUTE"}
                </span>
              </div>

              {/* Leaflet Map with Safe, Disruption & Detour Polylines */}
              <MapView route={route} result={result} shipment={shipment} options={options} />

              <div className="map-footer">
                <div className="footer-stat">
                  <small>ROUTE DISTANCE</small>
                  <strong>
                    {route ? `${route.distance_km} km` : "—"}
                  </strong>
                </div>
                <div className="footer-stat">
                  <small>EXPECTED ARRIVAL</small>
                  <strong>
                    {route
                      ? `${(route.eta_minutes / 60).toFixed(1)} hrs`
                      : "—"}
                  </strong>
                </div>
                <div className="footer-stat">
                  <small>PRODUCE TYPE</small>
                  <strong>{shipment.produce_type}</strong>
                </div>
                {result && (
                  <div className="footer-stat recovery">
                    <small>RECOVERY PLAN</small>
                    <strong>
                      {result.decision.action.replace("_", " ")}
                    </strong>
                  </div>
                )}
              </div>

              {result && (
                <div className="decision-banner">
                  <span className="decision-mark">
                    <Activity size={16} />
                  </span>
                  <div>
                    <strong>{result.decision.reason}</strong>
                    <p>{result.summary}</p>
                    {result.flash_sale && (
                      <div className="recovery-details flex flex-wrap items-center gap-2">
                        <span>
                          {result.flash_sale.discount_percent}% OFF
                        </span>
                        <span>
                          ${result.flash_sale.sale_value.toLocaleString(
                            "en-US"
                          )}{" "}
                          sale value
                        </span>
                        <span>
                          {result.flash_sale.alerts_sent} buyer alerts ·{" "}
                          {result.flash_sale.radius_km} km
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab("buyer")}
                          className="ml-auto text-[10px] text-amber-300 underline font-bold"
                        >
                          View in Flash Deals Portal →
                        </button>
                      </div>
                    )}
                    {result.decision.destination && (
                      <div className="recovery-details">
                        <span>NEW DESTINATION</span>
                        <span>
                          {result.decision.destination.name}
                        </span>
                        <span>
                          {result.detour_route?.eta_minutes} min detour ETA
                        </span>
                      </div>
                    )}
                  </div>
                  <ArrowUpRight size={17} />
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* Global Page Footer */}
      <footer className="page-footer">
        <span>
          <Leaf size={13} /> Built for resilient food supply chains
        </span>
        <span>
          <CircleHelp size={13} /> Simulation uses prototype data · Perambalur & Regional Nodes Connected
        </span>
        <span>
          GENZ AL <b>·</b> CODIENYCH-2026-0050
        </span>
      </footer>
    </main>
  );
}

export default App;
