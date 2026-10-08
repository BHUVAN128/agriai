import { useState, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sprout,
  Thermometer,
  Tractor,
  Truck,
  Wrench,
} from "lucide-react";
import { ackFarmerAlert, getFarmerAlerts } from "../services/api";

export default function FarmerDashboard({ onSwitchToFlashSales, latestSimulatedResult }) {
  const [alerts, setAlerts] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await getFarmerAlerts();
      setAlerts(res.alerts || []);
      setTrucks(res.trucks || []);
    } catch (err) {
      console.error("Failed to load farmer alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleAction = async (alertId, actionType) => {
    try {
      await ackFarmerAlert(alertId, actionType);
      setActionSuccess(`Authorization confirmed: ${actionType.replace("_", " ")}`);
      fetchAlerts();
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      alert("Action failed: " + err.message);
    }
  };

  const activeAlert = alerts.find((a) => a.status === "ACTIVE") || alerts[0];

  // Scenario 3: Vehicle Mechanical Breakdown / Repair feed
  const breakdownAlerts = alerts.filter(
    (a) => a.status === "ACTIVE" && a.disruption_type === "breakdown"
  );
  const breakdownAlert = breakdownAlerts[0];
  const replacementVehicle = breakdownAlert?.replacement_vehicle;
  const breakdownCancelled =
    breakdownAlert && breakdownAlert.quality_percent < 50;

  return (
    <div className="farmer-portal-container space-y-6">
      {/* Top Banner & Header */}
      <div className="portal-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <Tractor size={14} />
            <span>ORIGIN FARM PORTAL · PERAMBALUR & REGIONAL HUBS</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
            Farm Dispatch & Crop Degradation Monitor
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time telemetry of out-bound reefer trucks, sensor warnings, and crop spoilage protection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchAlerts}
            className="secondary-button !mt-0 !w-auto px-4 py-2 flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Feed</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="success-banner flex items-center gap-2 p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* VEHICLE BREAKDOWN & REPLACEMENT ALERTS (Scenario 3) */}
      {breakdownAlert && (
        <section className="p-5 rounded-2xl border bg-red-950/30 border-red-500/50 shadow-lg shadow-red-950/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                <Wrench size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-900/70 text-red-100 border border-red-700/60 font-bold">
                    Vehicle Breakdown
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">
                    {breakdownAlert.status_badge || "Repair In Progress"}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {breakdownAlert.created_at}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-neutral-100 mt-1.5">
                  {breakdownAlert.title}
                </h3>
                <p className="text-xs text-neutral-300 mt-1 max-w-3xl leading-relaxed">
                  {breakdownAlert.description}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-neutral-400 block font-mono">
                BREAKDOWN CHECKPOINT
              </span>
              <strong className="text-sm font-mono text-white">
                {breakdownAlert.checkpoint_name}
              </strong>
            </div>
          </div>

          {/* Replacement vehicle dispatch OR flash-sale cancellation */}
          <div className="mt-4 pt-4 border-t border-red-900/50 grid grid-cols-1 md:grid-cols-2 gap-3">
            {replacementVehicle && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-emerald-700/40">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5">
                    <Truck size={13} className="text-emerald-400" />
                    ALTERNATIVE REPLACEMENT VEHICLE
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-bold">
                    {replacementVehicle.status}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  {replacementVehicle.id} · {replacementVehicle.name}
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Driver: <strong className="text-neutral-200">{replacementVehicle.driver}</strong>{" "}
                  · {replacementVehicle.phone} · Capacity {replacementVehicle.capacity_kg} kg
                </p>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-neutral-800 text-[11px] font-mono">
                  <span className="text-emerald-300 font-bold">
                    ETA {replacementVehicle.eta_minutes} min
                  </span>
                  <span className="text-neutral-500">
                    dispatched to {breakdownAlert.checkpoint_name}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
                  Load will be transshipped and the original route continues with the relief vehicle.
                </p>
              </div>
            )}

            {breakdownCancelled && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-orange-600/50">
                <div className="flex items-center gap-1.5">
                  <Flame size={14} className="text-orange-400" />
                  <span className="text-[10px] text-orange-300 font-mono font-bold">
                    TRANSPORT CANCELLED · Q(t) {breakdownAlert.quality_percent?.toFixed(1)}% &lt; 50%
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-2 leading-relaxed">
                  Freshness collapsed below 50%: the batch has been pushed to the Restaurant
                  Flash Sales Portal for an instant on-site sale at{" "}
                  <strong className="text-white">{breakdownAlert.checkpoint_name}</strong>.
                </p>
                <button
                  type="button"
                  onClick={onSwitchToFlashSales}
                  className="mt-3 px-3 py-1.5 text-[11px] rounded-lg bg-orange-600 hover:bg-orange-500 text-black border border-orange-400 font-bold flex items-center gap-1.5"
                >
                  <Flame size={12} />
                  Open Flash Sale Listing
                  <ExternalLink size={12} />
                </button>
              </div>
            )}

            {replacementVehicle && !breakdownCancelled && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-neutral-800 flex flex-col justify-center">
                <span className="text-[10px] text-neutral-400 font-mono block mb-2">
                  BREAKDOWN RESPONSE ACTIONS
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction(breakdownAlert.id, "ACKNOWLEDGE")}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-semibold"
                  >
                    Acknowledge Breakdown
                  </button>
                  <a
                    href={`tel:${replacementVehicle.phone}`}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 border border-emerald-600/40 font-semibold flex items-center gap-1"
                  >
                    <PhoneCall size={12} />
                    Call Relief Driver
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* DISRUPTION ALERT BANNER (Prominent Top Alert) */}
      {activeAlert && (
        <section
          className={`disruption-alert-card p-5 rounded-2xl border transition-all ${
            activeAlert.status === "ACTIVE"
              ? "bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-950/20"
              : "bg-[#162018] border-[#2f3d31]"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  activeAlert.status === "ACTIVE"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                <ShieldAlert size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-900/60 text-red-200 border border-red-700/50">
                    Live Disruption Event
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Vehicle: <strong>{activeAlert.truck_id}</strong> · Driver: {activeAlert.driver_name}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {activeAlert.created_at}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-neutral-100 mt-1">
                  {activeAlert.title}
                </h3>
                <p className="text-xs text-neutral-300 mt-1 max-w-3xl leading-relaxed">
                  {activeAlert.description}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <span className="text-[10px] text-neutral-400 block font-mono">
                  RECOMMENDED ACTION
                </span>
                <span className="inline-block mt-0.5 text-xs font-bold font-mono px-2.5 py-1 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 uppercase">
                  {activeAlert.recommended_action?.replace("_", " ") || "Evaluating"}
                </span>
              </div>
            </div>
          </div>

          {/* Crop Impact Degradation Summary Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-neutral-800/80">
            <div className="p-3 rounded-xl bg-black/30 border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block font-mono">
                CURRENT FRESHNESS
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <strong
                  className={`text-xl font-bold font-mono ${
                    activeAlert.quality_percent < 50
                      ? "text-red-400"
                      : activeAlert.quality_percent < 75
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {activeAlert.quality_percent?.toFixed(1)}%
                </strong>
                <span className="text-[10px] text-neutral-500">
                  {activeAlert.produce_type}
                </span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    activeAlert.quality_percent < 50
                      ? "bg-red-500"
                      : activeAlert.quality_percent < 75
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, activeAlert.quality_percent))}%` }}
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/30 border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block font-mono">
                VALUE AT RISK
              </span>
              <strong className="text-xl font-bold font-mono text-red-300 mt-1 block">
                ${activeAlert.value_at_risk?.toLocaleString() || "0"}
              </strong>
              <small className="text-[10px] text-neutral-500">
                Total load value: ${activeAlert.cargo_value?.toLocaleString() || "0"}
              </small>
            </div>

            <div className="p-3 rounded-xl bg-black/30 border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block font-mono">
                AMBIENT SENSOR SPIKE
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <Thermometer size={17} className="text-red-400" />
                <strong className="text-xl font-bold font-mono text-neutral-100">
                  {activeAlert.temp_celsius}°C
                </strong>
              </div>
              <small className="text-[10px] text-red-400/90 font-mono">
                +{activeAlert.delay_mins} min delay reported
              </small>
            </div>

            <div className="p-3 rounded-xl bg-black/30 border border-neutral-800 flex flex-col justify-center">
              <span className="text-[10px] text-neutral-400 block font-mono mb-2">
                DIRECT DRIVER ACTIONS
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(activeAlert.id, "ACKNOWLEDGE")}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-semibold"
                >
                  Acknowledge
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(activeAlert.id, "AUTHORIZE_REROUTE")}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-blue-900/60 hover:bg-blue-800/80 text-blue-200 border border-blue-600/40 font-semibold flex items-center gap-1"
                >
                  <Snowflake size={12} />
                  Authorize Cold Detour
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleAction(activeAlert.id, "AUTHORIZE_FLASH_SALE");
                    if (onSwitchToFlashSales) onSwitchToFlashSales();
                  }}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-amber-600 hover:bg-amber-500 text-black border border-amber-400 font-bold flex items-center gap-1"
                >
                  <Flame size={12} />
                  Liquidate Flash Sale
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* VEHICLE STATUS FEED */}
      <section className="trucks-feed-section">
        <div className="section-title flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Truck size={17} className="text-[#b3e875]" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Active Dispatch Vehicles ({trucks.length})
            </h3>
          </div>
          <span className="text-[11px] text-neutral-400 font-mono">
            Origin Dispatch Hub: Perambalur / Regional Co-op
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trucks.map((truck) => {
            const isDisrupted = ["DISRUPTED", "WARNING", "FLASH_SALE", "BREAKDOWN", "DETOUR_ACTIVE", "REPLACEMENT_DISPATCHED"].includes(truck.status);
            return (
              <div
                key={truck.id}
                className={`truck-card p-4 rounded-xl border transition-all ${
                  isDisrupted
                    ? "bg-[#1c1815] border-amber-700/50 shadow-md shadow-amber-950/20"
                    : "bg-[#151e17] border-[#2b382d]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isDisrupted ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      <Truck size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {truck.id} · {truck.name}
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        Driver: <strong>{truck.driver}</strong> ({truck.phone})
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      isDisrupted
                        ? "bg-red-500/20 text-red-300 border border-red-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    }`}
                  >
                    {truck.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-neutral-800/80 text-[11px]">
                  <div>
                    <span className="text-neutral-500 text-[10px] block">ORIGIN → MANDI</span>
                    <span className="text-neutral-200 font-medium">
                      {truck.origin_farm} → {truck.target_mandi}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[10px] block">CURRENT CHECKPOINT</span>
                    <span className="text-neutral-200 font-mono">
                      {truck.location_name || truck.current_checkpoint || "En Route"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-neutral-800/60 text-[11px]">
                  <div>
                    <span className="text-neutral-500 text-[10px] block">CARGO LOAD</span>
                    <span className="text-neutral-200 font-mono">
                      {truck.current_load_kg || truck.capacity_kg} kg {truck.produce_type || "Tomatoes"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[10px] block">REEFER TEMP</span>
                    <span
                      className={`font-mono font-bold ${
                        truck.temp_celsius > 30
                          ? "text-red-400"
                          : truck.temp_celsius > 22
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {truck.temp_celsius}°C
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[10px] block">FRESHNESS</span>
                    <span
                      className={`font-mono font-bold ${
                        (truck.quality_percent || 100) < 50
                          ? "text-red-400"
                          : "text-[#b3e875]"
                      }`}
                    >
                      {(truck.quality_percent || 95).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2">
                  <a
                    href={`tel:${truck.phone}`}
                    className="text-[11px] text-neutral-300 hover:text-white flex items-center gap-1 font-mono"
                  >
                    <PhoneCall size={12} className="text-[#b3e875]" />
                    <span>Call Driver</span>
                  </a>
                  {isDisrupted && (
                    <button
                      type="button"
                      onClick={onSwitchToFlashSales}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                    >
                      <span>View Flash Deal</span>
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
