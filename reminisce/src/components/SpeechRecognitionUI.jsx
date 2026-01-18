import useSpeechRecognition from '../hooks/useSpeechRecognition';

function SpeechRecognitionUI() {
  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    isBrowserSupported,
  } = useSpeechRecognition();

  if (!isBrowserSupported) {
    return (
      <div className="speech-container">
        <p style={{ color: 'red' }}>
          Web Speech API is not supported in your browser. Please use Chrome, Edge, or Safari.
        </p>
      </div>
    );
  }

  return (
    <div className="speech-container">
      <div className="speech-controls">
        <button
          onClick={startListening}
          disabled={isListening}
          className="btn-listen"
        >
          🎤 Start Listening
        </button>
        <button
          onClick={stopListening}
          disabled={!isListening}
          className="btn-stop"
        >
          ⏹️ Stop
        </button>
        <button
          onClick={resetTranscript}
          className="btn-reset"
        >
          🔄 Clear
        </button>
      </div>

      <div className={`speech-status ${isListening ? 'listening' : ''}`}>
        {isListening ? '🎤 Listening...' : 'Ready'}
      </div>

      <div className="speech-transcript">
        <p>{transcript || 'No speech detected yet...'}</p>
      </div>
    </div>
  );
}

export default SpeechRecognitionUI;
