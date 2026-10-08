import { useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";

export default function VoiceUI({ onCommand, busy }) {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const recognitionRef = useRef(null);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function toggleListening() {
    if (!SpeechRecognition) {
      setMessage("Speech recognition is not available in this browser. Type the incident instead.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setText(event.results[0][0].transcript);
      setMessage("");
    };
    recognition.onerror = () => {
      setMessage("Could not capture speech. Check microphone permission or type a command.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    setMessage("");
    try {
      const result = await onCommand(text.trim());
      if ("speechSynthesis" in window && result?.summary) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(result.summary));
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <form className="voice-box" onSubmit={submit}>
      <div className="voice-heading">
        <span className="voice-icon"><Mic size={17} /></span>
        <div><strong>Voice incident report</strong><small>Try “30 minute delay, 34°C at Node B”</small></div>
      </div>
      <div className="voice-entry">
        <button className={`mic-button ${listening ? "is-listening" : ""}`} type="button" onClick={toggleListening} aria-label={listening ? "Stop listening" : "Start voice recognition"}>
          {listening ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Describe a delay or temperature spike…" aria-label="Incident command" />
        <button className="send-button" type="submit" disabled={busy || !text.trim()} aria-label="Submit incident"><Send size={16} /></button>
      </div>
      {message && <p className="inline-error">{message}</p>}
      <p className="voice-footnote">{SpeechRecognition ? "Browser speech recognition ready" : "Speech recognition unavailable · text input still works"}</p>
    </form>
  );
}

