import ApiService from './api.service';

const askQuestion = async (question) => {
  try {
    const response = await ApiService.post('/what-if/ask', { question });
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
