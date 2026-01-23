import ApiService from "./api.service";

const TaxService = {
  calculateStateTax: () => ApiService.get("/tax/state"),
};

export default TaxService;
