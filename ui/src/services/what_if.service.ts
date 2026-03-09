import AuthService from './auth.service';

type ChunkCallback = (chunk: string, fullAnswer: string) => void;
interface StreamData {
  chunk?: string;
  done?: boolean;
  error?: string;
}

const askQuestion = async (question: string, onChunk?: ChunkCallback): Promise<{ answer: string }> => {
  try {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    const token = AuthService.getToken();

    const response = await fetch(`${API_URL}/what-if/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to get answer' }));
      throw new Error(errorData.detail || 'Failed to get answer');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to read response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullAnswer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as StreamData;

            if (data.chunk) {
              fullAnswer += data.chunk;
              if (onChunk) {
                onChunk(data.chunk, fullAnswer);
              }
            } else if (data.done) {
              return { answer: fullAnswer };
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch {
            /* swallow parse errors */
          }
        }
      }
    }

    return { answer: fullAnswer };
  } catch (error: any) {
    throw error;
  }
};

const whatIfService = {
  askQuestion,
};

export default whatIfService;
