import ApiService from './api.service';

type ContactPayload = any;

const sendContactMessage = (payload: ContactPayload) => ApiService.post('/contact', payload);

const ContactService = { sendContactMessage };

export default ContactService;
