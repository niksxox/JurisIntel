"""
Template-based localization for chatbot responses. This is NOT machine
translation -- it's a phrase dictionary covering the fixed response templates
the chatbot uses, so the demo can genuinely respond in multiple languages
without an external translation API/key.

Free-text fields pulled from the database (names, brief facts, etc.) stay in
their original language (English, since that's what's in the FIR records)
even when the surrounding template is localized. Swapping this for a real
translation layer (e.g. an LLM call) later only means replacing `t()`.

Supported: English, Hindi, Kannada, Tamil, Telugu, Malayalam.
"""

LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "kn": "Kannada",
    "ta": "Tamil",
    "te": "Telugu",
    "ml": "Malayalam",
}

PHRASES = {
    "greeting": {
        "en": "Hello. Ask me about a case, an accused person, crime trends, or risk scores.",
        "hi": "नमस्ते। किसी मामले, आरोपी, अपराध प्रवृत्ति या जोखिम स्कोर के बारे में पूछें।",
        "kn": "ನಮಸ್ಕಾರ. ಪ್ರಕರಣ, ಆರೋಪಿ, ಅಪರಾಧ ಪ್ರವೃತ್ತಿ ಅಥವಾ ಅಪಾಯದ ಅಂಕ ಬಗ್ಗೆ ಕೇಳಿ.",
        "ta": "வணக்கம். வழக்கு, குற்றம் சாட்டப்பட்டவர், குற்றப் போக்குகள் அல்லது ஆபத்து மதிப்பெண் பற்றி கேளுங்கள்.",
        "te": "నమస్కారం. కేసు, నిందితుడు, నేర ధోరణులు లేదా రిస్క్ స్కోరు గురించి అడగండి.",
        "ml": "നമസ്കാരം. കേസ്, പ്രതി, ക്രൈം ട്രെൻഡുകൾ അല്ലെങ്കിൽ റിസ്ക് സ്കോർ എന്നിവയെക്കുറിച്ച് ചോദിക്കുക.",
    },
    "no_match": {
        "en": "I couldn't match that to a person or case in the database. Try a name, or a phrase like 'cases in Mysuru last month'.",
        "hi": "मुझे डेटाबेस में कोई मेल नहीं मिला। कोई नाम आज़माएं, या 'मैसूरु में पिछले महीने के मामले' जैसा वाक्य।",
        "kn": "ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ಹೊಂದಾಣಿಕೆ ಸಿಗಲಿಲ್ಲ. ಹೆಸರು ಅಥವಾ 'ಮೈಸೂರಿನಲ್ಲಿ ಕಳೆದ ತಿಂಗಳ ಪ್ರಕರಣಗಳು' ಎಂದು ಪ್ರಯತ್ನಿಸಿ.",
        "ta": "தரவுத்தளத்தில் பொருத்தம் இல்லை. ஒரு பெயரை அல்லது 'மைசூரில் கடந்த மாத வழக்குகள்' போன்ற சொற்றொடரை முயற்சிக்கவும்.",
        "te": "డేటాబేస్‌లో సరిపోలిక కనబడలేదు. ఒక పేరు లేదా 'మైసూరులో గత నెల కేసులు' వంటి పదబంధాన్ని ప్రయత్నించండి.",
        "ml": "ഡാറ്റാബേസിൽ പൊരുത്തം കണ്ടെത്തിയില്ല. ഒരു പേര് അല്ലെങ്കിൽ 'മൈസൂരുവിൽ കഴിഞ്ഞ മാസത്തെ കേസുകൾ' എന്ന് ശ്രമിക്കുക.",
    },
    "profile_intro": {
        "en": "Record match found for {name}.",
        "hi": "{name} के लिए रिकॉर्ड मिला।",
        "kn": "{name} ಗಾಗಿ ದಾಖಲೆ ಹೊಂದಾಣಿಕೆ ಕಂಡುಬಂದಿದೆ.",
        "ta": "{name} க்கான பதிவு பொருத்தம் கிடைத்தது.",
        "te": "{name} కోసం రికార్డు సరిపోలిక కనుగొనబడింది.",
        "ml": "{name} ന് രേഖാ പൊരുത്തം കണ്ടെത്തി.",
    },
    "risk_summary": {
        "en": "Risk level: {band} ({score}/100). {count} linked case(s) on file.",
        "hi": "जोखिम स्तर: {band} ({score}/100)। रिकॉर्ड में {count} जुड़े मामले।",
        "kn": "ಅಪಾಯದ ಮಟ್ಟ: {band} ({score}/100). ದಾಖಲೆಯಲ್ಲಿ {count} ಸಂಬಂಧಿತ ಪ್ರಕರಣಗಳು.",
        "ta": "ஆபத்து நிலை: {band} ({score}/100). பதிவில் {count} தொடர்புடைய வழக்குகள்.",
        "te": "రిస్క్ స్థాయి: {band} ({score}/100). రికార్డులో {count} సంబంధిత కేసులు.",
        "ml": "റിസ്ക് നില: {band} ({score}/100). രേഖയിൽ {count} ബന്ധപ്പെട്ട കേസുകൾ.",
    },
    "search_results": {
        "en": "Found {count} matching case(s). {explanation}",
        "hi": "{count} मामले मिले। {explanation}",
        "kn": "{count} ಪ್ರಕರಣಗಳು ಕಂಡುಬಂದಿವೆ. {explanation}",
        "ta": "{count} வழக்குகள் கிடைத்தன. {explanation}",
        "te": "{count} కేసులు కనుగొనబడ్డాయి. {explanation}",
        "ml": "{count} കേസുകൾ കണ്ടെത്തി. {explanation}",
    },
}


def t(key: str, lang: str = "en", **kwargs) -> str:
    lang = lang if lang in LANGUAGES else "en"
    template = PHRASES.get(key, {}).get(lang) or PHRASES.get(key, {}).get("en", "")
    try:
        return template.format(**kwargs)
    except Exception:
        return template
