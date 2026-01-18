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
                // Merge tags (keep unique, limit to 8 most recent)
                const existingTags = p.tags || [];
                const newTags = memoryData.tags || [];
                // Put new tags first, then existing, dedupe, take max 8
                const allTags = [...newTags, ...existingTags];
                const uniqueTags = Array.from(new Set(allTags)).slice(0, 8);

                const newEntry = {
                    date: new Date().toISOString(),
                    summary: memoryData.summary,
                    emotion: memoryData.emotion,
                    transcript: memoryData.transcript || memoryData.summary // Fallback
                };
                const newHistory = [...(p.history || []), newEntry];
                return { ...p, history: newHistory, tags: uniqueTags };
            }
            return p;
        });

        setKnownFaces(updatedFaces);
        localStorage.setItem('knownFaces', JSON.stringify(updatedFaces));
    };

    // Generic Helper to Process & Save Face
    const processFaceFromImage = async (imageSrc, name, bio, contact) => {
        try {
            const img = await faceapi.fetchImage(imageSrc);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

            if (detection) {
                const box = detection.detection.box;

                // Add padding to show more context (center scaled)
                const padding = 60; // Adjust as needed
                const x = Math.max(0, box.x - padding);
                const y = Math.max(0, box.y - padding);
                const width = Math.min(img.width - x, box.width + (padding * 2));
                const height = Math.min(img.height - y, box.height + (padding * 2));

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

                const facePhoto = canvas.toDataURL('image/jpeg');
                console.log("Generated facePhoto length:", facePhoto.length);

                const newFace = {
                    photo: imageSrc,
                    faceImage: facePhoto,
                    name: name,
                    bio: bio,
                    contact: contact || "",
                    history: [{
                        date: new Date().toISOString(),
                        summary: `Initial Bio: ${bio}`,
                        emotion: 'Neutral'
                    }],
                    descriptor: Array.from(detection.descriptor)
                };

                console.log("Saving new face:", newFace);

                const updatedFaces = [...knownFaces, newFace];
                setKnownFaces(updatedFaces);
                localStorage.setItem('knownFaces', JSON.stringify(updatedFaces));
                return true;
            }
        } catch (e) {
            console.error("Error processing face:", e);
        }
        return false;
    };

    // Add New Face from Webcam
    const addFace = async (webcamRef, nameInput, bioInput, contactInput) => {
        if (!webcamRef.current || !nameInput) return false;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return false;
        return await processFaceFromImage(imageSrc, nameInput, bioInput, contactInput);
    };

    // Add New Face from Data URL (Live Enrollment)
    const addFaceFromDataURL = async (imageSrc, nameInput, bioInput, contactInput) => {
        if (!imageSrc || !nameInput) return false;
        return await processFaceFromImage(imageSrc, nameInput, bioInput, contactInput);
    };

    // Add New Face from File
    const addFaceFromFile = async (file, nameInput, bioInput, contactInput) => {
        if (!file || !nameInput) return false;
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const imageSrc = e.target.result;
                const success = await processFaceFromImage(imageSrc, nameInput, bioInput, contactInput);
                resolve(success);
            };
            reader.readAsDataURL(file);
        });
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

            const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.50);
            const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })).withFaceLandmarks().withFaceDescriptor();

            if (detection) {
                // Filter small faces (background/far away)
                if (detection.detection.box.width < 60) {
                    console.log(`Face too small (Width: ${Math.round(detection.detection.box.width)}px) - Ignoring`);
                    return null;
                }

                const match = faceMatcher.findBestMatch(detection.descriptor);
                console.log(`Face Match Result: ${match.label} (Distance: ${match.distance})`);

                if (match.label !== 'unknown') {
                    return { status: 'MATCH', name: match.label, imageSrc, distance: match.distance };
                } else {
                    return { status: 'UNKNOWN', imageSrc };
                }
            }
        } catch (e) {
            console.error("Recognition Error:", e);
        }
        return null;
    };

    const deleteFace = (name) => {
        const updatedFaces = knownFaces.filter(face => face.name !== name);
        setKnownFaces(updatedFaces);
        localStorage.setItem('knownFaces', JSON.stringify(updatedFaces));
    };

    const updateContact = (name, newContact) => {
        const updatedFaces = knownFaces.map(p => {
            if (p.name === name) {
                return { ...p, contact: newContact };
            }
            return p;
        });
        setKnownFaces(updatedFaces);
        localStorage.setItem('knownFaces', JSON.stringify(updatedFaces));
    };

    return {
        modelsLoaded,
        knownFaces,
        updateKnownFaces,
        addFace,
        addFaceFromDataURL,
        addFaceFromFile,
        detectFace,
        deleteFace,
        updateContact
    };
};
