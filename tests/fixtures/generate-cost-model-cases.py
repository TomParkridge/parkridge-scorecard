# Dumps the 20 simulated businesses and their run2() results to cost-model-cases.json, using
# docs/specs/scorecard-cost-model.py unchanged. src/scorecard/engine/cost-model.test.ts checks
# the TypeScript engine against the JSON.
# Run from anywhere: python3 tests/fixtures/generate-cost-model-cases.py
import contextlib
import importlib.util
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).with_name("cost-model-cases.json")

# The personas have no Q1 answers, but validation requires a pick. This one matches neither
# no-dollar-leak candidate, so it can never decide a tie.
CHALLENGES = ["growth_stalled"]

# Persona values -> option ids in src/scorecard/questions.ts. A value missing here raises KeyError.
LEADS = {"<10": "under_10", "10-25": "10_25", "25-50": "25_50", "50-100": "50_100", "100+": "100_plus"}
RESPONSE = {"5min": "5_min", "15min": "15_min", "hour": "1_hour", "same_day": "same_day", "1-2days": "1_2_days", "varies": "varies"}
FOLLOW_UP = {"once": "once_or_none", "2-3": "2_3", "4-6": "4_6", "7+": "7_plus", "NS": "not_sure"}
CLOSE = {"0-1": "0_1", "2-3": "2_3", "4-5": "4_5", "6+": "6_plus", "NS": "not_sure"}
VALUE = {"<500": "under_500", "500-2K": "500_2k", "2K-10K": "2k_10k", "10K-50K": "10k_50k", "50K+": "50k_plus"}
OLD_LEADS = {"regular": "regular", "now_then": "now_and_then", "rarely": "rarely_never", "no_list": "no_list"}
TRACKING = {"crm_connected": "crm_connected", "crm_fuzzy": "crm_fuzzy", "spreadsheet": "spreadsheet_inbox", "inbox": "spreadsheet_inbox"}
AI_LEVEL = {level: f"level_{level}" for level in range(6)}
SOURCES = {"Referrals": "referrals", "Paid ads": "paid_ads", "Organic search": "organic_search", "Social media": "social_media", "Outbound": "outbound", "Partners": "partners"}
SINKS = {sink: sink for sink in ("leads", "quotes", "followup", "crm", "scheduling", "reporting", "onboarding", "admin")}


def load_model():
    # The filename has hyphens, and the module prints its simulation on import.
    spec = importlib.util.spec_from_file_location("cost_model", ROOT / "docs/specs/scorecard-cost-model.py")
    module = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(module)
    return module


def case_for(persona, model):
    name, _staff, _industry, leads, response, follow_up, close, value, old_leads, tracking, ai_level, sources = persona
    result = model.run2(persona)
    return {
        "name": name,
        "surveyVersion": "insurance" if name in model.INSURANCE else "general",
        "answers": {
            "challenges": CHALLENGES,
            "lead_channels": [SOURCES[s] for s in sources],
            "monthly_leads": LEADS[leads],
            "response_speed": RESPONSE[response],
            "follow_up_attempts": FOLLOW_UP[follow_up],
            "close_rate": CLOSE[close],
            "customer_value": VALUE[value],
            "old_leads": OLD_LEADS[old_leads],
            "lead_tracking": TRACKING[tracking],
            "ai_level": AI_LEVEL[ai_level],
            "time_sinks": [SINKS[t] for t in model.SINKS[name]],
        },
        "expected": {k: result[k] for k in ("top", "lo", "hi", "plo", "phi", "status")},
    }


def main():
    model = load_model()
    cases = [case_for(p, model) for p in model.P]
    OUTPUT.write_text(json.dumps(cases, indent=2) + "\n")
    print(f"Wrote {len(cases)} cases to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
