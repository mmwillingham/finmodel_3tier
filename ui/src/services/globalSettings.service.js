import axios from 'axios';
import AuthService from './auth.service';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/?$/, '/'); // Ensure trailing slash

const getGlobalSettings = async (token) => {
    try {
        console.log(`globalSettings.service: Fetching global settings from ${API_URL}/admin/global-settings`);
        const response = await axios.get(`${API_URL}/admin/global-settings`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        console.log('globalSettings.service: Received global settings response:', response.data);
        return response.data;
    } catch (error) {
        console.error('globalSettings.service: Error fetching global settings:', error);
        throw error;
    }
};

const getHelpAboutContent = async () => {
    try {
        const token = AuthService.getToken();
        if (!token) {
            throw new Error('Authentication token missing');
        }
        const response = await axios.get(`${API_URL}content/help-about`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('globalSettings.service: Error fetching help/about content:', error);
        throw error;
    }
};

const updateGlobalSettings = async (globalSettingsData, token) => {
    const response = await axios.put(`${API_URL}/admin/global-settings`, globalSettingsData, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export default {
    getGlobalSettings,
    getHelpAboutContent,
    updateGlobalSettings,
};

