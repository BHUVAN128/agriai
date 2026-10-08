import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Flame,
  Leaf,
  MapPin,
  Package,
  RotateCcw,
  Sparkles,
  Tractor,
  Truck,
} from "lucide-react";
import { optimizeInitialRoute } from "../services/api";

const DISRUPTION_TYPES = [
  { value: "traffic", label: "Traffic Jam / Road Works" },
  { value: "weather", label: "Weather & Container Temp Spikes (Quality Loss)" },
  { value: "breakdown", label: "Vehicle Mechanical Breakdown" },
];

export default function Controls({
  options,
  shipment,
  setShipment,
  delay,
  setDelay,
  temperature,
  setTemperature,
  nodeId,
  setNodeId,
  disruptionType,
  setDisruptionType,
  onGenerate,
  onSimulate,
  onOptimalRouteSelected,
  loading,
}) {
  const [optimizing, setOptimizing] = useState(false);
  const [optimalResult, setOptimalResult] = useState(null);
  const [optError, setOptError] = useState("");

  function update(field, value) {
    setShipment((current) => ({ ...current, [field]: value }));
  }

  async function handleAutoFindBestNode() {
    try {
      setOptimizing(true);
      setOptError("");
      const res = await optimizeInitialRoute({
        farm_id: shipment.farm_id,
        produce_type: shipment.produce_type,
        capacity_kg: shipment.capacity_kg,
      });
      setOptimalResult(res);
      // Auto update target destination to the best market
      update("target_market_id", res.best_market_id);
      if (onOptimalRouteSelected && res.best_route) {
        onOptimalRouteSelected({
          ...res.best_route,
          cargo_value: res.cargo_value,
          quality_percent: res.arrival_quality_percent,
          produce_type: shipment.produce_type,
          capacity_kg: shipment.capacity_kg,
          route_status: "safe",
        });
      }
    } catch (err) {
      setOptError(err.message || "Failed to calculate optimal node");
    } finally {
      setOptimizing(false);
    }
  }

  return (
    <section className="panel controls-panel">
      {/* Shipment Setup Title */}
      <div className="panel-title flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="section-icon">
            <Truck size={17} />
          </span>
          <div>
            <h2>Shipment setup</h2>
            <p>Configure load & multi-node optimization</p>
          </div>
        </div>
      </div>

      {/* Origin Farm */}
      <label className="field-label">
        <span>
          <MapPin size={14} /> Origin farm
        </span>
        <select
          value={shipment.farm_id}
          onChange={(event) => {
            update("farm_id", event.target.value);
            setOptimalResult(null);
          }}
        >
          {(options?.farms || []).map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </select>
      </label>

      {/* Destination Market */}
      <label className="field-label">
        <span className="flex items-center justify-between w-full">
          <span className="flex items-center gap-1.5">
            <MapPin size={14} /> Destination market / mandi
          </span>
          {optimalResult && (
            <span className="text-[9px] font-mono font-bold text-[#b3e875] bg-[#b3e875]/10 px-2 py-0.5 rounded border border-[#b3e875]/30">
              ⭐ BEST NODE SELECTED
            </span>
          )}
        </span>
        <select
          value={shipment.target_market_id}
          onChange={(event) => update("target_market_id", event.target.value)}
        >
          {(options?.markets || []).map((market) => (
            <option key={market.id} value={market.id}>
              {market.name} {optimalResult?.best_market_id === market.id ? "⭐ (Optimal)" : ""}
            </option>
          ))}
        </select>
      </label>

      {/* Produce & Load */}
      <div className="two-fields">
        <label className="field-label">
          <span>
            <Leaf size={14} /> Produce
          </span>
          <select
            value={shipment.produce_type}
            onChange={(event) => {
              update("produce_type", event.target.value);
              setOptimalResult(null);
            }}
          >
            {(options?.produce_types || []).map((produce) => (
              <option key={produce.name} value={produce.name}>
                {produce.name} (k={produce.decay_coefficient})
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>
            <Package size={14} /> Load (kg)
          </span>
          <input
            type="number"
            min="1"
            max="100000"
            value={shipment.capacity_kg}
            onChange={(event) => update("capacity_kg", Number(event.target.value))}
          />
        </label>
      </div>

      {/* Multi-Node Best Finder Button */}
      <button
        type="button"
        className="w-full mt-3 py-2 px-3 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wide bg-[#202b20] hover:bg-[#283828] text-[#b3e875] border border-[#3c5438] flex items-center justify-center gap-2 transition-all"
        onClick={handleAutoFindBestNode}
        disabled={optimizing || loading || !options}
      >
        <Sparkles size={14} className={optimizing ? "animate-spin text-amber-400" : "text-[#b3e875]"} />
        <span>{optimizing ? "Evaluating Multi-Nodes in OR-Tools…" : "Auto-Find Best Optimal Node (OR-Tools)"}</span>
      </button>

      {optError && <p className="text-[10px] text-red-400 mt-1 font-mono">{optError}</p>}

      {/* Optimal Node Evaluation Result Card */}
      {optimalResult && (
        <div className="mt-3 p-3 rounded-xl bg-black/40 border border-[#3e563a] text-[10px]">
          <div className="flex items-center justify-between text-[#b3e875] font-bold">
            <span className="flex items-center gap-1.5">
              <Award size={13} />
              <span>Rank #1: {optimalResult.best_market_name}</span>
            </span>
            <span className="font-mono">{optimalResult.arrival_quality_percent}% Fresh</span>
          </div>
          <p className="text-neutral-300 text-[10px] mt-1 leading-relaxed">
            {optimalResult.recommendation_reason}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-neutral-800 text-[9px] text-neutral-400 font-mono">
            <div>
              <span>ETA: </span>
              <strong className="text-white">{optimalResult.best_route.eta_minutes} min</strong>
            </div>
            <div>
              <span>Distance: </span>
              <strong className="text-white">{optimalResult.best_route.distance_km} km</strong>
            </div>
          </div>
        </div>
      )}

      {/* Generate Baseline Route Button */}
      <button
        type="button"
        className="primary-button"
        onClick={onGenerate}
        disabled={loading || !options}
      >
        <Activity size={16} />
        <span>{loading ? "Planning route…" : "Generate baseline route"}</span>
      </button>

      {/* DISRUPTION SIMULATION */}
      <div className="divider" />
      <div className="subsection-heading">
        <span className="status-dot" />
        <div>
          <h3>Simulate disruption</h3>
          <p>Broadcast incident to farmer & buyer portals</p>
        </div>
      </div>

      {/* Disruption Type Selector */}
      <label className="field-label">
        <span>
          <AlertTriangle size={14} /> Disruption type
        </span>
        <select
          value={disruptionType}
          onChange={(event) => setDisruptionType(event.target.value)}
        >
          {DISRUPTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[9px] text-neutral-500 font-mono leading-relaxed -mt-1">
        {disruptionType === "traffic"
          ? "→ OR-Tools invalidates the blocked segment · switches to Option 2 (Alternative Path) · badge: Detour Active"
          : disruptionType === "weather"
          ? "→ Q(t) 50–75%: reroute to Secondary Mandi · Q(t) < 50%: broadcast Flash Sale"
          : "→ Q(t) > 75%: Replacement Vehicle · Q(t) < 50%: cancel transport + Flash Sale"}
      </p>

      <label className="field-label slider-field">
        <span>
          Transit delay <b>{delay} min</b>
        </span>
        <input
          type="range"
          min="0"
          max="360"
          step="5"
          value={delay}
          onChange={(event) => setDelay(Number(event.target.value))}
        />
        <span className="range-ends">
          <small>On time</small>
          <small>6 hours</small>
        </span>
      </label>

      <label className="field-label slider-field">
        <span>
          Ambient / container temperature <b>{temperature}°C</b>
        </span>
        <input
          type="range"
          min="10"
          max="45"
          step="1"
          value={temperature}
          onChange={(event) => setTemperature(Number(event.target.value))}
        />
        <span className="range-ends">
          <small>10°C (Chilled)</small>
          <small>45°C (Heatwave)</small>
        </span>
      </label>

      <label className="field-label">
        <span>Incident location / checkpoint</span>
        <select value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
          {(options?.waypoints || []).map((node) => (
            <option key={node.id} value={node.id}>
              {node.name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="secondary-button"
        onClick={onSimulate}
        disabled={loading || !options}
      >
        <RotateCcw size={15} />
        <span>Run disruption simulation</span>
      </button>
    </section>
  );
}
