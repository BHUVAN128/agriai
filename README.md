# AI Agri-Routing System (ADS)

**Team:** Genz Al · **Problem ID:** CODIENYCH-2026-0050

A full-stack prototype for planning produce deliveries, estimating temperature-driven quality decay, and simulating diversion or a local flash sale when a shipment is disrupted. The routing engine uses Google OR-Tools; the frontend is React/Vite with Leaflet.

> This demo uses fictional Pune-region locations, estimated distances and road times, mock buyer alerts, and estimated produce values. It does not connect to live GPS, maps routing, SMS, or push-notification providers.

## Requirements

- Python 3.11 or newer
- Node.js 18 or newer and npm
- Optional: a Grok API key for LLM-based voice-command extraction. The typed voice panel works without a key via a local parser.

## Start the backend

From `agri-padr-logistics/backend`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload
```

The API is at `http://localhost:8000`; interactive API documentation is at `http://localhost:8000/docs`.

## Start the frontend

In a second terminal, from `agri-padr-logistics/frontend`:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Vite proxies `/api` requests to the local FastAPI server.

## Configure Grok (optional)

Put the API key in **`backend/.env`**, not in a frontend file:

```dotenv
GROK_API_KEY=your_xai_api_key
GROK_MODEL=grok-3-mini
GROK_API_URL=https://api.x.ai/v1/chat/completions
ALLOWED_ORIGINS=http://localhost:5173
```

Restart the backend after changing `.env`. Keep `.env` private; it is ignored by Git. With no key configured, the local parser accepts a command containing a delay, temperature, and checkpoint, such as `Report 30 min delay and 34°C heat at Node B`. The browser's speech-recognition feature depends on browser support and microphone permission; text input remains available.

## Workflow

1. Select a farm, market, produce type, and load capacity; generate the baseline route.
2. Simulate a delay/heat event with the controls, or submit a typed/spoken incident.
3. The spoilage model applies `Q(t) = Q0 * exp(-λ * (1 + αT) * t)` (time in hours; temperature in °C).
4. The recovery policy chooses a secondary market above 75% quality, cold storage above 50% through 75%, or a flash sale at or below 50%. Interception is flagged below 70%.
5. The map and shipment-value estimates reflect the simulated response. Mock buyer alerts are created for buyers within 3.5 km; no real messages are sent.

## API endpoints

- `GET /api/v1/health` — service health
- `GET /api/v1/options` — mock network and produce options
- `POST /api/v1/route` — OR-Tools baseline route and arrival quality
- `POST /api/v1/simulate` — incident simulation and recovery decision
- `POST /api/v1/voice-command` — voice-text parsing and incident simulation
