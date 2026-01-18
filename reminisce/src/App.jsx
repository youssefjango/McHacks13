import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import 'regenerator-runtime/runtime';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useFaceRecognition } from './hooks/useFaceRecognition';
import { useGemini } from './hooks/useGemini';
import AdminPanel from './components/AdminPanel';
import PatientHUD from './components/PatientHUD';
import './index.css';

function App() {
  // --- STATE ---
  const [mode, setMode] = useState('ADMIN');

  // Patient State
  const [currentFace, setCurrentFace] = useState(null);
  const [lastEmotion, setLastEmotion] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  // Removed lastGreetingTime state

  // --- HOOKS ---
  const {
    modelsLoaded,
    knownFaces,
    addFace,
    detectFace,
    updateKnownFaces
  } = useFaceRecognition();

  const { getGreeting, processMemory } = useGemini();

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    browserSupportsContinuousListening
  } = useSpeechRecognition();

  // --- REFS ---
  const webcamRef = useRef(null);
  const recognitionInterval = useRef(null);
  const faceLossTimeoutRef = useRef(null);
  const processingRef = useRef(false);
  const currentFaceRef = useRef(null);
  const transcriptRef = useRef("");

  // Sync ref with transcript
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // --- HELPER LOGIC ---
  const startRecording = () => {
    if (!browserSupportsSpeechRecognition) return;
    resetTranscript();
    setIsRecording(true);

    if (browserSupportsContinuousListening) {
      SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
    } else {
      SpeechRecognition.startListening({ language: 'en-US' });
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    SpeechRecognition.stopListening();
    const final = transcriptRef.current;
    console.log("🎤 FINAL TRANSCRIPT:", final);
    return final;
  };

  const speak = async (text) => {
    if (!text) return;
    const apiKey = import.meta.env.VITE_ELEVEN_KEY;
    const voiceId = import.meta.env.VITE_VOICE_ID;

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        { text: text, model_id: "eleven_monolingual_v1" },
        { headers: { 'xi-api-key': apiKey }, responseType: 'blob' }
      );
      const audio = new Audio(URL.createObjectURL(response.data));
      audio.onended = () => {
        if (mode === 'PATIENT' && currentFaceRef.current) {
          SpeechRecognition.startListening({ continuous: true });
        }
      };
      audio.play();
    } catch (e) {
      console.error("TTS Error:", e);
    }
  };

  // --- CORE LOGIC ---
  const handleFaceDetected = async (name, imageSrc) => {
    if (currentFaceRef.current !== name) {
      console.log(`Detected Switch: ${name}`);

      // 1. Process previous person
      if (isRecording && currentFaceRef.current) {
        const finalTranscript = transcriptRef.current;
        stopRecording();
        handleProcessMemory(currentFaceRef.current, finalTranscript);
      }

      // 2. Set new session
      setCurrentFace(name);
      currentFaceRef.current = name;

      // 3. Greet
      // Removed time check
      const person = knownFaces.find(p => p.name === name);
      const lastMood = person?.history?.slice(-1)[0]?.emotion || "Neutral";
      const context = person?.history?.map(h => h.summary).join(". ") || "";

      const greeting = await getGreeting(name, context, lastMood, imageSrc);
      speak(greeting);

      // 4. Start Listening
      if (!isRecording) startRecording();
    }

    // Reset loss timeout
    if (faceLossTimeoutRef.current) {
      clearTimeout(faceLossTimeoutRef.current);
      faceLossTimeoutRef.current = null;
    }
  };

  const handleFaceLost = () => {
    if (currentFaceRef.current && isRecording && !faceLossTimeoutRef.current) {
      console.log("Face lost. Waiting 5s...");
      faceLossTimeoutRef.current = setTimeout(async () => {
        console.log("Timeout. Processing memory.");
        const nameToProcess = currentFaceRef.current;
        const finalTranscript = transcriptRef.current;

        setCurrentFace(null);
        currentFaceRef.current = null;
        setLastEmotion(null);
        stopRecording();

        await handleProcessMemory(nameToProcess, finalTranscript);
      }, 5000);
    }
  };

  const handleProcessMemory = async (name, text) => {
    const result = await processMemory(name, text);
    if (result && result.summary) {
      updateKnownFaces(name, result);
      setLastEmotion(result.emotion);
    }
  };

  // --- LOOP ---
  useEffect(() => {
    if (mode === 'PATIENT' && modelsLoaded) {
      recognitionInterval.current = setInterval(async () => {
        if (webcamRef.current && !processingRef.current) {
          processingRef.current = true;
          const match = await detectFace(webcamRef);
          processingRef.current = false;

          if (match) {
            await handleFaceDetected(match.name, match.imageSrc);
          } else {
            handleFaceLost();
          }
        }
      }, 1000);
    } else {
      // Clean up on exit
      if (recognitionInterval.current) clearInterval(recognitionInterval.current);
      if (isRecording) stopRecording();

      currentFaceRef.current = null;
      setCurrentFace(null);
      setLastEmotion(null);
      resetTranscript();
    }
    return () => clearInterval(recognitionInterval.current);
  }, [mode, modelsLoaded, knownFaces, isRecording]);

  // --- RENDER ---
  return (
    <div className="container">
      {!modelsLoaded && <div className="loading">Initializing Neural Engine...</div>}

      {modelsLoaded && mode === 'ADMIN' && (
        <AdminPanel
          webcamRef={webcamRef}
          knownFaces={knownFaces}
          addFace={addFace}
          setMode={setMode}
        />
      )}

      {modelsLoaded && mode === 'PATIENT' && (
        <PatientHUD
          webcamRef={webcamRef}
          currentFace={currentFace}
          lastEmotion={lastEmotion}
          transcript={transcript}
          listening={listening}
          setMode={setMode}
        />
      )}
    </div>
  );
}

export default App;
