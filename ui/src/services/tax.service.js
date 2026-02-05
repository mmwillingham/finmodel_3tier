import ApiService from "./api.service";

const TaxService = {
  calculateStateTax: (params = {}) => ApiService.get("/tax/state", { params }),
};

export default TaxService;
