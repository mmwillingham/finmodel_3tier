import ApiService from "./api.service";

const sendContactMessage = (payload) => ApiService.post("/contact", payload);

const ContactService = { sendContactMessage };

export default ContactService;
