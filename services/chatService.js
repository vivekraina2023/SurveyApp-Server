const { HfInference } = require('@huggingface/inference');

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

const FALLBACK_RESPONSES = {
  greeting: "Good morning! How can I help you today?",
  name: "I'm an AI assistant. You can call me Bot.",
  default: "I apologize, I'm having trouble understanding. Could you rephrase that?",
  error: "I'm sorry, I'm having technical difficulties. Please try again."
};

const chatService = {
  async processMessage(message) {
    try {
      // Normalize the input message
      const normalizedMessage = message.toLowerCase().trim();

      // Check for common patterns and return predefined responses
      if (this.isGreeting(normalizedMessage)) {
        return FALLBACK_RESPONSES.greeting;
      }
      if (this.isNameQuestion(normalizedMessage)) {
        return FALLBACK_RESPONSES.name;
      }

      const response = await hf.textGeneration({
        model: 'distilgpt2',
        inputs: `Human: ${message}\nAssistant: Let me help you with that. `,
        parameters: {
          max_new_tokens: 50,
          temperature: 0.7,
          do_sample: true,
          num_return_sequences: 1,
          top_k: 50,
          top_p: 0.9
        }
      });

      console.log("Raw response = ", response);

      if (response && response.generated_text) {
        // Extract only the assistant's response
        let cleanedResponse = response.generated_text
          .split('Assistant:')[1]  // Get text after 'Assistant:'
          ?.split('Human:')[0]     // Remove any following Human: text
          ?.replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII characters
          ?.trim();

        // Additional cleaning
        cleanedResponse = cleanedResponse
          ?.replace(/\?+/g, '?')   // Replace multiple question marks
          ?.replace(/!+/g, '!')    // Replace multiple exclamation marks
          ?.replace(/\.+/g, '.')   // Replace multiple periods
          ?.replace(/\s+/g, ' ');  // Replace multiple spaces

        // Validate response
        if (cleanedResponse && 
            cleanedResponse.length >= 2 && 
            !/^[?!.,\s]+$/.test(cleanedResponse)) {  // Check if response is only punctuation
          return cleanedResponse;
        }
      }
      
      return FALLBACK_RESPONSES.default;

    } catch (error) {
      console.error('Chat processing error:', error);
      return FALLBACK_RESPONSES.error;
    }
  },

  isGreeting(message) {
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
    return greetings.some(greeting => message.includes(greeting));
  },

  isNameQuestion(message) {
    const namePatterns = ['what is your name', 'what should i call you', 'who are you'];
    return namePatterns.some(pattern => message.includes(pattern));
  }
};

module.exports = chatService; 