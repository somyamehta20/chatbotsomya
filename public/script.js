class VoiceBot {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentAudio = null;

        this.initializeElements();
        this.bindEvents();
        this.updateStatus('Ready');
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    initializeElements() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.voiceButton = document.getElementById('voiceButton');
        this.playButton = document.getElementById('playButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
    }

    bindEvents() {
        // Text input events
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // Voice recording events
        this.voiceButton.addEventListener('mousedown', () => {
            this.startRecording();
        });

        this.voiceButton.addEventListener('mouseup', () => {
            this.stopRecording();
        });

        this.voiceButton.addEventListener('mouseleave', () => {
            if (this.isRecording) {
                this.stopRecording();
            }
        });

        // Touch events for mobile
        this.voiceButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording();
        });

        this.voiceButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });

        // Play button
        this.playButton.addEventListener('click', () => {
            this.playLastResponse();
        });

        // Focus input on load
        this.messageInput.focus();
    }

    async sendMessage(message = null) {
        const text = message || this.messageInput.value.trim();
        if (!text) return;

        // Clear input
        this.messageInput.value = '';

        // Add user message to chat
        this.addMessage(text, 'user');

        // Show typing indicator
        this.showTypingIndicator();

        try {
            this.updateStatus('Processing...');

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: text,
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();

            // Remove typing indicator
            this.removeTypingIndicator();

            // Add bot response to chat
            this.addMessage(data.response, 'bot');

            // Generate and store audio
            await this.generateAudio(data.response);

            this.updateStatus('Ready');

        } catch (error) {
            console.error('Error:', error);
            this.removeTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
            this.updateStatus('Error');
        }
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const icon = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';

        messageDiv.innerHTML = `
            <div class="message-content">
                <i class="${icon}"></i>
                <p>${this.escapeHtml(text)}</p>
            </div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-indicator';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-content">
                <i class="fas fa-robot"></i>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async startRecording() {
        try {
            this.updateStatus('Recording...');
            this.isRecording = true;
            this.voiceButton.classList.add('recording');
            this.audioChunks = [];

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.processAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
        } catch (error) {
            console.error('Error starting recording:', error);
            this.updateStatus('Microphone access denied');
            this.isRecording = false;
            this.voiceButton.classList.remove('recording');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.voiceButton.classList.remove('recording');
        }
    }

    async processAudio(audioBlob) {
        try {
            this.updateStatus('Processing audio...');

            // For now, we'll use a simple approach
            // In a production app, you'd want to use a speech-to-text service
            // For demo purposes, we'll show a message asking for text input
            this.addMessage('Voice input detected! Please type your question for now.', 'bot');
            this.updateStatus('Ready');

            // Focus on input for user to type
            this.messageInput.focus();

        } catch (error) {
            console.error('Error processing audio:', error);
            this.updateStatus('Audio processing failed');
        }
    }

    async generateAudio(text) {
        try {
            const response = await fetch('/api/speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error('Failed to generate audio');
            }

            const audioBlob = await response.blob();
            this.currentAudio = URL.createObjectURL(audioBlob);

            // Show play button
            this.playButton.style.display = 'flex';

        } catch (error) {
            console.error('Error generating audio:', error);
        }
    }

    playLastResponse() {
        if (this.currentAudio) {
            const audio = new Audio(this.currentAudio);
            audio.play();
        }
    }

    updateStatus(status) {
        this.statusText.textContent = status;
        this.statusDot.className = 'fas fa-circle status-dot';

        if (status === 'Recording...') {
            this.statusDot.classList.add('recording');
        } else if (status === 'Processing...' || status === 'Processing audio...') {
            this.statusDot.classList.add('processing');
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

// Global function for example questions
function askQuestion(question) {
    voiceBot.sendMessage(question);
}

// Initialize the voice bot when the page loads
let voiceBot;
document.addEventListener('DOMContentLoaded', () => {
    voiceBot = new VoiceBot();
}); 