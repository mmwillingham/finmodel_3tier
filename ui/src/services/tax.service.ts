import ApiService from './api.service';

type TaxParams = Record<string, string | number | boolean | undefined>;

const TaxService = {
  calculateStateTax: (params: TaxParams = {}) => ApiService.get('/tax/state', { params }),
};

export default TaxService;
