// ui/src/services/projection.service.js

import ApiService from "./api.service";

const ProjectionService = {
    // Defines the missing function you are calling
    async getProjectionDetails(id) {
        // Correct URL path is plural on the server, but your router is singular! 
        // We MUST use the server's plural path here: /projections/{id}
        const url = `/projections/${id}`;
        
        // ApiService.get returns the full Axios response object!
        const response = await ApiService.get(url);
        
        // CRITICAL: We return ONLY the data payload for the component to use
        return response.data;
    },

    // The function used in Calculator.js's submission
    async createProjection(payload) {
        const response = await ApiService.post("/projections", payload);
        return response.data; // CRITICAL: Return data payload
    },

    updateProjection: async (id, projectionData) => {
        const response = await ApiService.put(`/projections/${id}`, projectionData);
        return response.data;
    },
};

export default ProjectionService;
