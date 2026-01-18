import React, { useState } from 'react';
import Webcam from 'react-webcam';

const AdminPanel = ({ webcamRef, knownFaces, addFace, setMode }) => {
    const [nameInput, setNameInput] = useState('');
    const [bioInput, setBioInput] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const handleAddFace = async () => {
        if (isAdding) return;
        setIsAdding(true);

        try {
            const success = await addFace(webcamRef, nameInput, bioInput);
            if (success) {
                alert(`Saved ${nameInput}!`);
                setNameInput('');
                setBioInput('');
            } else {
                alert("No face detected or missing name. Try again.");
            }
        } catch (e) {
            console.error("Add face error", e);
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="admin-mode">
            <h1>Reminisce Admin</h1>
            <div className="webcam-container small">
                <Webcam ref={webcamRef} screenshotFormat="image/jpeg" />
            </div>
            <div className="controls">
                <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    placeholder="Name"
                />
                <input
                    value={bioInput}
                    onChange={e => setBioInput(e.target.value)}
                    placeholder="Initial Context"
                />
                <button onClick={handleAddFace} disabled={isAdding}>
                    {isAdding ? "Saving..." : "Save Face"}
                </button>
                <button className="switch-btn" onClick={() => setMode('PATIENT')}>
                    Enter Patient Mode
                </button>
            </div>
            <div className="list">
                {knownFaces.map((face, i) => (
                    <div key={i} className="face-card">
                        <strong>{face.name}</strong>
                        <div className="history">
                            {face.history && face.history.map((h, k) => (
                                <div key={k} className="history-item">
                                    <span className={`mood ${h.emotion || 'Neutral'}`}>
                                        {h.emotion || 'Neutral'}
                                    </span>
                                    {h.summary}
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
