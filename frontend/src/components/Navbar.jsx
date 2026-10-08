import { AlertTriangle, Flame, Navigation, Radio, Sprout, Tractor, User, Wind } from "lucide-react";

export default function Navbar({ activeTab, setActiveTab, alertCount = 0, dealCount = 0, onSimulateDriverAlert }) {
  return (
    <header className="topbar">
      <div className="flex items-center gap-6">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setActiveTab("control"); }}>
          <span className="brand-mark">
            <Sprout size={21} />
          </span>
          <span>
            <strong>
              agri<span>route</span>
            </strong>
            <small>INTELLIGENCE FOR THE LAST MILE</small>
          </span>
        </a>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-2 ml-4">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === "control" ? "active" : ""}`}
            onClick={() => setActiveTab("control")}
          >
            <Radio size={15} />
            <span>Logistics Control</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === "farmer" ? "active" : ""}`}
            onClick={() => setActiveTab("farmer")}
          >
            <Tractor size={15} />
            <span>Farmer Portal</span>
            {alertCount > 0 && (
              <span className="tab-badge alert-badge">{alertCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === "buyer" ? "active" : ""}`}
            onClick={() => setActiveTab("buyer")}
          >
            <Flame size={15} />
            <span>Buyer & Restaurant Flash Deals</span>
            {dealCount > 0 && (
              <span className="tab-badge deal-badge">{dealCount}</span>
            )}
          </button>
        </nav>
      </div>

      <div className="topbar-right">
        {onSimulateDriverAlert && (
          <button
            type="button"
            onClick={onSimulateDriverAlert}
            className="driver-alert-trigger-btn"
            title="Simulate truck breakdown / driver SOS alert"
          >
            <AlertTriangle size={14} />
            <span>Driver SOS Alert</span>
          </button>
        )}
        <span className="system-status">
          <i /> SYSTEM OPERATIONAL
        </span>
        <div className="avatar" title="Logged in as Field Dispatch">
          GA
        </div>
      </div>
    </header>
  );
}
