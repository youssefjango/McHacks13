import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useFaceRecognition } from '../hooks/useFaceRecognition';
import { useGemini } from '../hooks/useGemini';
import { useLocation } from 'react-router-dom';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import axios from 'axios';

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

    const { getGreeting, processMemory } = useGemini();
    const location = useLocation();

    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition,
        browserSupportsContinuousListening
    } = useSpeechRecognition();

    // --- STATE ---
    const [currentFace, setCurrentFace] = useState(null);
    const [lastEmotion, setLastEmotion] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);

    // Consent Flow State
    const [unknownFaceData, setUnknownFaceData] = useState(null); // { imageSrc }
    const [isConsentOpen, setIsConsentOpen] = useState(false);
    const [deniedConsent, setDeniedConsent] = useState(false); // Session avoid re-prompt

    // --- REFS ---
    const webcamRef = useRef(null);
    const recognitionInterval = useRef(null);
    const faceLossTimeoutRef = useRef(null);
    const processingRef = useRef(false);
    const currentFaceRef = useRef(null);
    const transcriptRef = useRef("");
    const audioRef = useRef(null);
    const abortControllerRef = useRef(null);

    const unknownFrameCountRef = useRef(0);

    // Sync transcript ref
    useEffect(() => {
        transcriptRef.current = transcript;
    }, [transcript]);

    const startRecording = () => {
        if (!browserSupportsSpeechRecognition || isRecording) return;
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

        const apiKey = import.meta.env.VITE_ELEVEN_KEY;
        const voiceId = import.meta.env.VITE_VOICE_ID;

        abortControllerRef.current = new AbortController();

        try {
            const response = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                { text: text, model_id: "eleven_monolingual_v1" },
                {
                    headers: { 'xi-api-key': apiKey },
                    responseType: 'blob',
                    signal: abortControllerRef.current.signal
                }
            );

            const audio = new Audio(URL.createObjectURL(response.data));
            audioRef.current = audio;

            audio.onended = () => {
                audioRef.current = null;
                // Resume listening after speaking if camera is active
                if (currentFaceRef.current) {
                    SpeechRecognition.startListening({ continuous: true });
                }
            };
            audio.play();
        } catch (e) {
            if (axios.isCancel(e)) {
                console.log("TTS Request Cancelled");
            } else {
                console.error("TTS Error:", e);
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
            // If someone was active, finalize them immediately
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

        // Auto-close consent if known face appears
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
                stopRecording();
                handleProcessMemory(currentFaceRef.current, finalTranscript);
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
            }, 350);
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
            webcamRef
        }}>
            {children}
        </FaceContext.Provider>
    );
};

export const useFace = () => useContext(FaceContext);
