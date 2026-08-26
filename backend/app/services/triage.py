"""
AI-assisted Digital Triage Service for Rural Public Healthcare with Local LLM & Hard Safety Guardrails.
Supporting Maharashtra Public Health Infrastructure (Aarogya Vibhag) with Multilingual Voice Triage (Marathi, Hindi, English, etc.).

Architecture:
Patient voice -> Speech-to-Text (Whisper/WebSpeech) -> Local LLM (Ollama Llama-3 / Qwen) -> 
Rule-Based Safety Layer -> Risk Level (LOW, MEDIUM, HIGH, EMERGENCY) -> Recommended Action -> PHC/Doctor Alert

Design Boundary:
This module NEVER diagnoses a disease or outputs a medical prescription. It structures free-text/voice
symptom input across Indian languages into standard clinical risk strata, applies strict deterministic
emergency rules, and generates localized spoken feedback.
"""
import os
import re
import json
import urllib.request
import urllib.error
from typing import Tuple, List, Dict, Any

# ---------------------------------------------------------
# HARD EMERGENCY & HIGH-PRIORITY RED-FLAG KEYWORDS (SAFETY LAYER)
# ---------------------------------------------------------
EMERGENCY_RED_FLAGS = [
    # English
    "chest pain", "severe bleeding", "unconscious", "not breathing", "cannot breathe",
    "seizure", "stroke", "severe burn", "poisoning", "suicide", "snake bite", "heart attack", "choking",
    # Marathi (महाराष्ट्र शासन सार्वजनिक आरोग्य)
    "छातीत तीव्र वेदना", "छातीत दुखणे", "रक्तस्राव", "बेभान", "शुद्ध हरपणे", "श्वास घेता येत नाही",
    "दम लागतोय", "फिट येणे", "झटके येणे", "सर्पदंश", "साव चावणे", "विषबाधा", "हृदयविकाराचा झटका", "अचेत",
    # Hindi
    "सीने में दर्द", "छाती में दर्द", "भारी रक्तस्राव", "बेहोश", "सांस नहीं ले पा रहा",
    "दौरा", "सांप का काटना", "जहर", "दिल का दौरा", "अचेत",
    # Tamil
    "மார்பு வலி", "கடுமையான இரத்தப்போக்கு", "மயக்கம்", "மூச்சு நின்றுவிட்டது", "வலிப்பு", "பாம்புக்கடி", "விஷம்", "மாரடைப்பு",
    # Telugu
    "గుండె నొప్పి", "ఛాతీ నొప్పి", "తీవ్ర రక్తస్రావం", "స్పృహ తప్పడం", "శ్వాస ఆడకపోవడం", "పాము కాటు", "విషం", "గుండెపోటు",
    # Bengali
    "বুকে ব্যথা", "অজ্ঞান", "শ্বাসকষ্ট তীব্র", "সাপের কামড়", "বিষক্রিয়া"
]

HIGH_PRIORITY_RED_FLAGS = [
    # English
    "high fever", "difficulty breathing", "severe pain", "blood in urine", "blood in stool",
    "pregnant", "labour", "labor", "dehydration", "fracture", "high blood pressure", "sugar very high",
    "blurry vision", "persistent vomiting",
    # Marathi
    "तीव्र ताप", "श्वास घेण्यास त्रास", "अतिशय वेदना", "लघवीतून रक्त", "गरोदर", "प्रसूती कळा",
    "हाड मोडणे", "रक्ताची उलटी", "अतिसार", "वारंवार उलट्या", "बीपी खूप जास्त",
    # Hindi
    "तेज बुखार", "सांस लेने में तकलीफ", "अत्यधिक दर्द", "गर्भवती", "प्रसव पीड़ा",
    "टूटी हड्डी", "खून की उल्टी", "चक्कर और उल्टी",
    # Tamil
    "கடுமையான காய்ச்சல்", "மூச்சுத்திணறல்", "பிரசவ வலி", "எலும்பு முறிவு", "கர்ப்பிணி",
    # Telugu
    "తీవ్రమైన జ్వరం", "శ్వాస తీసుకోవడంలో ఇబ్బంది", "తీవ్ర నొప్పి", "గర్భిణీ", "ప్రసవ నొప్పులు",
    # Bengali
    "প্রচণ্ড জ্বর", "শ্বাসকষ্ট", "প্রসব বেদনা", "অস্থিভঙ্গ"
]

MEDIUM_PRIORITY_TERMS = [
    # English
    "fever", "vomiting", "diarrhea", "infection", "swelling", "rash",
    "persistent cough", "dizziness", "burning urination", "headache", "stomach pain", "body pain",
    # Marathi
    "ताप", "उलटी", "जुलाब", "खोकला", "कफ", "डोकेदुखी", "पोटदुखी", "चक्कर", "अंगावर पुरळ", "अंगदुखी", "घसा दुखणे",
    # Hindi
    "बुखार", "उल्टी", "दस्त", "खांसी", "सिरदर्द", "पेट दर्द", "चक्कर", "दाने", "खुजली", "बदन दर्द",
    # Tamil
    "காய்ச்சல்", "வாந்தி", "வயிற்றுப்போக்கு", "இருமல்", "தலைவலி", "வயிற்று வலி", "தலைச்சுற்றல்", "உடல் வலி",
    # Telugu
    "జ్వరం", "వాంతులు", "విరేచనాలు", "దగ్గు", "తలనొప్పి", "కడుపు నొప్పి", "తలతిరుగుడు", "ఒంటి నొప్పులు",
    # Bengali
    "জ্বর", "বমি", "পাতলা পায়খানা", "কাশি", "মাথাব্যথা", "পেট ব্যথা"
]

# Standardized clinical symptom vocabulary
TAG_MAP = {
    "fever": ["fever", "ताप", "बुखार", "காய்ச்சல்", "జ్వరం", "জ্বর"],
    "cough": ["cough", "खोकला", "कफ", "खांसी", "இருமல்", "దగ్గు", "কাশি"],
    "headache": ["headache", "डोकेदुखी", "सिरदर्द", "தலைவலி", "తలనొప్పి", "মাথাব্যথা"],
    "vomiting": ["vomiting", "उलटी", "उल्टी", "வாந்தி", "వాంతులు", "বমি"],
    "diarrhea": ["diarrhea", "loose motion", "जुलाब", "दस्त", "வயிற்றுப்போக்கு", "విరేచనాలు", "পাতলা পায়খানা"],
    "chest pain": ["chest pain", "छातीत वेदना", "छातीत दुखणे", "सीने में दर्द", "மார்பு வலி", "గుండె నొప్పి", "বুকে ব্যথা"],
    "breathing difficulty": ["difficulty breathing", "breathless", "दम लागणे", "श्वास घेण्यास त्रास", "सांस में तकलीफ", "மூச்சுத்திணறல்", "శ్వాస ఇబ్బంది", "শ্বাসকষ্ট", "struggling to breathe"],
    "abdominal pain": ["stomach pain", "abdominal pain", "पोटदुखी", "पेट दर्द", "வயிற்று வலி", "కడుపు నొప్పి", "পেট ব্যথা"],
    "dizziness": ["dizziness", "fainting", "चक्कर", "தலைச்சுற்றல்", "తలతిరుగుడు"],
    "rash": ["rash", "पुरळ", "दाने", "சொறி", "దద్దుర్లు", "ত্বকের ফুসকুড়ি"],
    "pregnancy / maternal": ["pregnant", "pregnancy", "labour", "गरोदर", "प्रसूती", "गर्भवती", "प्रसव", "கர்ப்பிணி", "గర్భిణీ", "ప్రসব"]
}


def extract_duration(text: str) -> str:
    """Extracts duration mentions like '2 days', '1 week', '3 hours'."""
    match = re.search(r'(\d+\s*(?:days?|weeks?|hours?|months?|दिवस|दिवसांपासून|आठवडे|तास|दिन|घंटे|நாள்|நாட்களாக))', text, re.IGNORECASE)
    if match:
        return match.group(1)
    if "today" in text.lower() or "आज" in text or "இன்று" in text:
        return "today"
    return "acute (< 48 hrs)"


def extract_symptom_tags(text: str) -> List[str]:
    lower = text.lower()
    tags = []
    for standard_tag, keywords in TAG_MAP.items():
        if any(kw.lower() in lower for kw in keywords):
            tags.append(standard_tag)
    return tags


def symptoms_to_json(tags: List[str]) -> str:
    return json.dumps(tags)


def extract_warning_signs(text: str) -> List[str]:
    lower = text.lower()
    signs = []
    for red_flag in EMERGENCY_RED_FLAGS + HIGH_PRIORITY_RED_FLAGS:
        if red_flag.lower() in lower:
            signs.append(red_flag)
    return list(dict.fromkeys(signs))  # preserve uniqueness


def generate_spoken_guidance(raw_text: str, language: str, risk_level: str, action: str, reason: str) -> str:
    """Generates natural spoken audio script in the patient's intake voice language."""
    lang = (language or "mr").lower()

    if lang.startswith("mr"):
        risk_mr = {
            "emergency": "अतितातडीची आपत्कालीन स्थिती 🔴",
            "high": "उच्च प्राधान्य जोखीम 🟠",
            "medium": "मध्यम जोखीम 🟡",
            "low": "कमी जोखीम / सामान्य 🟢"
        }.get(risk_level.lower(), "वैद्यकीय सल्ला")
        return f"नोंदवलेली लक्षणे: {raw_text}. AI जोखीम पातळी: {risk_mr}. शिफारस केलेली कृती: {action}."

    elif lang.startswith("hi"):
        risk_hi = {"emergency": "आपातकालीन स्तर 🔴", "high": "उच्च प्राथमिकता 🟠", "medium": "मध्यम स्तर 🟡", "low": "सामान्य स्तर 🟢"}.get(risk_level.lower(), "चिकित्सा सलाह")
        return f"दर्ज लक्षण: {raw_text}। AI जोखिम स्तर: {risk_hi}। अनुशंसित कदम: {action}।"

    elif lang.startswith("ta"):
        risk_ta = {"emergency": "அவசர நிலை 🔴", "high": "உயர் முன்னுரிமை 🟠", "medium": "மிதமான நிலை 🟡", "low": "குறைந்த முன்னுரிமை 🟢"}.get(risk_level.lower(), "மருத்துவ ஆலோசனை")
        return f"பதிவு செய்யப்பட்ட அறிகுறிகள்: {raw_text}. AI இடர் நிலை: {risk_ta}. பரிந்துரைக்கப்பட்ட நடவடிக்கை: {action}."

    elif lang.startswith("te"):
        risk_te = {"emergency": "అత్యవసర స్థాయి 🔴", "high": "అధిక ప్రాధాన్యత 🟠", "medium": "మధ్యస్థ స్థాయి 🟡", "low": "సాధారణ స్థాయి 🟢"}.get(risk_level.lower(), "వైద్య సలహా")
        return f"నమోదైన లక్షణాలు: {raw_text}. AI ప్రమాద స్థాయి: {risk_te}. సిఫార్సు చేయబడిన చర్య: {action}."

    else:
        return f"Recorded symptoms: {raw_text}. Triage Risk Level: {risk_level.upper()}. Recommended Action: {action}."


# ---------------------------------------------------------
# LOCAL LLM INVOCATION (Ollama / LocalAI / LM Studio)
# ---------------------------------------------------------
_CACHED_OLLAMA_MODEL = None

def get_active_ollama_model() -> str:
    """Auto-detects the locally installed Ollama model from http://localhost:11434/api/tags."""
    global _CACHED_OLLAMA_MODEL
    if _CACHED_OLLAMA_MODEL:
        return _CACHED_OLLAMA_MODEL

    env_model = os.getenv("LOCAL_LLM_MODEL")
    if env_model:
        _CACHED_OLLAMA_MODEL = env_model
        return env_model

    try:
        req = urllib.request.Request("http://localhost:11434/api/tags")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = [m.get("name", "") for m in data.get("models", [])]
            if models:
                _CACHED_OLLAMA_MODEL = models[0]
                return _CACHED_OLLAMA_MODEL
    except Exception:
        pass

    _CACHED_OLLAMA_MODEL = "llama3.2:latest"
    return _CACHED_OLLAMA_MODEL


def query_local_llm(raw_text: str, language: str) -> Tuple[bool, Dict[str, Any], str]:
    """
    Queries local Ollama LLM with dynamic model resolution, JSON format, and clinical prompt.
    Returns (success, parsed_dict, model_name).
    """
    active_model = get_active_ollama_model()
    ollama_url = os.getenv("LOCAL_LLM_URL", "http://localhost:11434/api/generate")

    prompt = (
        "You are SwasthyaSetu Clinical Triage AI for Indian rural public healthcare (Government of Maharashtra). "
        "Do NOT diagnose diseases. Do NOT prescribe medication. "
        f"Patient input ({language}): \"{raw_text}\".\n"
        "Return ONLY a valid JSON object matching this schema:\n"
        "{\n"
        '  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY",\n'
        '  "symptoms": ["string"],\n'
        '  "duration": "string",\n'
        '  "severity": "mild" | "moderate" | "severe",\n'
        '  "warning_signs": ["string"],\n'
        '  "recommended_action": "string",\n'
        '  "confidence": 0.95,\n'
        '  "reason": "string"\n'
        "}"
    )

    payload = {
        "model": active_model,
        "prompt": prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 120
        }
    }

    try:
        req = urllib.request.Request(
            ollama_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw_response = data.get("response", "{}")
            parsed = json.loads(raw_response)
            if "risk_level" in parsed and "symptoms" in parsed:
                return True, parsed, active_model
    except Exception:
        pass

    return False, {}, active_model


# ---------------------------------------------------------
# STRUCTURED CLINICAL DIGITAL TRIAGE ENGINE
# ---------------------------------------------------------
def run_triage(raw_text: str, language: str = "mr") -> Dict[str, Any]:
    """
    Executes clinical risk triage pipeline matching architecture specification:
    Patient voice -> Speech-to-Text -> LLM -> Rule-Based Safety Layer -> Structured Output
    """
    raw_lower = raw_text.lower().strip()
    extracted_duration = extract_duration(raw_text)
    extracted_tags = extract_symptom_tags(raw_text)
    extracted_warning_signs = extract_warning_signs(raw_text)

    # 1. Attempt Local LLM Extraction
    llm_success, llm_data, model_name = query_local_llm(raw_text, language)

    if llm_success:
        llm_risk = str(llm_data.get("risk_level", "LOW")).lower()
        llm_symptoms = llm_data.get("symptoms", extracted_tags)
        llm_severity = str(llm_data.get("severity", "moderate")).lower()
        llm_action = llm_data.get("recommended_action", "PHC assessment")
        llm_confidence = float(llm_data.get("confidence", 0.92))
        llm_reason = llm_data.get("reason", "Local LLM triage assessment")
        engine_used = f"Local LLM (Ollama {model_name})"
    else:
        # Fallback to local edge clinical engine
        llm_risk = "low"
        llm_symptoms = extracted_tags
        llm_severity = "mild"
        llm_action = "Routine PHC consultation"
        llm_confidence = 0.88
        llm_reason = "Local offline clinical guardrail evaluation"
        engine_used = "Local Edge Clinical Guardrail Engine"

    # 2. DETERMINISTIC SAFETY LAYER OVERRIDE (Hard Safety Rules)
    final_risk = llm_risk
    final_severity = llm_severity
    final_action = llm_action
    final_reason = llm_reason

    # Rule A: Emergency Red Flags
    has_emergency_flag = any(ef.lower() in raw_lower for ef in EMERGENCY_RED_FLAGS)
    if has_emergency_flag:
        final_risk = "emergency"
        final_severity = "severe"
        final_action = "Immediate 108 Emergency Referral & District Hospital Specialist Dispatch"
        final_reason = "CRITICAL RED FLAG DETECTED (Immediate emergency stabilization required)"
        llm_confidence = 0.99

    # Rule B: High-Priority Clinical Warning Signs
    elif any(hf.lower() in raw_lower for hf in HIGH_PRIORITY_RED_FLAGS) or len(extracted_warning_signs) > 0:
        if final_risk not in ["emergency", "high"]:
            final_risk = "high"
            final_severity = "severe"
            final_action = "Prioritize immediate Primary Health Centre (PHC) Medical Officer assessment"
            final_reason = "High-priority clinical warning sign detected; escalated for doctor evaluation"
            llm_confidence = 0.95

    # Rule C: Medium Priority Assessment
    elif any(mf.lower() in raw_lower for mf in MEDIUM_PRIORITY_TERMS) or len(extracted_tags) > 0:
        if final_risk == "low":
            final_risk = "medium"
            final_severity = "moderate"
            final_action = "Schedule routine PHC consultation & symptomatic nursing care"
            final_reason = "Moderate acute symptoms identified; routine medical consultation advised"

    # Rule D: Default Low Risk
    if final_risk == "low":
        final_action = "Self-care guidance, hydration, and routine PHC visit if symptoms persist"
        final_reason = "Mild, self-limiting symptom pattern without clinical red flags"

    # Format translated text
    translated_text = f"[{language.upper()} Voice Input Analyzed]: {raw_text}"

    # Generate Spoken Audio Guidance
    spoken_guidance = generate_spoken_guidance(
        raw_text=raw_text,
        language=language,
        risk_level=final_risk,
        action=final_action,
        reason=final_reason
    )

    # Standard care levels
    care_level_map = {
        "emergency": "District Headquarters Hospital (ICU / Emergency Resuscitation)",
        "high": "Primary Health Centre (Urgent Medical Officer Assessment)",
        "medium": "Primary Health Centre (Routine OPD Consultation)",
        "low": "Sub-Centre / Health & Wellness Centre (Self-Care & ASHA Follow-up)"
    }
    care_level = care_level_map.get(final_risk, "PHC Consultation")

    return {
        "translated_text": translated_text,
        "structured_symptoms": json.dumps(llm_symptoms if llm_symptoms else ["general discomfort"]),
        "duration": extracted_duration,
        "severity": final_severity,
        "warning_signs": json.dumps(extracted_warning_signs),
        "confidence": llm_confidence,
        "urgency": final_risk,
        "care_level": care_level,
        "recommended_action": final_action,
        "ai_notes": f"[{final_risk.upper()}] {final_reason}. Recommended Action: {final_action}.",
        "engine_used": engine_used,
        "spoken_guidance": spoken_guidance,
    }
