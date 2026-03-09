import ApiService from './api.service';

type SettingsResponse = any;
type CategoryUsagePayload = {
  category_name: string;
  category_type: string;
};

const getSettings = (viewingUserId: number | null = null) => {
  const config = viewingUserId !== null ? { params: { viewing_user_id: viewingUserId } } : undefined;
  return ApiService.get<SettingsResponse>('/settings', config);
};
const updateSettings = (data: any) => ApiService.put<SettingsResponse>('/settings', data);

const checkCategoryUsage = (categoryName: string, categoryType: string) => {
  return ApiService.post('/categories/check-usage', {
    category_name: categoryName,
    category_type: categoryType,
  });
};

const getDefaultCategories = () => ApiService.get<SettingsResponse[]>('/settings/default-categories');
const loadDefaultCategories = () => ApiService.post('/settings/load-default-categories');
const getSubscriptionLimits = () => ApiService.get<SettingsResponse>('/settings/limits');

const SettingsService = { getSettings, updateSettings, checkCategoryUsage, getDefaultCategories, loadDefaultCategories, getSubscriptionLimits };

export default SettingsService;