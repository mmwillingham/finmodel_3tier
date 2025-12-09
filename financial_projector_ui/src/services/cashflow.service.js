import ApiService from "./api.service";

const list = (isIncome) => ApiService.get("/cashflow", { params: { is_income: isIncome } });
const create = (data) => ApiService.post("/cashflow", data);
const update = (id, data) => ApiService.put(`/cashflow/${id}`, data);
const remove = (id) => ApiService.delete(`/cashflow/${id}`);

export default { list, create, update, remove };