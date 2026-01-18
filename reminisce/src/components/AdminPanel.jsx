import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useFace } from '../context/FaceContext';
import { Menu, Camera, ArrowLeft, Trash2 } from 'lucide-react';
import Sidebar from './Sidebar';
import Logo from "../assets/Logo.svg";

const AdminPanel = () => {
    const navigate = useNavigate();
    const {
        webcamRef,
        knownFaces,
        addFace,
        addFaceFromFile,
        deleteFace,
        reminderFrequency,
        setReminderFrequency,
        wakeTime,
        setWakeTime,
        sleepTime,
        setSleepTime,
        triggerNotification,
        childhoodPhoto,
        setChildhoodPhoto,
        relaxingMusicUrl,
        setRelaxingMusicUrl,
        emergencyContact,
        setEmergencyContact,
        geminiKey,
        setGeminiKey,
        elevenLabsKey,
        setElevenLabsKey,
        voiceId,
        setVoiceId
    } = useFace();

    const [nameInput, setNameInput] = useState('');
    const [bioInput, setBioInput] = useState('');
    const [contactInput, setContactInput] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    const handleAddFace = async () => {
        if (isAdding) return;
        setIsAdding(true);

        try {
            let success = false;

            if (selectedFile) {
                success = await addFaceFromFile(selectedFile, nameInput, bioInput, contactInput);
            } else {
                success = await addFace(webcamRef, nameInput, bioInput, contactInput);
            }

            if (success) {
                alert(`Saved ${nameInput}!`);
                setNameInput('');
                setBioInput('');
                setContactInput('');
                setSelectedFile(null);
            } else {
                alert("No face detected or missing name. Try again.");
            }
        } catch (e) {
            console.error("Add face error", e);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = (name) => {
        if (window.confirm(`Are you sure you want to delete ${name}?`)) {
            deleteFace(name);
        }
    };

    return (
        <div className="flex flex-col flex-1 h-full p-6 overflow-y-auto bg-gray-50">
            {showMenu && <Sidebar onClose={() => setShowMenu(false)} />}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <Menu onClick={() => setShowMenu(true)} className="cursor-pointer" />
                <img src={Logo} className='w-40' alt="Logo" />
                <Camera onClick={() => navigate('/camera')} className="cursor-pointer" />
            </div>

            <div className="flex items-center gap-4 mb-6">
                <ArrowLeft onClick={() => navigate('/dashboard')} className="cursor-pointer" />
                <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
            </div>

            <div className="relative mx-auto mb-6 border-4 border-red-500 rounded-xl shadow-lg w-fit">
                <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="rounded-lg max-w-[300px]" />
            </div>

            <div className="flex flex-col gap-4 mb-8 w-full max-w-md mx-auto p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Add New Connection</h3>
                <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    placeholder="Name"
                    className="p-3 text-black bg-gray-50 border-2 border-gray-400 rounded-xl outline-none focus:border-red-500 font-bold placeholder-gray-500"
                />
                <input
                    value={contactInput}
                    onChange={e => setContactInput(e.target.value)}
                    placeholder="Contact Info (Phone / Email)"
                    className="p-3 text-black bg-gray-50 border-2 border-gray-400 rounded-xl outline-none focus:border-red-500 font-medium placeholder-gray-500"
                />
                <textarea
                    value={bioInput}
                    onChange={e => setBioInput(e.target.value)}
                    placeholder="Initial Context / Bio"
                    className="p-3 text-black bg-gray-50 border-2 border-gray-400 rounded-xl outline-none focus:border-red-500 min-h-[80px] font-medium placeholder-gray-500"
                />
                <button
                    onClick={handleAddFace}
                    disabled={isAdding}
                    className="px-6 py-4 text-lg font-black text-white uppercase tracking-wider transition-all bg-[#ff5c5c] rounded-xl hover:bg-red-600 shadow-md active:scale-95 disabled:opacity-50 border-2 border-red-700 w-full"
                >
                    {isAdding ? "Saving..." : "ADD NEW FACE"}
                </button>

                <div className="relative flex items-center gap-2 py-2">
                    <div className="flex-1 h-[1px] bg-gray-300"></div>
                    <span className="text-xs font-bold text-gray-400">OR UPLOAD PHOTO</span>
                    <div className="flex-1 h-[1px] bg-gray-300"></div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="block w-full cursor-pointer">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setSelectedFile(e.target.files[0]);
                                }
                            }}
                            className="hidden"
                        />
                        <div className={`w-full p-3 text-center border-2 border-dashed rounded-xl font-bold transition-all ${selectedFile ? 'border-primary-red bg-red-50 text-primary-red' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
                            {selectedFile ? `Selected: ${selectedFile.name}` : "Choose Image File"}
                        </div>
                    </label>
                </div>
            </div>

            {/* Reminder Settings */}
            <div className="flex flex-col gap-4 mb-8 w-full max-w-md mx-auto p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Patient Reminders</h3>

                <div className="flex flex-col gap-1">
                    <div className="flex justify-between">
                        <label className="font-bold text-gray-700">Reminders per Day</label>
                        <span className="font-bold text-red-500">{reminderFrequency}x</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="10"
                        value={reminderFrequency}
                        onChange={(e) => setReminderFrequency(parseInt(e.target.value))}
                        className="w-full accent-red-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-500">Set to 0 to disable reminders.</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-700 text-sm">Wake Up Time</label>
                        <input
                            type="time"
                            value={wakeTime}
                            onChange={(e) => setWakeTime(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg font-bold"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-700 text-sm">Bed Time</label>
                        <input
                            type="time"
                            value={sleepTime}
                            onChange={(e) => setSleepTime(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg font-bold"
                        />
                    </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                    Notifications will only be sent between wake up and bed time.
                </div>

                <button
                    onClick={() => triggerNotification()}
                    className="mt-2 w-full py-2 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
                >
                    🔔 Test Notification
                </button>
            </div>

            {/* Relaxation & Emergency Settings */}
            <div className="mb-8 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <h3 className="font-black text-gray-700 mb-3">🎵 Relaxation & Emergency</h3>

                <div className="mb-4">
                    <label className="block font-bold text-gray-700 text-sm mb-2">Childhood Photo</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setChildhoodPhoto(reader.result);
                                reader.readAsDataURL(file);
                            }
                        }}
                        className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-500 file:text-white file:font-bold hover:file:bg-purple-600"
                    />
                    {childhoodPhoto && (
                        <div className="mt-2 relative">
                            <img src={childhoodPhoto} alt="Childhood" className="w-20 h-20 object-cover rounded-lg" />
                            <button
                                onClick={() => setChildhoodPhoto('')}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs"
                            >×</button>
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <label className="block font-bold text-gray-700 text-sm mb-2">Relaxing Music (MP3)</label>
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setRelaxingMusicUrl(reader.result);
                                reader.readAsDataURL(file);
                            }
                        }}
                        className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-500 file:text-white file:font-bold hover:file:bg-purple-600"
                    />
                    {relaxingMusicUrl && (
                        <div className="mt-2 flex items-center gap-2 p-2 bg-white rounded-lg border border-purple-100">
                            <span className="text-xs font-bold text-purple-700">🎵 Audio Uploaded</span>
                            <button
                                onClick={() => setRelaxingMusicUrl('')}
                                className="ml-auto w-5 h-5 bg-red-500 text-white rounded-full text-xs"
                            >×</button>
                        </div>
                    )}
                    <span className="text-xs text-gray-500 mt-1 block">Upload a calming audio file for the Relax mode</span>
                </div>

                <div>
                    <label className="block font-bold text-gray-700 text-sm mb-2">Emergency Contact</label>
                    <input
                        type="tel"
                        placeholder="+1 234 567 8900"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        className="w-full p-2 border border-purple-200 rounded-lg text-sm"
                    />
                    <span className="text-xs text-gray-500">Phone number for the emergency button</span>
                </div>
            </div>

            {/* API Configuration */}
            <div className="mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="font-black text-gray-700 mb-3">🔑 API Configuration</h3>

                <div className="mb-4">
                    <label className="block font-bold text-gray-700 text-sm mb-2">Gemini API Key</label>
                    <input
                        type="password"
                        placeholder="AIza..."
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                </div>

                <div className="mb-4">
                    <label className="block font-bold text-gray-700 text-sm mb-2">ElevenLabs API Key</label>
                    <input
                        type="password"
                        placeholder="sk_..."
                        value={elevenLabsKey}
                        onChange={(e) => setElevenLabsKey(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                </div>

                <div>
                    <label className="block font-bold text-gray-700 text-sm mb-2">ElevenLabs Voice ID</label>
                    <input
                        type="text"
                        placeholder="CwhRBWXzGAHq8TQ4Fs17"
                        value={voiceId}
                        onChange={(e) => setVoiceId(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                </div>

                <p className="mt-4 text-[10px] text-gray-400 leading-relaxed">
                    These keys are stored locally in your browser and are never sent to our servers except to call the respective APIs.
                </p>
            </div>

            <h2 className="text-xl font-bold mb-4">Database ({knownFaces.length})</h2>
            <div className="grid gap-4">
                {knownFaces.map((face, i) => (
                    <div key={i} className="p-4 bg-white border border-gray-200 shadow-sm rounded-xl relative group">
                        <button
                            onClick={() => handleDelete(face.name)}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={20} />
                        </button>

                        <div className="flex items-center gap-3 mb-2">
                            <img
                                src={face.faceImage || "https://via.placeholder.com/50"}
                                className="w-12 h-12 rounded-full object-cover border border-gray-100"
                                alt={face.name}
                            />
                            <div>
                                <strong className="block text-lg text-gray-900 leading-none">{face.name}</strong>
                                <span className="text-xs text-gray-500 block mb-1">{face.bio}</span>
                                {face.contact && (
                                    <span className="text-xs font-bold text-gray-600 block mb-1">
                                        📞 {face.contact}
                                    </span>
                                )}
                                {face.tags && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {face.tags.map((tag, idx) => (
                                            <span key={idx} className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded border border-blue-100 font-semibold">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            {face.history && face.history.length > 0 && (
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Recent</div>
                            )}
                            {face.history && face.history.slice(-3).map((h, k) => (
                                <div key={k} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg">
                                    <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase rounded ${h.emotion === 'Happy' ? 'bg-green-500' :
                                        h.emotion === 'Sad' ? 'bg-blue-500' :
                                            h.emotion === 'Angry' ? 'bg-red-500' :
                                                h.emotion === 'Excited' ? 'bg-yellow-500' : 'bg-gray-400'
                                        }`}>
                                        {h.emotion || '-'}
                                    </span>
                                    <span className="line-clamp-2">{h.summary}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminPanel;
