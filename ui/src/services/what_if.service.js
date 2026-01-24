import ApiService from './api.service';
import AuthService from './auth.service';

const askQuestion = async (question, onChunk) => {
  try {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    const token = AuthService.getToken();
    
    const response = await fetch(`${API_URL}/what-if/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to get answer' }));
      throw new Error(errorData.detail || 'Failed to get answer');
    }

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullAnswer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages (lines ending with \n\n)
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
            
            if (data.chunk) {
              fullAnswer += data.chunk;
              // Call the callback with each chunk
              if (onChunk) {
                onChunk(data.chunk, fullAnswer);
              }
            } else if (data.done) {
              // Stream complete
              return { answer: fullAnswer };
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
          }
        }
      }
    }

    return { answer: fullAnswer };
  } catch (error) {
    throw error;
  }
};

const whatIfService = {
  askQuestion,
};

export default whatIfService;
