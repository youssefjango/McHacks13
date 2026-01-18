import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useFaceRecognition } from '../hooks/useFaceRecognition';
import { useGemini } from '../hooks/useGemini';
import { useLocation } from 'react-router-dom';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
// Replace react-speech-recognition with ElevenLabs Scribe
// import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import axios from 'axios';
import { Scribe, RealtimeEvents } from '@elevenlabs/client';
import { getAsset, saveAsset } from '../utils/db';

const FaceContext = createContext();

export const FaceProvider = ({ children }) => {
    // --- HOOKS ---
    const {
        modelsLoaded,
        knownFaces,
        addFace,
        addFaceFromDataURL,
        addFaceFromFile,
        detectFace,
        deleteFace,
        updateContact,
        updateKnownFaces
    } = useFaceRecognition();

    const location = useLocation();

    // --- API KEYS & CONFIG ---
    const [geminiKey, setGeminiKey] = useState(localStorage.getItem('geminiKey') || import.meta.env.VITE_GEMINI_KEY || "");
    const [elevenLabsKey, setElevenLabsKey] = useState(localStorage.getItem('elevenLabsKey') || import.meta.env.VITE_ELEVEN_KEY || "");
    const [voiceId, setVoiceId] = useState(localStorage.getItem('voiceId') || import.meta.env.VITE_VOICE_ID || "");

    const { getGreeting, processMemory } = useGemini(geminiKey);
    // Initialize ElevenLabs Client (memoized to prevent recreation unless key changes)
    const elevenlabs = React.useMemo(() => new ElevenLabsClient({
        apiKey: elevenLabsKey,
    }), [elevenLabsKey]);

    // --- STATE ---
    const [currentFace, setCurrentFace] = useState(null);
    const [lastEmotion, setLastEmotion] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);

    // Scribe State
    const [transcript, setTranscript] = useState("");
    const [listening, setListening] = useState(false);

    // Consent Flow State
    const [unknownFaceData, setUnknownFaceData] = useState(null); // { imageSrc }
    const [isConsentOpen, setIsConsentOpen] = useState(false);
    const [deniedConsent, setDeniedConsent] = useState(false); // Session avoid re-prompt

    // Reminder Settings
    const [reminderFrequency, setReminderFrequency] = useState(parseInt(localStorage.getItem('reminderFrequency') || '0'));
    const [wakeTime, setWakeTime] = useState(localStorage.getItem('wakeTime') || '08:00');
    const [sleepTime, setSleepTime] = useState(localStorage.getItem('sleepTime') || '22:00');

    // Relaxation & Emergency Settings
    const [childhoodPhoto, setChildhoodPhoto] = useState('');
    const [relaxingMusicUrl, setRelaxingMusicUrl] = useState('');
    const [emergencyContact, setEmergencyContact] = useState(localStorage.getItem('emergencyContact') || '');



    // --- REFS ---
    const webcamRef = useRef(null);
    const recognitionInterval = useRef(null);
    const reminderInterval = useRef(null);
    const scrollRef = useRef(null);
    const faceLossTimeoutRef = useRef(null);
    const processingRef = useRef(false);
    const currentFaceRef = useRef(null);
    const transcriptRef = useRef("");
    const audioRef = useRef(null);
    const abortControllerRef = useRef(null);
    const scribeConnectionRef = useRef(null);
    const lastPartialRef = useRef(""); // Fallback for uncommitted text
    const scribeActiveRef = useRef(false); // Flag to ignore events after cleanup

    const unknownFrameCountRef = useRef(0);
    const assetsLoadedRef = useRef(false);

    // NOTE: Do NOT sync transcriptRef from transcript state!
    // transcriptRef holds ONLY committed text
    // transcript state holds committed + current partial (for display)

    const resetTranscript = () => {
        setTranscript("");
        transcriptRef.current = "";
    };

    // Load Large Assets from IndexedDB on Mount
    useEffect(() => {
        const loadAssets = async () => {
            console.log("[Storage] Loading assets from IndexedDB...");
            const photo = await getAsset('childhoodPhoto');
            const music = await getAsset('relaxingMusicUrl');

            if (photo) setChildhoodPhoto(photo);
            if (music) setRelaxingMusicUrl(music);

            // Mark as loaded AFTER setting state
            assetsLoadedRef.current = true;
            console.log("[Storage] Assets loaded.");

            // Cleanup old localStorage keys to free up space!
            localStorage.removeItem('childhoodPhoto');
            localStorage.removeItem('relaxingMusicUrl');
        };
        loadAssets();
    }, []);

    // Persist Reminder Settings
    useEffect(() => {
        localStorage.setItem('reminderFrequency', reminderFrequency);
        localStorage.setItem('wakeTime', wakeTime);
        localStorage.setItem('sleepTime', sleepTime);
    }, [reminderFrequency, wakeTime, sleepTime]);

    // Persist Relaxation & Emergency Settings
    useEffect(() => {
        // Save emergency contact to localStorage (it's small)
        localStorage.setItem('emergencyContact', emergencyContact);
    }, [emergencyContact]);

    // Persist Large Assets to IndexedDB (only after initial load!)
    useEffect(() => {
        if (assetsLoadedRef.current) {
            console.log("[Storage] Saving childhoodPhoto to IndexedDB");
            saveAsset('childhoodPhoto', childhoodPhoto);
        }
    }, [childhoodPhoto]);

    useEffect(() => {
        if (assetsLoadedRef.current) {
            console.log("[Storage] Saving relaxingMusicUrl to IndexedDB");
            saveAsset('relaxingMusicUrl', relaxingMusicUrl);
        }
    }, [relaxingMusicUrl]);

    // Persist API Keys to localStorage
    useEffect(() => {
        localStorage.setItem('geminiKey', geminiKey);
        localStorage.setItem('elevenLabsKey', elevenLabsKey);
        localStorage.setItem('voiceId', voiceId);
    }, [geminiKey, elevenLabsKey, voiceId]);

    // Stop audio and save transcript when leaving /camera
    useEffect(() => {
        if (location.pathname !== '/camera') {
            // Use committed text, or fall back to last partial if committed is empty
            const textToSave = transcriptRef.current.trim() || lastPartialRef.current.trim();

            // Save any active conversation before leaving
            if (currentFaceRef.current && textToSave.length > 10) {
                console.log("[Cleanup] Saving transcript on route change for:", currentFaceRef.current);
                console.log("[Cleanup] Text to save:", textToSave);
                handleProcessMemory(currentFaceRef.current, textToSave);
            }

            // Clear refs
            transcriptRef.current = "";
            lastPartialRef.current = "";

            // Stop audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }

            // Mark Scribe as inactive FIRST to stop event processing
            scribeActiveRef.current = false;

            // Close Scribe connection (SDK handles cleanup internally)
            if (scribeConnectionRef.current) {
                console.log("[Cleanup] Closing Scribe connection...");
                try {
                    scribeConnectionRef.current.close();
                } catch (e) {
                    console.log("[Cleanup] Error closing Scribe:", e);
                }
                scribeConnectionRef.current = null;
            }

            setIsRecording(false);
            setListening(false);
            console.log("[Cleanup] All cleanup complete");
        }
    }, [location.pathname]);

    // Reminder Logic
    const triggerNotification = (title, body) => {
        if (Notification.permission === 'granted') {
            new Notification(title || "Reminisce", {
                body: body || "Just a gentle reminder: This app is here to help you remember your loved ones.",
                icon: "/logo.png"
            });
            const audio = new Audio('/chime.mp3');
            audio.play().catch(e => console.log("No chime asset"));
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    triggerNotification(title, body);
                }
            });
        }
    };

    useEffect(() => {
        if (reminderInterval.current) clearInterval(reminderInterval.current);

        if (reminderFrequency > 0 && Notification.permission !== 'denied') {
            Notification.requestPermission();
            const intervalMs = (24 * 60 * 60 * 1000) / reminderFrequency;

            reminderInterval.current = setInterval(() => {
                const now = new Date();
                const currentH = now.getHours();
                const currentM = now.getMinutes();
                const currentTime = currentH * 60 + currentM;

                const [wakeH, wakeM] = wakeTime.split(':').map(Number);
                const [sleepH, sleepM] = sleepTime.split(':').map(Number);
                const wakeTimeVal = wakeH * 60 + wakeM;
                const sleepTimeVal = sleepH * 60 + sleepM;

                const isAwake = currentTime >= wakeTimeVal && currentTime < sleepTimeVal;

                if (isAwake) {
                    triggerNotification();
                }
            }, intervalMs);
        }

        return () => {
            if (reminderInterval.current) clearInterval(reminderInterval.current);
        };
    }, [reminderFrequency, wakeTime, sleepTime]);

    // --- SCRIBE STT LOGIC ---
    const startRecording = async () => {
        // Use ref for immediate check (state updates are async!)
        if (scribeActiveRef.current || scribeConnectionRef.current) {
            console.log("[Scribe] Already recording/connecting, skipping...");
            return;
        }

        // Set flag immediately to prevent double calls
        scribeActiveRef.current = true;

        try {
            console.log("[Scribe] Starting Scribe STT...");
            resetTranscript();
            setIsRecording(true);
            setListening(true);

            // Generate single-use token
            console.log("[Scribe] Generating token...");
            const tokenResponse = await elevenlabs.tokens.singleUse.create("realtime_scribe");
            console.log("[Scribe] Token generated:", tokenResponse);

            // Connect to Scribe
            console.log("[Scribe] Connecting to Scribe WebSocket...");
            const connection = Scribe.connect({
                token: tokenResponse.token,
                modelId: 'scribe_v2_realtime',
                includeTimestamps: true,
                microphone: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });

            scribeConnectionRef.current = connection;
            console.log("[Scribe] Connection object created:", connection);

            // Session Started
            connection.on(RealtimeEvents.SESSION_STARTED, () => {
                console.log("[Scribe] ✅ Session started!");
            });

            // Connection Opened
            connection.on(RealtimeEvents.OPEN, () => {
                console.log("[Scribe] ✅ WebSocket opened!");
            });

            // Partial Transcript - these are temporary and replace each other
            connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
                if (!scribeActiveRef.current) return; // Ignore if cleanup started
                console.log("[Scribe] 📝 Partial:", data.text);
                // Store as fallback in case connection closes before commit
                lastPartialRef.current = transcriptRef.current + " " + data.text;
                // Display: committed + current partial (don't accumulate partials!)
                setTranscript(lastPartialRef.current);
            });

            // Committed Transcript - these are final and should be accumulated
            connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
                if (!scribeActiveRef.current) return; // Ignore if cleanup started
                console.log("[Scribe] ✅ Committed:", data.text);
                // Only add to the ref when committed (this is the stable history)
                transcriptRef.current = (transcriptRef.current + " " + data.text).trim();
                setTranscript(transcriptRef.current);
            });

            // Error
            connection.on(RealtimeEvents.ERROR, (err) => {
                console.error("[Scribe] ❌ Error:", err);
            });

            // Connection Closed
            connection.on(RealtimeEvents.CLOSE, () => {
                console.log("[Scribe] 🔌 Connection closed.");
            });

        } catch (e) {
            console.error("[Scribe] ❌ Failed to start:", e);
            setIsRecording(false);
            setListening(false);
        }
    };

    const stopRecording = () => {
        console.log("[Scribe] Stopping recording...");
        setIsRecording(false);
        setListening(false);
        if (scribeConnectionRef.current) {
            scribeConnectionRef.current.close();
            scribeConnectionRef.current = null;
        }
        return transcriptRef.current;
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    const speak = async (text) => {
        if (!text || location.pathname !== '/camera') return;

        // Stop any currently playing audio or pending request
        stopAudio();

        // Pause Scribe while speaking to prevent self-hearing?
        // Ideally yes.
        const wasRecording = isRecording;
        if (wasRecording) {
            // Note: Scribe doesn't have "pause". We might just ignore events?
            // Or use echo cancellation (which is on).
        }

        const voiceId = import.meta.env.VITE_VOICE_ID;
        abortControllerRef.current = new AbortController();

        try {
            const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
                model_id: "eleven_monolingual_v1",
                text,
                output_format: "mp3_44100_128",
            });

            const chunks = [];
            for await (const chunk of audioStream) {
                chunks.push(chunk);
            }

            // Double-check we're still on camera page before playing
            if (location.pathname !== '/camera') {
                console.log("[Audio] Aborting playback - no longer on /camera");
                return;
            }

            const blob = new Blob(chunks, { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onended = () => {
                audioRef.current = null;
            };

            await audio.play();

        } catch (e) {
            if (axios.isCancel(e)) {
                console.log("TTS Request Cancelled");
            } else {
                console.error("ElevenLabs TTS Error:", e);
            }
        }
    };

    const handleProcessMemory = async (name, text) => {
        const result = await processMemory(name, text);
        if (result && result.summary) {
            updateKnownFaces(name, result);
            setLastEmotion(result.emotion);
        }
    };

    const handleUnknownFace = (imageSrc) => {
        console.log("handleUnknownFace called. State:", { isConsentOpen, deniedConsent });
        if (!isConsentOpen && !deniedConsent) {
            if (currentFaceRef.current) {
                console.log(`Transition from ${currentFaceRef.current} to Unknown`);
                const nameToSave = currentFaceRef.current;
                const transcriptToSave = transcriptRef.current;

                if (transcriptToSave.trim().length > 10) {
                    handleProcessMemory(nameToSave, transcriptToSave);
                }

                if (faceLossTimeoutRef.current) {
                    clearTimeout(faceLossTimeoutRef.current);
                    faceLossTimeoutRef.current = null;
                }

                setCurrentFace(null);
                currentFaceRef.current = null;
                setLastEmotion(null);
                resetTranscript();
                if (isRecording) stopRecording();
            }

            console.log("Unknown face detected - requesting consent");
            setUnknownFaceData({ imageSrc });
            setIsConsentOpen(true);
            stopAudio();
            resetTranscript();
            if (isRecording) stopRecording();
        }
    };

    const handleConsentNo = () => {
        console.log("Consent denied");
        setIsConsentOpen(false);
        setUnknownFaceData(null);
        setDeniedConsent(true);
    };

    const enrollAndStart = async (name) => {
        if (!unknownFaceData || !name) return;

        console.log(`Enrolling new face: ${name}`);
        const success = await addFaceFromDataURL(unknownFaceData.imageSrc, name, "New Person");

        if (success) {
            setIsConsentOpen(false);
            setUnknownFaceData(null);
            handleFaceDetected(name, unknownFaceData.imageSrc);
        }
    };

    const handleFaceDetected = async (name, imageSrc) => {
        setDeniedConsent(false);
        unknownFrameCountRef.current = 0;

        if (isConsentOpen) {
            console.log("Known face detected while consent open - closing popup");
            setIsConsentOpen(false);
            setUnknownFaceData(null);
        }

        if (currentFaceRef.current !== name) {
            console.log(`Detected: ${name}`);

            if (!isRecording) startRecording();
            stopAudio();

            if (isRecording && currentFaceRef.current) {
                const finalTranscript = transcriptRef.current;
                // Don't fully stop recording if switching people?
                // Actually, Scribe Session is one continuous stream usually.
                // But we want to segment memory.
                // Let's restart session to be safe/clean? Or just split logic.
                // For now, restart is safer to ensure clear boundaries.
                stopRecording();
                handleProcessMemory(currentFaceRef.current, finalTranscript);
                startRecording();
            } else if (!isRecording) {
                // If not recording, start now
                startRecording();
            }

            setCurrentFace(name);
            currentFaceRef.current = name;

            const person = knownFaces.find(p => p.name === name);
            const lastMood = person?.history?.slice(-1)[0]?.emotion || "Neutral";
            const greeting = await getGreeting(name, person?.bio, person?.history, lastMood, imageSrc);

            speak(greeting);
        }

        if (faceLossTimeoutRef.current) {
            clearTimeout(faceLossTimeoutRef.current);
            faceLossTimeoutRef.current = null;
        }
    };

    const handleFaceLost = () => {
        if (currentFaceRef.current && isRecording && !faceLossTimeoutRef.current) {
            faceLossTimeoutRef.current = setTimeout(async () => {
                const nameToProcess = currentFaceRef.current;
                const finalTranscript = transcriptRef.current;

                setCurrentFace(null);
                currentFaceRef.current = null;
                setLastEmotion(null);
                stopRecording();
                stopAudio();

                await handleProcessMemory(nameToProcess, finalTranscript);
            }, 5000);
        }
    };

    // --- LOOP ---
    useEffect(() => {
        if (isCameraActive && modelsLoaded) {
            recognitionInterval.current = setInterval(async () => {
                if (webcamRef.current && !processingRef.current) {
                    processingRef.current = true;
                    // Pass isConsentOpen so we don't spam logs or logic if already open, 
                    // but we still need to detect known faces.
                    const match = await detectFace(webcamRef);
                    processingRef.current = false;

                    if (match) {
                        if (match.status === 'MATCH') {
                            unknownFrameCountRef.current = 0;
                            await handleFaceDetected(match.name, match.imageSrc);
                        } else if (match.status === 'UNKNOWN') {
                            // Debounce: Require 5 consecutive frames of unknown
                            unknownFrameCountRef.current += 1;
                            if (unknownFrameCountRef.current > 5) {
                                handleUnknownFace(match.imageSrc);
                            }
                        }
                    } else {
                        unknownFrameCountRef.current = 0;
                        handleFaceLost();

                        // If consent is open OR denied but no face is visible, reset it
                        if (isConsentOpen || deniedConsent) {
                            console.log("No face detected - resetting consent/denied state");
                            setIsConsentOpen(false);
                            setDeniedConsent(false);
                            setUnknownFaceData(null);
                        }
                    }
                }
            }, 350); // Faster scan as per user change
        } else {
            // Stop the scanning interval in all other cases
            if (recognitionInterval.current) clearInterval(recognitionInterval.current);

            // ONLY reset patient state if the camera is fully deactivated (e.g., left the page)
            if (!isCameraActive) {
                if (isRecording && currentFaceRef.current) {
                    const nameToSave = currentFaceRef.current;
                    const transcriptToSave = transcriptRef.current;
                    if (transcriptToSave.trim().length > 10) {
                        handleProcessMemory(nameToSave, transcriptToSave);
                    }
                }

                if (isRecording) stopRecording();
                stopAudio();
                currentFaceRef.current = null;
                setCurrentFace(null);
                setLastEmotion(null);

                // Clear consent state on exit
                setIsConsentOpen(false);
                setDeniedConsent(false);
                setUnknownFaceData(null);

                resetTranscript();
            }
        }

        return () => {
            if (recognitionInterval.current) clearInterval(recognitionInterval.current);
        };
    }, [isCameraActive, modelsLoaded, knownFaces, isRecording, isConsentOpen, deniedConsent]);

    return (
        <FaceContext.Provider value={{
            // State
            currentFace,
            lastEmotion,
            knownFaces,
            modelsLoaded,
            isRecording,
            transcript,
            listening,
            isCameraActive,
            isConsentOpen,

            // Actions
            setIsCameraActive,
            handleConsentNo,
            enrollAndStart,
            addFace,
            addFaceFromFile,
            deleteFace,
            updateContact,
            webcamRef,

            // Reminder Settings
            reminderFrequency,
            wakeTime,
            sleepTime,
            setReminderFrequency,
            setWakeTime,
            setSleepTime,
            triggerNotification,

            // Relaxation & Emergency
            childhoodPhoto,
            setChildhoodPhoto,
            relaxingMusicUrl,
            setRelaxingMusicUrl,
            emergencyContact,
            setEmergencyContact,

            // API Keys
            geminiKey,
            setGeminiKey,
            elevenLabsKey,
            setElevenLabsKey,
            voiceId,
            setVoiceId
        }}>
            {children}
        </FaceContext.Provider>
    );
};

export const useFace = () => useContext(FaceContext);
