import unittest
from unittest.mock import patch

from agents.decision_agent import evaluate_incident
from agents.flash_sale_agent import create_flash_sale
from agents.route_agent import load_network, solve_route
from agents.spoilage_agent import calculate_quality, estimate_remaining_shelf_life_hours
from agents.voice_agent import _local_parse
from main import (
    IncidentRequest,
    ShipmentRequest,
    VoiceRequest,
    create_route,
    get_options,
    simulate,
    voice_command,
)


class SpoilageAgentTests(unittest.TestCase):
    def test_quality_decreases_with_time_and_temperature(self):
        cool = calculate_quality("Tomatoes", 1, 10)
        hot = calculate_quality("Tomatoes", 1, 34)
        self.assertGreater(cool, hot)
        self.assertLess(hot, 100)

    def test_shelf_life_is_zero_below_threshold(self):
        self.assertEqual(estimate_remaining_shelf_life_hours("Apples", 40, 20), 0)


class RouteAgentTests(unittest.TestCase):
    def test_ortools_returns_expected_route_endpoints(self):
        route = solve_route("farm_pune", "market_nashik", produce_type="Tomatoes")
        self.assertEqual(route["nodes"][0]["id"], "farm_pune")
        self.assertEqual(route["nodes"][-1]["id"], "market_nashik")
        self.assertGreater(route["eta_minutes"], 0)
        self.assertGreater(route["distance_km"], 0)


class DecisionAgentTests(unittest.TestCase):
    def setUp(self):
        self.network = load_network()
        self.incident_node = next(
            node for node in self.network["waypoints"] if node["id"] == "Node_B"
        )

    def test_mid_quality_selects_nearest_cold_storage(self):
        decision = evaluate_incident(65, self.incident_node, self.network)
        self.assertEqual(decision["tier"], 2)
        self.assertEqual(decision["action"], "cold_storage")
        self.assertEqual(decision["destination"]["type"], "cold_storage")
        self.assertTrue(decision["intercept_required"])

    def test_low_quality_activates_flash_sale(self):
        decision = evaluate_incident(50, self.incident_node, self.network)
        self.assertEqual(decision["tier"], 3)
        self.assertEqual(decision["action"], "flash_sale")
        self.assertIsNone(decision["destination"])

    def test_high_quality_uses_secondary_market_without_emergency_flag(self):
        decision = evaluate_incident(80, self.incident_node, self.network)
        self.assertEqual(decision["tier"], 1)
        self.assertEqual(decision["action"], "secondary_market")
        self.assertFalse(decision["intercept_required"])


class FlashSaleAndVoiceTests(unittest.TestCase):
    def test_flash_sale_discount_and_geofence(self):
        network = load_network()
        location = next(node for node in network["waypoints"] if node["id"] == "Node_B")
        sale = create_flash_sale(
            "Tomatoes", 48, 1800, location, network["buyers"], 2.0
        )
        self.assertEqual(sale["discount_percent"], 52.0)
        self.assertEqual(sale["alerts_sent"], len(sale["buyers"]))
        self.assertTrue(all(buyer["distance_km"] <= 3.5 for buyer in sale["buyers"]))

    def test_local_parser_extracts_incident_fields(self):
        incident = _local_parse("Report 30 min delay and 34°C heat at Node B")
        self.assertEqual(incident, {
            "delay_mins": 30,
            "temp_celsius": 34.0,
            "node_id": "Node_B",
        })


class ApiTests(unittest.TestCase):
    def test_options_and_route_endpoints(self):
        self.assertTrue(get_options()["farms"])
        route = create_route(ShipmentRequest(
            farm_id="farm_pune",
            target_market_id="market_pune",
            produce_type="Tomatoes",
            capacity_kg=1000,
        ))
        self.assertEqual(route["route_status"], "safe")
        self.assertEqual(route["nodes"][-1]["id"], "market_pune")

    def test_simulation_returns_recovery_metrics_and_route(self):
        payload = simulate(IncidentRequest(
            farm_id="farm_pune",
            target_market_id="market_nashik",
            produce_type="Tomatoes",
            capacity_kg=1000,
            delay_mins=180,
            temp_celsius=45,
            node_id="Node_B",
        ))
        self.assertEqual(payload["decision"]["action"], "flash_sale")
        self.assertIsNotNone(payload["flash_sale"])
        self.assertGreaterEqual(payload["flash_sale"]["discount_percent"], 40)
        self.assertLessEqual(payload["flash_sale"]["discount_percent"], 60)
        self.assertEqual(payload["loss_prevented"], payload["value_saved"])

    @patch.dict("os.environ", {"GROK_API_KEY": ""})
    def test_voice_endpoint_uses_local_parser_without_api_key(self):
        response = voice_command(VoiceRequest(
            text="Report 30 min delay and 34°C heat at Node B",
            shipment=ShipmentRequest(
                farm_id="farm_pune",
                target_market_id="market_pune",
                produce_type="Apples",
                capacity_kg=500,
            ),
        ))
        self.assertEqual(response["incident"]["node_id"], "Node_B")
        self.assertIn("summary", response)


if __name__ == "__main__":
    unittest.main()
