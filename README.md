# ReminAiS (McHacks 13)
> **Empowering dementia patients to break isolation and create connections.**

![ReminAiS Demo](https://via.placeholder.com/800x400?text=ReminAiS+Dashboard+Preview)  

![ReminAiS: Your Memory Companion](infographics.jpg)

## 💡 Inspiration
Dementia is a thief that steals not just memories, but connection. For the millions of people living with Alzheimer's and dementia, the anxiety of not recognizing a loved one—a daughter, a lifelong friend, a grandchild—can be paralyzing. This anxiety often leads to social withdrawal and profound isolation.

We wanted to build a bridge. **ReminAiS** (Reminisce + AI) acts as a "digital hippocampus," whispering context into the user's ear the moment a visitor arrives, turning a moment of confusion into a moment of connection.

## 🧠 What it does
ReminAiS is an intelligent companion app running on a tablet or wearable device.

1.  **Instant Recognition**: When a visitor enters the room, the app uses **facial recognition** to instantly identify them.
2.  **Contextual Whisper**: It doesn't just say a name. Using **Google Gemini**, it generates a warm, personalized greeting based on the visitor's bio and *past conversations* (e.g., "This is Pierre, your grandson. Last time, you talked about his soccer game").
3.  **Human-Like Voice**: The greeting is read aloud using **ElevenLabs**' ultra-realistic text-to-speech, providing a comforting, familiar presence.
4.  **Memory Timeline**: It listens to the conversation (Speech-to-Text), summarizes it, and saves it to a timeline. This helps the patient recall what they talked about previously, reinforcing memory pathways.
5.  **Smart Dashboard**: A mobile-first interface for patients to view their connections and look back on happy memories.

## ⚙️ How we built it
We built ReminAiS with a modern, privacy-focused stack:

*   **Frontend**: Built with **React** and **Vite** for speed. We used **Tailwind CSS** to create a highly accessible, high-contrast UI suitable for elderly users.
*   **Computer Vision**: We implemented **face-api.js** to perform face detection and recognition *entirely in the browser*. This ensures sensitive biometric data doesn't necessarily need to leave the device.
*   **The Brain (AI)**: We leveraged **Google Gemini Pro** to process the context. We feed it the identified person's bio and the history of previous chats to generate natural, reassuring prompts.
*   **Voice**:
    *   **Input**: `react-speech-recognition` for transcribing live conversations.
    *   **Output**: **ElevenLabs API** for low-latency, emotionally resonant speech synthesis.
*   **Data Persistence**: Local storage (prototyping) to keep connection history and bios.

## 🚧 Challenges we ran into
*   **Real-time Performance**: Running face detection alongside a webcam feed in the browser can be heavy. We had to optimize the recognition interval to balance accuracy with battery life/performance.
*   **Context Window**: Feeding the *entire* conversation history to the LLM can get expensive and slow. We implemented a summarization step where Gemini condenses a conversation into a short memory before saving it to the database.
*   **Hardware Access**: Managing permissions for Camera and Microphone simultaneously while switching between "Admin" and "Patient" modes required careful state management in React.

## 🏅 Accomplishments that we're proud of
*   **It works offline-ish**: The face detection model loads locally. Even if the internet dips, the core recognition visual (bounding box) remains active.
*   **The UI**: We migrated from basic CSS to a polished **Tailwind** design that looks great on mobile devices (the intended form factor).
*   **Emotional AI**: The prompts we engineered for Gemini actually feel reassuring. It doesn't just list facts; it frames them gently ("Look, it's your friend...").

## 🚀 What's next for ReminAiS
*   **Sentiment Analysis**: Tracking the patient's mood over time based on facial expressions during interactions.
*   **Wearable Integration**: Moving from a tablet to smart glasses (like Ray-Ban Meta or similar) for a seamless heads-up display.
*   **Cloud Sync for Families**: An app for family members to upload their own photos and "life updates" remotely, which get fed into the patient's context for their next visit.

---

## 💻 Tech Stack Setup

### Prerequisites
*   Node.js (v16+)
*   npm

### Installation

1.  **Clone the repo**
    ```bash
    git clone https://github.com/kaidalisohaib/McHacks13.git 
    cd McHacks13/reminisce
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables**
    Create `.env.local`:
    ```env
    VITE_GEMINI_KEY=your_key_here
    VITE_ELEVEN_KEY=your_key_here
    VITE_VOICE_ID=your_voice_id
    ```

4.  **Run**
    ```bash
    npm run dev
    ```

---
*Built with ❤️ at McHacks 13.*
