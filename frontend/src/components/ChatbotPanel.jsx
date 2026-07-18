import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";

const LANGUAGES = [
  { code: "en", label: "English", speech: "en-IN" },
  { code: "hi", label: "Hindi", speech: "hi-IN" },
  { code: "kn", label: "Kannada", speech: "kn-IN" },
  { code: "ta", label: "Tamil", speech: "ta-IN" },
  { code: "te", label: "Telugu", speech: "te-IN" },
  { code: "ml", label: "Malayalam", speech: "ml-IN" },
];

function nowStamp() {
  return new Date().toLocaleString();
}

export default function ChatbotPanel({ onSelectCase }) {
  const [language, setLanguage] = useState("en");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hello. Ask me about a case, an accused person, crime trends, or risk scores.", timestamp: nowStamp(), meta: {} },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANGUAGES.find((l) => l.code === language)?.speech || "en-IN";
    }
  }, [language]);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = LANGUAGES.find((l) => l.code === language)?.speech || "en-IN";
    window.speechSynthesis.speak(utter);
  };

  const send = async (overrideText) => {
    const text = overrideText ?? input;
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", text, timestamp: nowStamp(), meta: {} };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const res = await api.chat(text, history, language);
      const botMsg = {
        role: "assistant",
        text: res.reply,
        timestamp: nowStamp(),
        meta: res.meta || {},
        referencedCaseIds: res.referenced_case_ids || [],
        profile: res.profile || null,
      };
      setMessages((m) => [...m, botMsg]);
      speak(res.reply);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${e.message}`, timestamp: nowStamp(), meta: {} }]);
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = async () => {
    try {
      const blob = await api.chatPdf(messages, language);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "chat_transcript.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("PDF export failed: " + e.message);
    }
  };

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", height: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p className="panel-title" style={{ margin: 0 }}>AI case assistant</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button className="btn secondary" onClick={exportPdf}>Export chat (PDF)</button>
        </div>
      </div>

      {!speechSupported && (
        <p style={{ fontSize: 11, color: "#5a6786", marginBottom: 8 }}>
          Voice input isn't supported in this browser — try Chrome for the mic button.
        </p>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "78%" }}>
            <div style={{
              background: m.role === "user" ? "#1c2c4a" : "#16203a",
              border: `1px solid ${m.role === "user" ? "#2a3d66" : "#24304a"}`,
              borderRadius: 10,
              padding: "10px 13px",
              fontSize: 13.5,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}>
              {m.text}
            </div>
            {m.referencedCaseIds?.length > 0 && (
              <div className="chip-row" style={{ marginTop: 6 }}>
                {m.referencedCaseIds.slice(0, 8).map((id) => (
                  <span key={id} className="chip" style={{ cursor: "pointer" }} onClick={() => onSelectCase(id)}>
                    Case #{id}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: "#5a6786", marginTop: 3 }}>{m.timestamp}</div>
          </div>
        ))}
        {loading && <div className="loading-line" style={{ textAlign: "left", padding: "4px 0" }}>THINKING...</div>}
      </div>

      <div className="nl-search" style={{ marginTop: 12, marginBottom: 0 }}>
        <button
          className="btn secondary"
          onClick={toggleListening}
          disabled={!speechSupported}
          style={{ background: listening ? "#c2554a22" : undefined, borderColor: listening ? "#c2554a" : undefined }}
          title="Voice input"
        >
          {listening ? "● Listening" : "🎤"}
        </button>
        <input
          type="text"
          placeholder='Try "who is Ravi Gowda?" or "cyber crime cases in Mysuru"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn" onClick={() => send()} disabled={loading}>Send</button>
      </div>
    </div>
  );
}
