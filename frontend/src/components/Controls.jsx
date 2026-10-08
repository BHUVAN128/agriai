import { Activity, Leaf, MapPin, Package, RotateCcw, Truck } from "lucide-react";

export default function Controls({
  options, shipment, setShipment, delay, setDelay, temperature, setTemperature,
  nodeId, setNodeId, onGenerate, onSimulate, loading,
}) {
  function update(field, value) {
    setShipment((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="panel controls-panel">
      <div className="panel-title"><span className="section-icon"><Truck size={17} /></span><div><h2>Shipment setup</h2><p>Configure your load and route</p></div></div>
      <label className="field-label"><span><MapPin size={14} /> Origin farm</span>
        <select value={shipment.farm_id} onChange={(event) => update("farm_id", event.target.value)}>
          {(options?.farms || []).map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
        </select>
      </label>
      <label className="field-label"><span><MapPin size={14} /> Destination market</span>
        <select value={shipment.target_market_id} onChange={(event) => update("target_market_id", event.target.value)}>
          {(options?.markets || []).map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
        </select>
      </label>
      <div className="two-fields">
        <label className="field-label"><span><Leaf size={14} /> Produce</span>
          <select value={shipment.produce_type} onChange={(event) => update("produce_type", event.target.value)}>
            {(options?.produce_types || []).map((produce) => <option key={produce.name} value={produce.name}>{produce.name}</option>)}
          </select>
        </label>
        <label className="field-label"><span><Package size={14} /> Load (kg)</span>
          <input type="number" min="1" max="100000" value={shipment.capacity_kg} onChange={(event) => update("capacity_kg", Number(event.target.value))} />
        </label>
      </div>
      <button type="button" className="primary-button" onClick={onGenerate} disabled={loading || !options}>
        <Activity size={16} /> {loading ? "Planning route…" : "Generate baseline route"}
      </button>

      <div className="divider" />
      <div className="subsection-heading"><span className="status-dot" /><div><h3>Simulate disruption</h3><p>Test a live shipment incident</p></div></div>
      <label className="field-label slider-field"><span>Transit delay <b>{delay} min</b></span>
        <input type="range" min="0" max="180" step="5" value={delay} onChange={(event) => setDelay(Number(event.target.value))} />
        <span className="range-ends"><small>On time</small><small>3 hours</small></span>
      </label>
      <label className="field-label slider-field"><span>Ambient temperature <b>{temperature}°C</b></span>
        <input type="range" min="10" max="45" step="1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
        <span className="range-ends"><small>10°C</small><small>45°C</small></span>
      </label>
      <label className="field-label"><span>Incident checkpoint</span>
        <select value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
          {(options?.waypoints || []).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
        </select>
      </label>
      <button type="button" className="secondary-button" onClick={onSimulate} disabled={loading || !options}>
        <RotateCcw size={15} /> Run disruption simulation
      </button>
    </section>
  );
}

