import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

const SpeechRecognition = typeof window !== "undefined"
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export default function DriverVoiceUI({ onCommand, busy = false }) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [driverSaid, setDriverSaid] = useState("");
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const speak = (text) => {
    setReply(text);
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  async function startListening() {
    if (!SpeechRecognition) {
      setMessage("Voice recognition is not supported in this browser.");
      return;
    }
    try {
      window.speechSynthesis?.cancel();
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = async (event) => {
        const text = event.results[0][0].transcript.trim();
        setDriverSaid(text);
        setMessage("");
        try {
          const result = await onCommand(text);
          speak(result.reply);
        } catch (error) {
          setMessage(error.message || "Unable to process that command.");
        }
      };
      recognition.onerror = (event) => {
        setMessage(event.error === "not-allowed" ? "Allow microphone access to use voice commands." : "Could not hear that. Tap the microphone and try again.");
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setMessage("");
    } catch {
      setListening(false);
      setMessage("Could not start the microphone. Try again.");
    }
  }

  return (
    <section className="driver-voice panel" aria-label="Driver voice assistant">
      <div className="driver-voice-copy">
        <strong>Driver voice assistant</strong>
        <span>Tap once, speak a command, and hear the response.</span>
      </div>
      <button
        type="button"
        className={`driver-mic ${listening ? "is-listening" : ""} ${speaking ? "is-speaking" : ""}`}
        onClick={() => listening ? recognitionRef.current?.stop() : startListening()}
        disabled={busy}
        aria-label={listening ? "Stop listening" : "Start listening"}
      >
        {listening ? <MicOff size={30} /> : <Mic size={30} />}
        <span>{listening ? "Listening" : speaking ? "Speaking" : "Tap to speak"}</span>
      </button>
      <div className="driver-transcript" aria-live="polite">
        <p><b>Driver Said:</b> {driverSaid || "—"}</p>
        <p><b>Assistant Replying:</b> {reply || "—"}</p>
      </div>
      {message && <p className="inline-error" role="status">{message}</p>}
      {!SpeechRecognition && <p className="voice-footnote">Speech recognition is unavailable in this browser.</p>}
    </section>
  );
}
