import React from 'react';
import Webcam from 'react-webcam';

const PatientHUD = ({
    webcamRef,
    currentFace,
    lastEmotion,
    transcript,
    listening,
    setMode
}) => {
    return (
        <div className="patient-mode">
            <Webcam
                ref={webcamRef}
                className="full-webcam"
                videoConstraints={{ facingMode: "user" }}
            />

            <div className="hud">
                {currentFace ? (
                    <div className="detected-box">
                        <h2>{currentFace}</h2>
                        {lastEmotion && <span className="live-mood">Mood: {lastEmotion}</span>}
                        <div style={{ fontSize: '0.8rem', marginTop: '10px', color: '#aaa' }}>
                            Live Transcript: {transcript.substring(transcript.length - 50)}...
                        </div>
                    </div>
                ) : (
                    <div className="scanning">Scanning...</div>
                )}

                {listening && <div className="rec-indicator">● Listening</div>}
            </div>

            <button className="secret-exit" onClick={() => setMode('ADMIN')}></button>
        </div>
    );
};

export default PatientHUD;
