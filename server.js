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
                model: 'gpt-3.5-turbo',
                messages: messages,
                max_tokens: 500,
                temperature: 0.7,
            });

            response = completion.choices[0].message.content;
            console.log('OpenAI response received');
        } catch (apiError) {
            console.log('API Error, using mock response:', apiError.message);

            // Mock responses for demo purposes
            const mockResponses = {
                'life story': "I'm someone who's always been curious about the world and passionate about learning. I grew up in a family that valued education and creativity, which shaped my love for problem-solving and helping others. Throughout my journey, I've discovered that my greatest strength lies in connecting with people and finding innovative solutions to complex challenges. I believe in continuous growth and making a positive impact wherever I can.",
                'superpower': "My #1 superpower is my ability to see connections where others might not. I have this knack for taking complex problems and breaking them down into manageable pieces, then finding creative solutions that work for everyone involved. It's like having a mental map that helps me navigate through chaos and bring clarity to confusing situations.",
                'growth areas': "The top 3 areas I'd like to grow in are: 1) Public speaking and communication - I want to become more confident and compelling when presenting ideas to larger groups. 2) Technical skills - I'm always eager to learn new technologies and stay current with the latest developments. 3) Leadership - I want to develop my ability to inspire and guide teams toward shared goals while maintaining authenticity.",
                'misconception': "I think the biggest misconception my coworkers have about me is that I'm always confident and have everything figured out. The truth is, I often feel uncertain and have to work through doubts just like everyone else. I've learned to project confidence because it helps others feel secure, but internally I'm constantly questioning and refining my approach.",
                'boundaries': "I push my boundaries by deliberately stepping outside my comfort zone. I seek out projects that scare me a little, take on roles where I'm not the expert, and actively ask for feedback that might be uncomfortable to hear. I believe growth happens at the edges of what we think we're capable of, so I try to live there as much as possible."
            };

            // Find the best matching mock response
            const lowerMessage = message.toLowerCase();
            let bestMatch = 'life story'; // default

            for (const [key, response] of Object.entries(mockResponses)) {
                if (lowerMessage.includes(key)) {
                    bestMatch = key;
                    break;
                }
            }

            response = mockResponses[bestMatch];
        }

        // Add assistant response to conversation
        conversation.push({ role: 'assistant', content: response });

        res.json({
            response,
            conversation: conversation.slice(-10) // Return last 10 messages
        });

    } catch (error) {
        console.error('Detailed error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to get response from AI', details: error.message });
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