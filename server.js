const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const config = require('./config');

const app = express();
const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store conversation history
const conversations = new Map();

// API Routes
app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log('Received message:', message);
        console.log('Using API key:', config.OPENAI_API_KEY.substring(0, 20) + '...');

        // Get or create conversation history
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, []);
        }
        const conversation = conversations.get(sessionId);

        // Add user message to conversation
        conversation.push({ role: 'user', content: message });

        // Create system message with personality
        const systemMessage = {
            role: 'system',
            content: config.PERSONALITY_PROMPT
        };

        // Prepare messages for OpenAI
        const messages = [systemMessage, ...conversation.slice(-10)]; // Keep last 10 messages for context

        console.log('Sending to OpenAI:', messages.length, 'messages');

        let response;

        try {
            // Call OpenAI API
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo', // Using gpt-3.5-turbo for better compatibility
                messages: messages,
                max_tokens: 500,
                temperature: 0.7,
            });

            response = completion.choices[0].message.content;
            console.log('OpenAI response received');
        } catch (error) {
            // Log the error for debugging on Vercel
            console.error('OpenAI API Error:', error);

            // Fallback to a mock response for demonstration
            const mockResponse = getMockResponse(message);

            response = mockResponse;
        }

        // Add assistant response to conversation
        conversation.push({ role: 'assistant', content: response });

        res.json({
            response,
            conversation: conversation.slice(-10) // Return last 10 messages
        });

    } catch (error) {
        console.error('Server-side exception:', error);
        res.status(500).json({ error: 'A critical server error occurred.' });
    }
});

// Text-to-speech endpoint
app.post('/api/speak', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: text,
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': buffer.length,
        });

        res.send(buffer);

    } catch (error) {
        console.error('TTS Error:', error);
        res.status(500).json({ error: 'Failed to generate speech', details: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Voice Bot is running' });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const PORT = config.PORT;
app.listen(PORT, () => {
    console.log(`Voice Bot server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    console.log(`API Key configured: ${config.OPENAI_API_KEY ? 'Yes' : 'No'}`);
}); 