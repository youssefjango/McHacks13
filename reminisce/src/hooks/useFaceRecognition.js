import { useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

export const useFaceRecognition = () => {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [knownFaces, setKnownFaces] = useState(JSON.parse(localStorage.getItem('knownFaces') || '[]'));

    // Load Models
    useEffect(() => {
        const loadAI = async () => {
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
                    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                    faceapi.nets.faceRecognitionNet.loadFromUri('/models')
                ]);
                setModelsLoaded(true);
                console.log("AI Models Loaded");
            } catch (e) {
                console.error("Error loading models:", e);
            }
        };
        loadAI();
    }, []);

    // Update Face Data (Memories)
    const updateKnownFaces = (name, memoryData) => {
        const updatedFaces = knownFaces.map(p => {
            if (p.name === name) {
                const newEntry = {
                    date: new Date().toISOString(),
                    summary: memoryData.summary,
                    emotion: memoryData.emotion,
                    transcript: memoryData.transcript || memoryData.summary // Fallback
                };
                const newHistory = [...(p.history || []), newEntry].slice(-5);
                return { ...p, history: newHistory };
            }
            return p;
        });

        setKnownFaces(updatedFaces);
        localStorage.setItem('knownFaces', JSON.stringify(updatedFaces));
    };

    // Add New Face
    const addFace = async (webcamRef, nameInput, bioInput) => {
        if (!webcamRef.current) return false;

        // Safety check
        if (!nameInput) return false;

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return false;

        try {
            const img = await faceapi.fetchImage(imageSrc);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

            if (detection) {
                const newFace = {
                    name: nameInput,
                    bio: bioInput,
                    history: [{
                        date: new Date().toISOString(),
                        summary: `Initial Bio: ${bioInput}`,
                        emotion: 'Neutral'
                    }],
                    descriptor: Array.from(detection.descriptor)
                };

                const updatedFaces = [...knownFaces, newFace];
                setKnownFaces(updatedFaces);
                localStorage.setItem('knownFaces', JSON.stringify(updatedFaces));
                return true;
            }
        } catch (e) {
            console.error("Error adding face:", e);
        }
        return false;
    };

    // Detect Face from Webcam
    const detectFace = async (webcamRef) => {
        if (!webcamRef.current || knownFaces.length === 0) return null;

        try {
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) return null;

            const img = await faceapi.fetchImage(imageSrc);

            // Reconstruct descriptors for matcher
            const labeledDescriptors = knownFaces.map(face => {
                const arr = new Float32Array(face.descriptor);
                return new faceapi.LabeledFaceDescriptors(face.name, [arr]);
            });

            const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

            if (detection) {
                const match = faceMatcher.findBestMatch(detection.descriptor);
                if (match.label !== 'unknown') {
                    return { name: match.label, imageSrc, distance: match.distance };
                }
            }
        } catch (e) {
            console.error("Recognition Error:", e);
        }
        return null;
    };

    return {
        modelsLoaded,
        knownFaces,
        updateKnownFaces,
        addFace,
        detectFace
    };
};
