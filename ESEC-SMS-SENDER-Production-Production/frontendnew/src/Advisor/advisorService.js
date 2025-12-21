import axios from 'axios';
import appSettings from '../appsettings';

// இந்த global செட்டிங் இங்கே ஒருமுறை செய்தால் போதும்
axios.defaults.withCredentials = true;

const API_URL = `${appSettings.apiUrl}/api/advisor`;

// ஒவ்வொரு API அழைப்புக்கும் ஒரு செயல்பாடு (function)
export const getAdvisorDetails = () => {
    return axios.get(`${API_URL}/get-advisor-details`);
};

export const getStudents = (params) => {
    return axios.get(`${API_URL}/get-students`, { params });
};

export const getSubjects = (params) => {
    return axios.get(`${API_URL}/get-subjects`, { params });
};

export const deleteSubjects = (subjectCodes) => {
    return axios.delete(`${API_URL}/delete-subjects`, {
        data: { subjectCodes }
    });
};