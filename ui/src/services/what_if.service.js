import axios from 'axios';
import authHeader from './auth-header';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const askQuestion = async (question) => {
  try {
    const response = await axios.post(
      `${API_URL}/what-if/ask`,
      { question },
      { headers: authHeader() }
    );
    return response.data;
  } catch (error) {
    console.error('Error asking What If question:', error);
    throw error;
  }
};

const whatIfService = {
  askQuestion,
};

export default whatIfService;
