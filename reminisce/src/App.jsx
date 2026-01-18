import { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import './index.css';

function App() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [mode, setMode] = useState('ADMIN'); // 'ADMIN' or 'PATIENT'
  const [knownFaces, setKnownFaces] = useState(JSON.parse(localStorage.getItem('knownFaces') || '[]'));

  // Admin State
  const [nameInput, setNameInput] = useState('');
  const [bioInput, setBioInput] = useState('');

  // Patient State
  const [currentFace, setCurrentFace] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [lastGreetingTime, setLastGreetingTime] = useState(0);

  // Speech Recognition Hook
  const { transcript, transcriptRef, startListening, stopListening, resetTranscript } = useSpeechRecognition();

  // Refs
  const webcamRef = useRef(null);
  const recognitionInterval = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const faceLossTimeoutRef = useRef(null);
  const processingRef = useRef(false);
  const currentFaceRef = useRef(null);

  // Load AI Models
  useEffect(() => {
    const loadAI = async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setModelsLoaded(true);
        console.log("AI Models Loaded");
      } catch (e) {
        console.error("Error loading models:", e);
      }
    };
    loadAI();
  }, []);

  // Admin: Add Person
  const addFace = async () => {
    if (!webcamRef.current || !nameInput) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    try {
      const img = await faceapi.fetchImage(imageSrc);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        const newFace = {
          name: nameInput,
          bio: bioInput,
          contextSummary: `Initial Bio: ${bioInput}`, // Start history with bio
          descriptor: Array.from(detection.descriptor)
        };

        const updatedFaces = [...knownFaces, newFace];
        setKnownFaces(updatedFaces);
        localStorage.setItem('knownFaces', JSON.stringify(updatedFaces));
        setNameInput('');
        setBioInput('');
        alert(`Saved ${newFace.name}!`);
      } else {
        alert("No face detected. Try again.");
      }
    } catch (e) {
      console.error("Error adding face:", e);
    }
  };

  // Patient: Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log("Recording started...");
    } catch (e) {
      console.error("Error starting recording:", e);
    }
  };

  const stopRecording = async () => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsRecording(false);
        console.log("Recording stopped. Blob size:", audioBlob.size);
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
      // Stop all tracks to release mic
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    });
  };

  // Patient: Recognition Loop
  useEffect(() => {
    if (mode === 'PATIENT' && modelsLoaded) {
      console.log("Starting Patient Mode Loop");
      recognitionInterval.current = setInterval(() => {
        if (webcamRef.current) {
          recognizeFace();
        }
      }, 1000); // Check every 1s for better responsiveness
    } else {
      if (recognitionInterval.current) clearInterval(recognitionInterval.current);
      // Cleanup if switching modes while recording
      if (isRecording) {
        stopRecording();
      }
      currentFaceRef.current = null;
      setCurrentFace(null);
    }
    return () => clearInterval(recognitionInterval.current);
  }, [mode, modelsLoaded, knownFaces, isRecording, currentFace]);

  const recognizeFace = async () => {
    if (processingRef.current || !webcamRef.current) return;
    processingRef.current = true;

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      const img = await faceapi.fetchImage(imageSrc);

      if (knownFaces.length === 0) return;

      const labeledDescriptors = knownFaces.map(face => {
        return new faceapi.LabeledFaceDescriptors(face.name, [new Float32Array(face.descriptor)]);
      });

      const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        const match = faceMatcher.findBestMatch(detection.descriptor);

        if (match.label !== 'unknown') {
          await handleFaceDetected(match.label, imageSrc);
        } else {
          handleFaceLost();
        }
      } else {
        handleFaceLost();
      }
    } catch (e) {
      console.error("Error during recognition:", e);
    } finally {
      processingRef.current = false;
    }
  };

  const handleFaceDetected = async (name, imageSrc) => {
    // If this is a new person or re-entry after timeout
    if (currentFaceRef.current !== name) {
      console.log(`Detected new face: ${name}`);

      // 1. If we were recording someone else, stop and process that validly
      if (isRecording && currentFaceRef.current) {
        const audioBlob = await stopRecording();
        processMemory(currentFaceRef.current, audioBlob);
      }

      // 2. Start new session
      setCurrentFace(name);
      currentFaceRef.current = name;

      // Only greet if it's been a while (e.g. 1 min) to avoid spamming
      const now = Date.now();
      if (now - lastGreetingTime > 60000) {
        setLastGreetingTime(now);
        const person = knownFaces.find(p => p.name === name);
        const context = person ? person.contextSummary : "";
        const greeting = await getGreeting(name, context, imageSrc);
        speak(greeting);
      }

      // 3. Start Recording conversation
      if (!isRecording) {
        startRecording();
        startListening(); // Start speech recognition when recording begins
      }
    }

    // Reset Loss Timeout if exists (User is still here)
    if (faceLossTimeoutRef.current) {
      clearTimeout(faceLossTimeoutRef.current);
      faceLossTimeoutRef.current = null;
    }
  };

  const handleFaceLost = () => {
    // Only care if we are currently tracking someone
    if (currentFaceRef.current && isRecording && !faceLossTimeoutRef.current) {
      console.log("Face lost... waiting 5s before stopping.");
      faceLossTimeoutRef.current = setTimeout(async () => {
        console.log("Face timeout reached. Processing memory.");
        console.log("TRANSCRIPT:", transcriptRef.current); // Print transcript from ref (always up to date)
        const nameToProcess = currentFaceRef.current;
        setCurrentFace(null); // Reset current face
        currentFaceRef.current = null;

        const audioBlob = await stopRecording();
        stopListening(); // Stop speech recognition
        await processMemory(nameToProcess, audioBlob);
        resetTranscript(); // Clear transcript after processing

      }, 5000); // 5 seconds grace period
    }
  };

  // API: Process Memory (Summarize)
  const processMemory = async (name, audioBlob) => {
    if (!audioBlob || audioBlob.size < 1000) {
      console.log("Audio too short, skipping summary.");
      return;
    }

    const person = knownFaces.find(p => p.name === name);
    if (!person) return;

    console.log(`Summarizing interaction with ${name}...`);

    try {
      // Convert Blob to Base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1];
        const newContext = await summarizeInteraction(name, person.contextSummary, base64Audio);

        // Update LocalStorage
        const updatedFaces = knownFaces.map(p => {
          if (p.name === name) {
            return { ...p, contextSummary: newContext };
          }
          return p;
        });
        setKnownFaces(updatedFaces);
        localStorage.setItem('knownFaces', JSON.stringify(updatedFaces));
        console.log("Memory Updated!", newContext);
      };
    } catch (e) {
      console.error("Error processing memory:", e);
    }
  };

  // Helper for Gemini GenAI Call
  const callGemini = async (prompt, mimeType, dataBase64) => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_KEY;
      const ai = new GoogleGenAI({ apiKey });

      const contents = [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType, data: dataBase64 } }
        ]
      }];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents
      });

      return response.text;
    } catch (e) {
      console.error("Gemini SDK Error:", e);
      throw e;
    }
  };

  // API calls
  const getGreeting = async (name, context, imageBase64) => {
    try {
      const cleanImage = imageBase64.split(',')[1];
      const prompt = `You are helpful assistant for a dementia patient. The patient sees ${name}.
                  Here is the context/history of ${name}: "${context}".
                  Look at the image. Is ${name} smiling? What are they doing?
                  Generate a warm, short (1 sentence) greeting that the AI should say to the patient about ${name}. 
                  Mention the context naturally.`;

      return await callGemini(prompt, "image/jpeg", cleanImage);
    } catch (e) {
      console.error("Greeting Error:", e);
      return `Hello ${name}`;
    }
  };

  const summarizeInteraction = async (name, oldContext, audioBase64) => {
    try {
      const prompt = `You are an expert memory assistant.
                  Here is the previous context for ${name}: "${oldContext}".
                  Attached is an audio recording of a conversation that just happened.
                  1. Transcribe the essence of what was said.
                  2. Merge it into the "previous context" to create a standard, updated bio/summary for ${name}.
                  Keep it concise but retain important personal details mentioned (like names of pets, events, feelings).`;

      return await callGemini(prompt, "audio/webm", audioBase64);
    } catch (e) {
      console.error("Summarize Error:", e);
      return oldContext;
    }
  };

  const speak = async (text) => {
    if (!text) return;
    console.log("Speaking:", text);
    const apiKey = import.meta.env.VITE_ELEVEN_KEY;
    const voiceId = import.meta.env.VITE_VOICE_ID;

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        { text: text, model_id: "eleven_monolingual_v1" },
        { headers: { 'xi-api-key': apiKey }, responseType: 'blob' }
      );
      const audio = new Audio(URL.createObjectURL(response.data));
      audio.play();
    } catch (e) {
      console.error("TTS Error:", e);
    }
  };

  return (
    <div className="container">
      {!modelsLoaded && <div className="loading">Loading AI Models...</div>}

      {modelsLoaded && mode === 'ADMIN' && (
        <div className="admin-mode">
          <h1>Add a Memory</h1>
          <div className="webcam-container small">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ width: 640, height: 480 }}
            />
          </div>
          <div className="controls">
            <input
              type="text"
              placeholder="Name (e.g. John)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
            <input
              type="text"
              placeholder="Initial Bio (e.g. Your son who loves jazz)"
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value)}
            />
            <button onClick={addFace}>Save Face</button>
            <div className="link" onClick={() => setMode('PATIENT')}>Go to Patient Mode</div>
          </div>
          <div className="list">
            <h3>Known Faces & Memories:</h3>
            <ul>
              {knownFaces.map((face, i) => (
                <li key={i}>
                  <strong>{face.name}</strong>
                  <p style={{ fontSize: '0.8rem', color: '#aaa' }}>{face.contextSummary}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {modelsLoaded && mode === 'PATIENT' && (
        <div className="patient-mode">
          <div className="webcam-container full">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
            />
          </div>
          <button className="hidden-exit" onClick={() => setMode('ADMIN')} title="Back to Admin"></button>

          {/* Status Overlay */}
          <div className="status-overlay">
            {currentFace && <div className="bubble">Detected: {currentFace}</div>}
            {isRecording && <div className="recording-indicator">🔴 Listening...</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
