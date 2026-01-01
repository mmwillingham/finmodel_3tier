// ui/src/services/projection.service.js

import ApiService from "./api.service";

const ProjectionService = {
    // Get all projections for the current user
    async getProjections() {
        const response = await ApiService.get("/projections");
        return response.data; // Ensure consistency, return .data
    },

    // Get details for a specific projection
    async getProjectionDetails(id) {
        const url = `/projections/${id}`;
        const response = await ApiService.get(url);
        return response.data;
    },

    // Create a new projection
    async createProjection(payload) {
        // The payload here should conform to schemas.ProjectionRequest
        const response = await ApiService.post("/projections", payload);
        return response.data;
    },

    // Update an existing projection
    async updateProjection(id, projectionData) {
        // The projectionData here should conform to schemas.ProjectionRequest
        const response = await ApiService.put(`/projections/${id}`, projectionData);
        return response.data;
    },

    // Delete a projection
    async deleteProjection(id) {
        const response = await ApiService.delete(`/projections/${id}`);
        return response.data;
    },
};

export default ProjectionService;
