const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// உங்கள் ப்ராஜெக்ட் அமைப்பிற்கு ஏற்ப path-ஐ சரிசெய்யவும்
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// .env கோப்பில் இருந்து API விவரங்களைப் பெறுதல்
const apiKey = process.env.SMS_API_KEY;
const senderId = process.env.SMS_SENDER_ID;
const templateId = process.env.SMS_TEMPLATE_ID;

// API விவரங்கள் சரியாக உள்ளதா எனச் சரிபார்த்தல்
if (!apiKey || !senderId || !templateId) {
    throw new Error("SMS credentials (SMS_API_KEY, SMS_SENDER_ID, SMS_TEMPLATE_ID) உங்கள் .env கோப்பில் இல்லை.");
}

/**
 * பாடத்தின் பெயரை 2 அல்லது 3 எழுத்துக்களில் சுருக்கும் செயல்பாடு.
 */
function abbreviateSubjectName(subjectName) {
    if (!subjectName || typeof subjectName !== 'string') return 'SUB';

    const cleanedName = subjectName.replace(/\b(and|in|of|for|to|system|lab)\b/gi, '').trim();
    const words = cleanedName.split(/\s+/).filter(Boolean);

    if (words.length === 0) return 'SUB';

    const numbers = cleanedName.match(/\d+/g);
    if (words.length > 0 && numbers) {
        const firstWordAbbr = words[0].substring(0, 1).toUpperCase();
        return firstWordAbbr + numbers.join('');
    }
    
    if (words.length > 1) {
        return words.map(word => word[0]).join('').substring(0, 3).toUpperCase();
    }

    if (words.length === 1) {
        const word = words[0];
        return word.substring(0, Math.min(word.length, 3)).toUpperCase();
    }

    return 'SUB';
}

/**
 * ஒரு மாணவருக்கு அவர்களின் தேர்வு மதிப்பெண்களுடன் SMS அனுப்பும்.
 */
exports.sendMarks = async (student, examType, marks) => {
    const phoneNumber = student.whatsapp;
    if (!phoneNumber) {
        console.error(`❌ Skipped: ${student.name} (${student.rollno}) க்கு தொலைபேசி எண் இல்லை.`);
        return { success: false, error: 'Phone number not found for student' };
    }

    let passCount = 0;
    let absentCount = 0;
    const passMark = 50;
    const totalSubjects = marks.length;
    
    const firstGroup = [];
    const secondGroup = [];

    marks.forEach((markEntry, index) => {
        const subjectName = markEntry.subject;
        const abbreviatedName = abbreviateSubjectName(subjectName);
        const markValue = markEntry[examType.toUpperCase()];
        let subjectMarkString;

        if (markValue === null || markValue === undefined || ['A', 'AB'].includes(String(markValue).trim().toUpperCase())) {
            absentCount++;
            subjectMarkString = `${abbreviatedName}-AB`;
        } else {
            const numericMark = parseInt(markValue, 10);
            if (!isNaN(numericMark)) {
                if (numericMark >= passMark) passCount++;
                subjectMarkString = `${abbreviatedName}-${numericMark}`;
            } else {
                absentCount++;
                subjectMarkString = `${abbreviatedName}-AB`;
            }
        }
        
        if (index < 3) {
            firstGroup.push(subjectMarkString);
        } else {
            secondGroup.push(subjectMarkString);
        }
    });

    const failCount = totalSubjects - passCount - absentCount;

    // உங்கள் டெம்ப்ளேட்டின் படி முழுமையான மெசேஜை உருவாக்குதல்
    const finalMessage = `Dear ${student.name} Exam Name: ${examType} Result Published ${firstGroup.join(',')}-${secondGroup.join(',')} விடுப்பு(Absent):${absentCount} மொத்தம் பாடம்(Total Subjects):${totalSubjects} தேர்ச்சி(Pass):${passCount} தோல்வி(Fail):${failCount} Erode Sengunthar Engineering College`;

    // மெசேஜை URL Encoding செய்தல்
    const encodedMessage = encodeURIComponent(finalMessage);
    
    // API URL மற்றும் இறுதி URL-ஐ உருவாக்குதல்
    const apiUrl = "http://bulksms.2020sms.com/vb/apikey.php";
    const fullUrl = `${apiUrl}?apikey=${apiKey}&senderid=${senderId}&templateid=${templateId}&number=${phoneNumber}&message=${encodedMessage}&unicode=2`;

    console.log("==========================================");
    console.log(`  SENDING MARKS SMS TO: ${student.name}  `);
    console.log("Final Message:", finalMessage);
    console.log("------------------------------------------");

    try {
        // Axios மூலம் SMS API-க்கு GET request அனுப்புதல்
        const response = await axios.get(fullUrl, { timeout: 10000 });
        console.log("API Response Body:", response.data);
        
        const responseDataStr = JSON.stringify(response.data).toLowerCase();
        if (response.status === 200 && responseDataStr.includes('success')) {
            return { success: true, data: response.data };
        } else {
            return { success: false, error: `API error: ${JSON.stringify(response.data)}` };
        }
    } catch (error) {
        console.error(`SMS API REQUEST FAILED for ${student.name}:`, error.message);
        return { success: false, error: error.message };
    }
};