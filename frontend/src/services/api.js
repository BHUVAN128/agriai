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

export const simulateIncident = (incident) =>
  request("/api/v1/simulate", { method: "POST", body: JSON.stringify(incident) });

export const sendVoiceCommand = (text, shipment) =>
  request("/api/v1/voice-command", {
    method: "POST",
    body: JSON.stringify({ text, shipment }),
  });

