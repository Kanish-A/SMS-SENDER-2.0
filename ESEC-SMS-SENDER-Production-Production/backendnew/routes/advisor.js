const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { sendMarks, sendBulkAnnouncement } = require('./twilio');
const multer = require('multer');
const XLSX = require('xlsx');


const upload = multer({ dest: 'uploads/' });

function isAuthenticated(req, res, next) {
    // --- DEBUGGING LOG ---
    console.log('--- Checking Authentication ---');
    console.log('Session User:', req.session.user); 
    // --------------------

    if (req.session.user && (req.session.user.userType === 'advisor' || req.session.user.userType === 'admin')) {
        console.log('Access Granted');
        return next();
    }
    
    console.log('Access Denied');
    return res.status(401).json({ message: 'Unauthorized' });
}

function isAdvisor(req, res, next) {
    if (req.session.user && req.session.user.userType === 'advisor') {
        next();
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
}

// GET /api/advisor/get-advisor-details
router.get('/get-advisor-details', isAuthenticated, async (req, res) => {
    const username = req.session.user.username;
    try {
        const [advisor] = await query(
            'SELECT name, department, semester, year, class FROM advisors WHERE username = ?',
            [username]
        );
        if (!advisor || Object.keys(advisor).length === 0) {
            return res.status(404).send('Advisor details not found');
        }
        res.json(advisor);
    } catch (err) {
        console.error(err.message);
        return res.status(500).send(err.message);
    }
});

// GET /api/advisor/get-students
router.get('/get-students', isAuthenticated, async (req, res) => {
    const username = req.session.user.username;
    try {
        const [advisor] = await query(
            'SELECT department, year, semester, class FROM advisors WHERE username = ?',
            [username]
        );
        if (!advisor || Object.keys(advisor).length === 0) {
            return res.status(404).send('Advisor not found');
        }
        const { department, year, semester, class: className } = advisor;
        const students = await query(
            `SELECT * FROM students WHERE department = ? AND year = ? AND semester = ? AND class = ? ORDER BY rollno ASC`,
            [department, year, semester, className]
        );
        res.json(students);
    } catch (err) {
        console.error(err.message);
        return res.status(500).send(err.message);
    }
});

// GET /api/advisor/get-marks
router.get('/get-marks', isAdvisor, async (req, res) => {
    try {
        const { rollno, semester, department } = req.query;
        if (!rollno || !semester || !department) {
            return res.status(400).json({ message: 'Missing required query parameters' });
        }
        const examMarksRows = await query(`
            SELECT sm.subject_code, sm.exam_type, sm.marks, s.subject_name 
            FROM student_marks sm
            JOIN subjects s ON sm.subject_code = s.subject_code AND s.department = ? AND s.semester = ?
            WHERE sm.student_rollno = ? AND sm.exam_type IN ('CAT1', 'CAT2', 'MODEL')
        `, [department, semester, rollno]);
        
        const attendanceRows = await query(`
            SELECT subject_code, marks FROM student_marks
            WHERE student_rollno = ? AND exam_type = 'ATTENDANCE'
        `, [rollno]);

        const marksByExam = { CAT1: {}, CAT2: {}, SEMESTER: {} };
        const subjects = [];

        examMarksRows.forEach(row => {
            const code = row.subject_code;
            const name = row.subject_name;
            let exam = row.exam_type.toUpperCase();
            const mark = row.marks;

            if (exam === 'MODEL') {
                exam = 'SEMESTER';
            }
            if (!subjects.some(subj => subj.subject_code === code)) {
                subjects.push({ subject_code: code, subject_name: name });
            }
            if (marksByExam[exam]) {
                marksByExam[exam][code] = mark;
            }
        });

        const attendanceData = {};
        attendanceRows.forEach(row => {
            if (row.subject_code === 'ATTENDANCE_1') {
                attendanceData.attendance1 = row.marks;
            }
            if (row.subject_code === 'ATTENDANCE_2') {
                attendanceData.attendance2 = row.marks;
            }
        });

        res.json({
            subjects,
            CAT1: marksByExam.CAT1,
            CAT2: marksByExam.CAT2,
            SEMESTER: marksByExam.SEMESTER,
            attendance1: attendanceData.attendance1 || null,
            attendance2: attendanceData.attendance2 || null,
        });

    } catch (err) {
        console.error('❌ ERROR FETCHING MARKS:', err.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET /api/advisor/get-subjects
router.get('/get-subjects', isAuthenticated, async (req, res) => {
    const username = req.session.user.username;
    try {
        const [advisor] = await query(
            'SELECT department, year, semester FROM advisors WHERE username = ?',
            [username]
        );
        if (!advisor || !advisor.department) {
            return res.status(400).json({ success: false, message: 'Advisor details missing' });
        }
        const { department, year, semester } = advisor;
        const subjects = await query(
            'SELECT subject_code, subject_name FROM subjects WHERE department = ? AND year = ? AND semester = ? ORDER BY subject_code',
            [department, year, semester]
        );
        res.json({ success: true, subjects });
    } catch (err) {
        console.error('Error fetching subjects:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/advisor/add-subjects
router.post('/add-subjects', isAuthenticated, async (req, res) => {
    const { subjects } = req.body;
    const username = req.session.user.username;
    if (!Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid subjects data' });
    }
    try {
        const [advisor] = await query('SELECT department, year, semester FROM advisors WHERE username = ?', [username]);
        if (!advisor || !advisor.department) {
            return res.status(400).json({ success: false, message: 'Advisor details missing' });
        }
        const { department, semester, year } = advisor;
        let successCount = 0;
        let skippedSubjects = [];
        for (const subject of subjects) {
            const { code, name } = subject;
            if (!code || !name) continue;
            try {
                await query('INSERT INTO subjects (subject_code, subject_name, department, year, semester) VALUES (?, ?, ?, ?, ?)', [code, name, department, year, semester]);
                successCount++;
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    skippedSubjects.push(code);
                } else {
                    console.error('Error inserting subject:', err.message);
                }
            }
        }
        let message = `${successCount} subject(s) added successfully.`;
        if (skippedSubjects.length > 0) {
            message += ` Skipped: ${skippedSubjects.join(', ')} (already exist).`;
        }
        return res.json({ success: true, message });
    } catch (err) {
        console.error('Error saving subjects:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/advisor/upload-marks
router.post('/upload-marks', isAuthenticated, upload.single('file'), async (req, res) => {
    const { examType } = req.body;
    if (!req.file || !examType) {
        return res.status(400).json({ success: false, message: 'Missing file or exam type' });
    }
    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (!data || data.length === 0) {
            return res.status(400).json({ success: false, message: 'No data found in the sheet.' });
        }

        let insertedCount = 0;
        let skippedCount = 0;
        
        for (const row of data) {
            const normalizedRow = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), value]));
            let registerNo = String(normalizedRow['student_rollno'] || '').trim();

            if (!registerNo) {
                skippedCount++;
                continue;
            }

            for (const key in normalizedRow) {
                if (['student_rollno', 'student_name'].includes(key)) continue;
                const subjectCode = key;
                const marks = normalizedRow[subjectCode];

                if (marks === null || marks === undefined || marks === '') continue;

                try {
                    await query(
                        `INSERT INTO student_marks (student_rollno, exam_type, subject_code, marks) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE marks = ?`,
                        [registerNo, examType.toUpperCase(), subjectCode, marks, marks]
                    );
                    insertedCount++;
                } catch (err) {
                    console.error(`Insert failed for ${registerNo} ${subjectCode}:`, err.message);
                }
            }
        }
        res.json({ success: true, message: `${insertedCount} mark(s) inserted. ${skippedCount} rows skipped.` });
    } catch (err) {
        console.error('❌ Server error:', err);
        res.status(500).json({ success: false, message: 'Error processing file.', error: err.message });
    }
});

// POST /api/advisor/send-marks
router.post('/send-marks', isAuthenticated, async (req, res) => {
    const { marksData } = req.body;
    if (!Array.isArray(marksData) || marksData.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    const results = [];
    for (const item of marksData) {
        const { rollno, examType } = item;
        try {
            const [student] = await query('SELECT * FROM students WHERE rollno = ?', [rollno]);
            if (!student) {
                results.push({ rollno, status: 'Student not found' });
                continue;
            }

            const finalExamType = examType.toUpperCase() === 'SEMESTER' ? 'MODEL' : examType.toUpperCase();
            
            const rawMarks = await query(
                `SELECT DISTINCT s.subject_name, sm.marks
                FROM student_marks sm
                JOIN subjects s ON sm.subject_code = s.subject_code
                WHERE sm.student_rollno = ? 
                AND sm.exam_type = ?
                AND s.department = ? 
                AND s.semester = ?`, 
                [rollno, finalExamType, student.department, student.semester]
            );

            if (!rawMarks.length) {
                results.push({ rollno, status: 'No marks found' });
                continue;
            }

            const marksParsed = rawMarks.map(entry => ({
                subject: entry.subject_name,
                [examType.toUpperCase()]: entry.marks
            }));

            const sendResult = await sendMarks(student, examType, marksParsed, req.session.user.name);
            results.push({
                rollno,
                status: sendResult.success ? 'Sent' : 'Failed',
                ...(sendResult.sid && { sid: sendResult.sid }),
                ...(sendResult.error && { error: sendResult.error })
            });
        } catch (err) {
            console.error(`❌ Error sending to ${rollno}:`, err.message);
            results.push({ rollno, status: 'Failed', error: err.message });
        }
    }
    res.json({ success: true, results });
});

// *** MODIFIED DELETE ROUTE ***
// DELETE /api/advisor/delete-subjects
router.delete('/delete-subjects', isAuthenticated, async (req, res) => {
    // subjectCodes must be sent in the request body
    const { subjectCodes } = req.body;

    if (!Array.isArray(subjectCodes) || subjectCodes.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid input: Please provide subject codes to delete.' });
    }

    try {
        // Step 1: Before deleting the subjects, delete the associated marks from the student_marks table.
        await query(
            'DELETE FROM student_marks WHERE subject_code IN (?)',
            [subjectCodes]
        );

        // Step 2: Now, proceed with deleting the subjects from the subjects table.
        const result = await query(
            'DELETE FROM subjects WHERE subject_code IN (?)',
            [subjectCodes]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'No matching subjects found to delete.' });
        }

        return res.json({
            success: true,
            message: `${result.affectedRows} subject(s) and their associated marks deleted successfully.`
        });

    } catch (err) {
        console.error('Error deleting subjects and marks:', err.message);
        return res.status(500).json({ success: false, message: 'Server error while deleting subjects.' });
    }
});

// POST /api/advisor/send-attendance 
router.post('/send-attendance', isAuthenticated, async (req, res) => {
    const { students, attendanceType } = req.body;

    if (!Array.isArray(students) || students.length === 0 || !attendanceType) {
        return res.status(400).json({ success: false, message: 'Invalid input: Missing students or attendance type.' });
    }

    let attendanceValue;
    let attendanceSubjectCode;
    let attendanceMessageName; 

    // *** முக்கிய மாற்றம்: இப்போது 'ATTN-1' மற்றும் 'ATTN-2' என சரிபார்க்கிறது ***
    if (attendanceType === 'ATTN-1') {
        attendanceValue = '3';
        attendanceSubjectCode = 'ATTENDANCE_1';
        attendanceMessageName = 'Attendance 1'; // செய்தியில் முழுப்பெயரையும் பயன்படுத்தலாம்
    } else if (attendanceType === 'ATTN-2') {
        attendanceValue = '75%';
        attendanceSubjectCode = 'ATTENDANCE_2';
        attendanceMessageName = 'Attendance 2'; // செய்தியில் முழுப்பெயரையும் பயன்படுத்தலாம்
    } else {
        return res.status(400).json({ success: false, message: 'Invalid attendance type.' });
    }
    
    let storeSuccessCount = 0;
    try {
        for (const student of students) {
            if (!student.rollno) continue;
            await query(
                `INSERT INTO student_marks (student_rollno, exam_type, subject_code, marks) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE marks = ?`,
                [student.rollno, 'ATTENDANCE', attendanceSubjectCode, attendanceValue, attendanceValue]
            );
            storeSuccessCount++;
        }
    } catch (dbError) {
        console.error('Error storing attendance:', dbError.message);
        return res.status(500).json({ success: false, message: 'Failed to store attendance data in the database.' });
    }

    const phoneNumbers = students.map(s => s.whatsapp).filter(Boolean);
    if (phoneNumbers.length === 0) {
        return res.json({ success: true, message: `Attendance for ${storeSuccessCount} students stored, but no valid phone numbers found to send messages.` });
    }

    const message = `Dear Student,\nYour ${attendanceMessageName} is ${attendanceValue}.\n- ESEC`;

    try {
        const result = await sendBulkAnnouncement(phoneNumbers, message);
        if (result.success) {
            res.json({ success: true, message: `Attendance stored and announcement sent to ${phoneNumbers.length} students.` });
        } else {
            res.status(500).json({ success: false, message: `Attendance stored, but failed to send announcement.`, error: result.error });
        }
    } catch (sendError) {
        console.error('Error sending bulk announcement:', sendError.message);
        res.status(500).json({ success: false, message: 'Attendance stored, but the server encountered an error while sending the message.' });
    }
});

module.exports = router;