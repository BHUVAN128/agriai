import { ArrowDownRight, ArrowUpRight, Banknote, Clock3, ShieldCheck, Sprout } from "lucide-react";

function Metric({ icon: Icon, label, value, detail, tone = "" }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={17} /></div>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function MetricsCard({ route, result }) {
  const quality = result?.quality_percent ?? route?.quality_percent;
  const cargo = result?.cargo_value ?? route?.cargo_value;
  const valueSaved = result?.value_saved;
  const eta = route?.eta_minutes;
  const status = result?.route_status;
  return (
    <div className="metrics-grid">
      <Metric icon={Sprout} label="Cargo freshness" value={quality == null ? "—" : `${quality.toFixed(1)}%`} detail={result ? `${result.baseline_quality_percent.toFixed(1)}% at baseline` : "Predicted at arrival"} tone="green" />
      <Metric icon={Banknote} label={result ? "Cargo value saved" : "Cargo value"} value={cargo == null ? "—" : `$${(result ? valueSaved : cargo).toLocaleString("en-US", { maximumFractionDigits: 0 })}`} detail={result ? `Loss prevented $${(result.loss_prevented || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "Estimated load value"} tone="gold" />
      <Metric icon={Clock3} label="Route ETA" value={eta == null ? "—" : `${Math.floor(eta / 60)}h ${eta % 60}m`} detail={route ? `${route.distance_km} km · OR-Tools VRPTW` : "Awaiting route plan"} tone="blue" />
      <Metric icon={status ? ArrowDownRight : ArrowUpRight} label="Shipment status" value={status ? status.replace("_", " ") : "Ready"} detail={result?.decision?.reason || "No active disruptions"} tone={status ? "orange" : "green"} />
    </div>
  );
}
