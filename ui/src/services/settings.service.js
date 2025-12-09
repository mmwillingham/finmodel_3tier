import ApiService from "./api.service";

const getSettings = () => ApiService.get("/settings");
const updateSettings = (data) => ApiService.put("/settings", data);

export default { getSettings, updateSettings };