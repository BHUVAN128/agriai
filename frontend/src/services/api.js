const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  return payload;
}

export const getOptions = () => request("/api/v1/options");

export const createRoute = (shipment) =>
  request("/api/v1/route", { method: "POST", body: JSON.stringify(shipment) });

export const optimizeInitialRoute = (params) =>
  request("/api/v1/optimize-initial-route", {
    method: "POST",
    body: JSON.stringify(params),
  });

export const simulateIncident = (incident) =>
  request("/api/v1/simulate", { method: "POST", body: JSON.stringify(incident) });

export const sendVoiceCommand = (text, shipment) =>
  request("/api/v1/voice-command", {
    method: "POST",
    body: JSON.stringify({ text, shipment }),
  });

export const getFarmerAlerts = () => request("/api/v1/farmer-alerts");

export const ackFarmerAlert = (alert_id, action) =>
  request("/api/v1/farmer-alerts/ack", {
    method: "POST",
    body: JSON.stringify({ alert_id, action }),
  });

export const createDriverAlert = (alertData) =>
  request("/api/v1/farmer-alerts/create", {
    method: "POST",
    body: JSON.stringify(alertData),
  });

export const getFlashDeals = () => request("/api/v1/flash-deals");

export const claimFlashDeal = (deal_id, buyer_name) =>
  request("/api/v1/flash-deals/claim", {
    method: "POST",
    body: JSON.stringify({ deal_id, buyer_name }),
  });

export const rerouteTruck = (data) =>
  request("/api/v1/reroute", {
    method: "POST",
    body: JSON.stringify(data),
  });
