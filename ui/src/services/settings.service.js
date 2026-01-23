import ApiService from "./api.service";

const getSettings = (viewingUserId = null) => {
  const params = {};
  if (viewingUserId !== null && viewingUserId !== undefined) {
    params.viewing_user_id = viewingUserId;
  }
  return ApiService.get("/settings", params.viewing_user_id ? { params } : undefined);
};
const updateSettings = (data) => ApiService.put("/settings", data);

const checkCategoryUsage = (categoryName, categoryType) => {
  return ApiService.post("/categories/check-usage", { category_name: categoryName, category_type: categoryType });
};

const getDefaultCategories = () => ApiService.get("/settings/default-categories");
const loadDefaultCategories = () => ApiService.post("/settings/load-default-categories");

const SettingsService = { getSettings, updateSettings, checkCategoryUsage, getDefaultCategories, loadDefaultCategories };

export default SettingsService;