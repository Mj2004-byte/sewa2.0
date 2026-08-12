import os
import base64
import json
import requests
from backend.config import Config

class ClassificationAgent:
    """
    Classification Agent inspects reports using configured Groq vision and reasoning models.
    Supports:
    1. Pre-pipeline Content Moderation: verifies media plausibly depicts a civic issue.
    2. Vision Classification: calls Config.VISION_MODEL ("qwen/qwen3.6-27b").
    3. Robust Fallback Path: if vision fails or confidence is low, falls back to text reasoning via Config.REASONING_MODEL.
    """
    
    @staticmethod
    def _encode_image(image_path: str) -> str:
        """Helper to read and base64-encode an image file."""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")

    @classmethod
    def transcribe_audio_with_groq(cls, audio_path: str) -> str:
        """Transcribes audio files using Groq whisper model."""
        if not Config.GROQ_API_KEY:
            return "Audio note: Issue reported via voice recording."
            
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {Config.GROQ_API_KEY}"}
        
        try:
            with open(audio_path, "rb") as audio_file:
                files = {
                    "file": (os.path.basename(audio_path), audio_file, "audio/mpeg"),
                    "model": (None, "whisper-large-v3")
                }
                response = requests.post(url, headers=headers, files=files, timeout=15)
                if response.status_code == 200:
                    return response.json().get("text", "")
        except Exception as e:
            print(f"[ClassificationAgent] Audio transcription exception: {e}")
            
        return "Audio filing recorded."

    @classmethod
    async def classify_report(cls, media_path: str, media_type: str, user_caption: str = "") -> dict:
        """
        Runs moderation check and media classification.
        Returns:
        {
          "category": "pothole" | "garbage" | "animal" | "emergency" | "other" | "flagged",
          "description": str,
          "confidence": float,
          "is_flagged": bool
        }
        """
        # Keyword-based heuristics fallback
        fallback_category = "other"
        caption_lower = user_caption.lower()
        if any(w in caption_lower for w in ["pothole", "road", "crater", "tarmac"]):
            fallback_category = "pothole"
        elif any(w in caption_lower for w in ["garbage", "trash", "sanitation", "waste", "dump"]):
            fallback_category = "garbage"
        elif any(w in caption_lower for w in ["dog", "cat", "cow", "animal", "injured", "stray"]):
            fallback_category = "animal"
        elif any(w in caption_lower for w in ["fire", "smoke", "accident", "electricity", "blast"]):
            fallback_category = "emergency"

        fallback_result = {
            "category": fallback_category,
            "description": user_caption or f"Civic report submitted via {media_type}.",
            "confidence": 0.70,
            "is_flagged": False
        }

        # If API key is not configured or missing, return rule fallback
        if not Config.GROQ_API_KEY or "your_groq" in Config.GROQ_API_KEY:
            print("[ClassificationAgent] API key not configured. Using rule-based fallback.")
            return fallback_result

        img_b64 = ""
        transcription_text = ""

        if media_type == "image":
            img_b64 = cls._encode_image(media_path)
        elif media_type == "audio" or media_type == "video":
            transcription_text = cls.transcribe_audio_with_groq(media_path)

        # 1. Primary Multimodal Vision Call using Config.VISION_MODEL
        if img_b64:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {Config.GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            
            prompt_text = (
                "You are an automated intake classifier for the Sewa civic platform. "
                "Inspect the image and user caption. "
                "First, evaluate moderation: does this image depict a plausible civic issue (pothole, garbage dump, injured stray animal, fire/emergency, broken street light)? "
                "If it is completely irrelevant spam, self-portrait/selfie, or abusive content, set category to 'flagged'. "
                "Otherwise, categorize into EXACTLY ONE of: 'pothole', 'garbage', 'animal', 'emergency', or 'other'. "
                f"User text note: '{user_caption}'. "
                "Return JSON with keys: 'category', 'description', 'confidence' (float 0.0-1.0), and 'is_flagged' (boolean)."
            )

            payload = {
                "model": Config.VISION_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_text},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                        ]
                    }
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1
            }
            
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=20)
                if response.status_code == 200:
                    result = json.loads(response.json()["choices"][0]["message"]["content"])
                    cat = result.get("category", "other")
                    conf = float(result.get("confidence", 0.9))
                    
                    if cat in ["pothole", "garbage", "animal", "emergency", "other", "flagged"]:
                        # If confidence is high, accept vision result immediately
                        if conf >= 0.60 or cat == "flagged":
                            return {
                                "category": cat,
                                "description": result.get("description", user_caption),
                                "confidence": conf,
                                "is_flagged": result.get("is_flagged", cat == "flagged")
                            }
                        else:
                            print(f"[ClassificationAgent] Vision confidence low ({conf:.2f}). Triggering secondary text reasoning pass...")
                else:
                    print(f"[ClassificationAgent] Vision API model {Config.VISION_MODEL} returned {response.status_code}. Falling back to reasoning model.")
            except Exception as e:
                print(f"[ClassificationAgent] Vision call exception: {e}. Falling back to reasoning pass.")

        # 2. Secondary Fallback Reasoning Pass using Config.REASONING_MODEL
        if transcription_text or user_caption:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {Config.GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            
            prompt_text = (
                "You are an AI civic intake classifier. "
                "Analyze the text filing and transcripts. "
                "Categorize into EXACTLY ONE of: 'pothole', 'garbage', 'animal', 'emergency', 'other', or 'flagged'. "
                f"Text input: '{user_caption}'. Audio transcript: '{transcription_text}'. "
                "Return JSON with keys: 'category', 'description', 'confidence' (float 0.0-1.0), and 'is_flagged' (boolean)."
            )
            
            payload = {
                "model": Config.REASONING_MODEL,
                "messages": [{"role": "user", "content": prompt_text}],
                "response_format": {"type": "json_object"},
                "temperature": 0.2
            }
            
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=15)
                if response.status_code == 200:
                    result = json.loads(response.json()["choices"][0]["message"]["content"])
                    cat = result.get("category", fallback_category)
                    return {
                        "category": cat,
                        "description": result.get("description", user_caption or transcription_text),
                        "confidence": float(result.get("confidence", 0.8)),
                        "is_flagged": result.get("is_flagged", cat == "flagged")
                    }
            except Exception as e:
                print(f"[ClassificationAgent] Reasoning API exception: {e}")
                
        return fallback_result
