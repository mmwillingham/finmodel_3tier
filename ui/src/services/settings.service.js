import ApiService from "./api.service";

const getSettings = () => ApiService.get("/settings");
const updateSettings = (data) => ApiService.put("/settings", data);

const checkCategoryUsage = (categoryName, categoryType) => {
  return ApiService.post("/categories/check-usage", { category_name: categoryName, category_type: categoryType });
};

const SettingsService = { getSettings, updateSettings, checkCategoryUsage };

export default SettingsService;