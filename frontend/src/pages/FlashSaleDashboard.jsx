import { useState, useEffect } from "react";
import {
  AlertTriangle,
  BadgePercent,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  MapPin,
  Package,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Truck,
  Utensils,
} from "lucide-react";
import { claimFlashDeal, getFlashDeals } from "../services/api";

export default function FlashSaleDashboard() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState("Annapoorna Hotel & Bistro");
  const [claimSuccess, setClaimSuccess] = useState("");
  const [claimingId, setClaimingId] = useState(null);

  const buyersList = [
    "Annapoorna Hotel & Bistro (Perambalur)",
    "Perambalur Fresh Mart Co-op",
    "Royal Dine Caterers",
    "Pimpri Community Grocers",
    "Green Leaf Central Kitchen",
  ];

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const res = await getFlashDeals();
      setDeals(res.deals || []);
    } catch (err) {
      console.error("Failed to load flash deals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
    const interval = setInterval(fetchDeals, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClaim = async (dealId) => {
    try {
      setClaimingId(dealId);
      const res = await claimFlashDeal(dealId, selectedBuyer);
      setClaimSuccess(res.message || "Batch successfully reserved!");
      fetchDeals();
      setTimeout(() => setClaimSuccess(""), 5000);
    } catch (err) {
      alert("Reservation error: " + err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const activeDeals = deals.filter((d) => d.status === "ACTIVE");
  const claimedDeals = deals.filter((d) => d.status === "CLAIMED");

  return (
    <div className="flash-deals-container space-y-6">
      {/* Page Header */}
      <div className="portal-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <Flame size={14} className="text-orange-400" />
            <span>RESCUE COMMERCE · DISTRESS PRODUCE LIQUIDATION</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
            Restaurant & Commercial Buyer Flash Sales
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Purchase farm-fresh distressed produce immobilized in transit at 40% – 60% discount before quality degrades.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#151e17] border border-[#2b382d] rounded-xl px-3 py-1.5 text-xs text-neutral-300">
            <Store size={14} className="text-[#b3e875]" />
            <span className="text-[11px] text-neutral-400">Purchasing As:</span>
            <select
              value={selectedBuyer}
              onChange={(e) => setSelectedBuyer(e.target.value)}
              className="bg-transparent text-white font-semibold outline-none text-xs cursor-pointer"
            >
              {buyersList.map((b) => (
                <option key={b} value={b} className="bg-[#111a13] text-white">
                  {b}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchDeals}
            className="secondary-button !mt-0 !w-auto px-4 py-2 flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Deals</span>
          </button>
        </div>
      </div>

      {claimSuccess && (
        <div className="success-banner flex items-center gap-2 p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs">
          <CheckCircle2 size={16} />
          <span>{claimSuccess}</span>
        </div>
      )}

      {/* Real-Time Push Notification Ticker */}
      <div className="p-3 rounded-xl bg-orange-950/20 border border-orange-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
          </span>
          <span className="text-xs text-orange-200 font-medium">
            <strong>Live Transit Distress Alerts:</strong> High-fragility produce triggered for hyper-local flash clearance within a 5 km radius.
          </span>
        </div>
        <span className="text-[11px] font-mono text-orange-300 font-bold">
          {activeDeals.length} ACTIVE BATCHES AVAILABLE
        </span>
      </div>

      {/* DISTRESS DEALS GRID */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
            <ShoppingBag size={16} className="text-[#b3e875]" />
            Live Distress Batches ({activeDeals.length})
          </h3>
          <span className="text-xs text-neutral-400 font-mono">
            Direct farmer-to-restaurant price protection
          </span>
        </div>

        {activeDeals.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-neutral-800 rounded-2xl bg-[#141d16]">
            <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-3" />
            <h4 className="text-sm font-bold text-white">No Distressed Batches At This Moment</h4>
            <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
              All farm transit vehicles are moving under nominal reefer conditions. When an incident or heat delay is simulated on the Logistics Control panel, live rescue deals will pop up here instantly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeDeals.map((deal) => (
              <div
                key={deal.id}
                className="deal-card p-5 rounded-2xl border border-orange-500/30 bg-gradient-to-b from-[#1b1c18] to-[#141a15] shadow-lg shadow-black/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold uppercase mb-1.5">
                        {deal.discount_percent}% OFF FLASH SALE
                      </span>
                      <h4 className="text-lg font-bold text-white">
                        {deal.quantity_kg} kg {deal.produce_type}
                      </h4>
                      <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
                        <Truck size={13} className="text-[#b3e875]" />
                        <span>Vehicle {deal.truck_id} · {deal.driver_name}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-neutral-500 line-through block font-mono">
                        ${deal.original_price?.toLocaleString()}
                      </span>
                      <span className="text-xl font-bold text-orange-400 font-mono block">
                        ${deal.flash_price?.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        ${deal.unit_price_flash}/kg
                      </span>
                    </div>
                  </div>

                  {/* Location & Distance */}
                  <div className="mt-4 p-3 rounded-xl bg-black/40 border border-neutral-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="flex items-center gap-1 text-neutral-400">
                        <MapPin size={13} className="text-red-400" />
                        <span>Current Location:</span>
                      </span>
                      <strong className="font-mono text-white">
                        {deal.location_name}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="flex items-center gap-1 text-neutral-400">
                        <Store size={13} className="text-[#b3e875]" />
                        <span>Distance From You:</span>
                      </span>
                      <strong className="font-mono text-emerald-400">
                        {deal.distance_km} km away
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="flex items-center gap-1 text-neutral-400">
                        <Clock size={13} className="text-amber-400" />
                        <span>Time To Claim:</span>
                      </span>
                      <strong className="font-mono text-amber-300">
                        {deal.remaining_hours} hrs shelf life left
                      </strong>
                    </div>
                  </div>

                  {/* Quality rating */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                    <span>Produce Freshness:</span>
                    <span className="text-amber-400 font-bold">
                      {deal.quality_percent?.toFixed(1)}% (Good for immediate cooking)
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-neutral-800">
                  <button
                    type="button"
                    disabled={claimingId === deal.id}
                    onClick={() => handleClaim(deal.id)}
                    className="primary-button !mt-0 !bg-gradient-to-r !from-orange-400 !to-amber-300 !text-black !font-bold hover:!brightness-110 flex items-center justify-center gap-2 shadow-md shadow-orange-950/40"
                  >
                    <Utensils size={15} />
                    <span>
                      {claimingId === deal.id
                        ? "Reserving Batch..."
                        : `Claim Batch as ${selectedBuyer.split(" ")[0]} ($${deal.flash_price})`}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CLAIMED DEALS ARCHIVE */}
      {claimedDeals.length > 0 && (
        <div className="mt-8 pt-6 border-t border-neutral-800/80">
          <h3 className="text-xs font-bold text-neutral-400 tracking-wide uppercase font-mono mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            Recently Claimed Distress Rescues ({claimedDeals.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {claimedDeals.map((cd) => (
              <div
                key={cd.id}
                className="p-3.5 rounded-xl bg-[#141d16] border border-neutral-800 text-xs flex items-center justify-between"
              >
                <div>
                  <h5 className="font-bold text-white">
                    {cd.quantity_kg}kg {cd.produce_type}
                  </h5>
                  <p className="text-[11px] text-neutral-400">
                    Claimed by: <span className="text-emerald-300">{cd.claimed_by}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-400 block">
                    ${cd.flash_price}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {cd.claimed_at || "Claimed"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
