import json
import requests
from backend.config import Config

class SeverityAgent:
    """
    Severity Agent evaluates the urgency and potential hazard of a civic report.
    It returns:
    - severity: a float between 1.0 (lowest) and 10.0 (critical, life-threatening)
    - reasoning: a short text summary explaining the score
    """

    @classmethod
    async def score_severity(cls, category: str, description: str) -> dict:
        """
        Calculates severity of the reported issue.
        High priorities:
        - Emergency -> 9.0 to 10.0
        - Stray Animal (Injured) -> 6.0 to 8.0
        - Garbage (Hazardous / Blocking) -> 3.0 to 6.0
        - Pothole (Deep / Major road) -> 2.0 to 5.0
        """
        # Define rule-based baseline scores
        baselines = {
            "emergency": 9.5,
            "animal": 7.0,
            "garbage": 4.0,
            "pothole": 3.0,
            "other": 2.0
        }
        
        baseline_score = baselines.get(category, 2.0)
        
        # Word modifiers for fallback
        description_lower = description.lower()
        modifier = 0.0
        if any(w in description_lower for w in ["severe", "critical", "danger", "dying", "blood", "accident"]):
            modifier += 1.5
        if any(w in description_lower for w in ["highway", "main road", "traffic", "school"]):
            modifier += 1.0
        if any(w in description_lower for w in ["minor", "small", "side road", "colony"]):
            modifier -= 1.0

        fallback_score = max(1.0, min(10.0, baseline_score + modifier))
        fallback_reasoning = f"Rule-based baseline for {category} with text-matching modifier."

        fallback_result = {
            "severity": float(fallback_score),
            "reasoning": fallback_reasoning
        }

        # Skip API if key missing
        if not Config.GROQ_API_KEY:
            return fallback_result

        # Request detailed scoring from Groq LLM
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {Config.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        prompt_text = (
            "You are a civic hazard severity assessment agent. "
            "Evaluate the severity of this civic complaint on a scale from 1.0 (very low, minor annoyance) "
            "to 10.0 (extremely critical, high hazard, risk to human life, active emergency). "
            f"Category: '{category}'. "
            f"Description: '{description}'. "
            "Provide the output as a JSON object containing keys: "
            "'severity' (float between 1.0 and 10.0), and 'reasoning' (short, 1-sentence explanation of the score)."
        )
        
        payload = {
            "model": "llama-3.3-70b-specdec",
            "messages": [{"role": "user", "content": prompt_text}],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            if response.status_code == 200:
                data = response.json()
                ai_content = data["choices"][0]["message"]["content"]
                result = json.loads(ai_content)
                severity = float(result.get("severity", fallback_score))
                reasoning = result.get("reasoning", fallback_reasoning)
                # Keep within bounds
                severity = max(1.0, min(10.0, severity))
                return {
                    "severity": severity,
                    "reasoning": reasoning
                }
        except Exception as e:
            print(f"[SeverityAgent] Severity API error: {e}")
            
        return fallback_result
