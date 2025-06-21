// Wrap the entire script in a class to keep things organized
class VoiceBot {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentAudio = null;

        // Example questions to display
        this.exampleQuestions = [
            "What should we know about your life story in a few sentences?",
            "What's your #1 superpower?",
            "What are the top 3 areas you'd like to grow in?",
            "What misconception do your coworkers have about you?",
            "How do you push your boundaries and limits?"
        ];

        this.initializeElements();
        this.bindEvents();
        this.addWelcomeMessage();
        this.populateExampleQuestions();
        this.updateStatus('Ready');
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    initializeElements() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.voiceButton = document.getElementById('voiceButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.statusElement = document.getElementById('status');
        this.exampleQuestionsContainer = document.getElementById('exampleQuestions');
    }

    bindEvents() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                this.sendMessage();
            }
        });
        this.voiceButton.addEventListener('mousedown', () => this.startRecording());
        this.voiceButton.addEventListener('mouseup', () => this.stopRecording());
        this.voiceButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording();
        });
        this.voiceButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });
    }

    addWelcomeMessage() {
        const welcomeText = "Hi! I'm your personal voice bot. You can ask me questions about myself, my life story, my superpowers, growth areas, or anything else. I'll respond as authentically as I would in a real conversation. Try asking me something!";
        this.addMessage('bot', welcomeText);
    }

    populateExampleQuestions() {
        this.exampleQuestions.forEach(q => {
            const button = document.createElement('button');
            button.textContent = q;
            button.className = 'example-question';
            button.onclick = () => {
                this.messageInput.value = q;
                this.sendMessage();
            };
            this.exampleQuestionsContainer.appendChild(button);
        });
    }

    async sendMessage() {
        const messageText = this.messageInput.value.trim();
        if (!messageText) return;

        this.addMessage('user', messageText);
        this.messageInput.value = '';
        this.updateStatus('Processing...');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText, sessionId: this.sessionId })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const data = await response.json();
            this.addMessage('bot', data.reply, data.audioUrl);
            this.updateStatus('Ready');

            if (data.audioUrl) {
                this.playAudio(data.audioUrl);
            }

        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage('bot', "Sorry, I'm having trouble connecting. Please try again later.");
            this.updateStatus('Error');
        }
    }

    addMessage(sender, text, audioUrl = null) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', `${sender}-message`);

        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        messageContent.textContent = text;

        // Add an icon for the bot
        if (sender === 'bot') {
            const icon = document.createElement('i');
            icon.className = 'fas fa-robot icon';
            messageWrapper.appendChild(icon);
        }

        messageWrapper.appendChild(messageContent);

        // If there's audio, create a play button within the message
        if (audioUrl) {
            const playButton = document.createElement('button');
            playButton.className = 'message-play-button';
            playButton.innerHTML = '<i class="fas fa-play"></i>';
            playButton.onclick = () => this.playAudio(audioUrl);
            messageContent.appendChild(playButton);
        }

        this.chatMessages.appendChild(messageWrapper);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateStatus(text) {
        this.statusElement.textContent = text;
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = event => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.sendAudio(audioBlob);
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateStatus('Recording...');
            this.voiceButton.classList.add('recording');
        } catch (error) {
            console.error('Error starting recording:', error);
            this.updateStatus('Mic access denied');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateStatus('Processing audio...');
            this.voiceButton.classList.remove('recording');
        }
    }

    async sendAudio(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('sessionId', this.sessionId);

        try {
            this.updateStatus('Transcribing...');
            const response = await fetch('/api/voice', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const data = await response.json();
            this.addMessage('user', `"${data.transcript}"`);
            this.addMessage('bot', data.reply, data.audioUrl);
            this.updateStatus('Ready');

            if (data.audioUrl) {
                this.playAudio(data.audioUrl);
            }

        } catch (error) {
            console.error('Error sending audio:', error);
            this.addMessage('bot', "Sorry, I couldn't process the audio. Please try again.");
            this.updateStatus('Error');
        }
    }

    playAudio(audioUrl) {
        if (this.currentAudio) {
            this.currentAudio.pause();
        }
        this.currentAudio = new Audio(audioUrl);
        this.currentAudio.play();
        this.updateStatus('Playing response...');
        this.currentAudio.onended = () => {
            this.updateStatus('Ready');
        };
    }
}

// Initialize the bot once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new VoiceBot();
}); 