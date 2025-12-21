import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ClipLoader from "react-spinners/ClipLoader";
import appSettings from '../appsettings';
axios.defaults.withCredentials = true;
const API_URL = `${appSettings.apiUrl}/api/advisor`;

const AdvisorPage = () => {
  const navigate = useNavigate();

  // State
  const [activeMenu, setActiveMenu] = useState('home');
  const [advisorDetails, setAdvisorDetails] = useState({
    name: '',
    department: '',
    semester: '',
    year: '',
    mobile: ''
  });
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Bulk Send Marks States
  const [selectedStudentsForMarks, setSelectedStudentsForMarks] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
//Subject
  const [showDeleteCheckboxes, setShowDeleteCheckboxes] = useState(false);
const [selectedSubjectsForDeletion, setSelectedSubjectsForDeletion] = useState([]);

  // Subject & Marks States
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [numSubjects, setNumSubjects] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [configuredSubjects, setConfiguredSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Upload Modal States
  const [showModal, setShowModal] = useState(false);
  const [uploadExamType, setUploadExamType] = useState('');
  const [file, setFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('');

  // Exam Type Modal
  const [showExamModal, setShowExamModal] = useState(false);
  const [selectedExamType, setSelectedExamType] = useState('');
  
  // Bulk send loading & results panel
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState([]);

  const examTypes = ['CAT1', 'CAT2', 'SEMESTER'];
  const bulkSendTypes = [...examTypes, 'ATTN-1', 'ATTN-2'];

  // Fetch advisor details
  useEffect(() => {
    const fetchAdvisorDetails = async () => {
      try {
        const response = await axios.get(`${API_URL}/get-advisor-details`, { withCredentials: true });
        if (response.status === 200) {
          setAdvisorDetails({
            name: response.data.name || 'Advisor',
            department: response.data.department || 'Department',
            semester: response.data.semester || 'Semester',
            year: response.data.year || 'Year',
            mobile: response.data.mobile || 'Not Available'
          });
        }
      } catch (err) {
        console.error('Error fetching advisor info:', err.message);
        navigate('/login');
      }
    };
    fetchAdvisorDetails();
  }, [navigate]);

  // Fetch students when needed
  useEffect(() => {
    if ((activeMenu === 'students' || activeMenu === 'send') && advisorDetails.department) {
      const fetchStudents = async () => {
        try {
          const res = await axios.get(`${API_URL}/get-students`, {
            params: {
              department: advisorDetails.department,
              year: advisorDetails.year,
              semester: advisorDetails.semester,
            },
            withCredentials: true,
          });
          if (res.status === 200) {
            setStudents(res.data);
            setSelectedStudentsForMarks([]);
            setSelectAll(false);
          }
        } catch (err) {
          console.error('Failed to fetch students:', err.message);
          setStudents([]);
        }
      };
      fetchStudents();
    }
  }, [activeMenu, advisorDetails.department, advisorDetails.year, advisorDetails.semester]);

  // Fetch subjects
  useEffect(() => {
    if (activeMenu === 'subjectMarks' && advisorDetails.department) {
      const fetchConfiguredSubjects = async () => {
        setSubjectsLoading(true);
        try {
          const res = await axios.get(`${API_URL}/get-subjects`, {
            params: {
              department: advisorDetails.department,
              year: advisorDetails.year,
              semester: advisorDetails.semester,
            },
            withCredentials: true,
          });
          setConfiguredSubjects(res.data.success ? res.data.subjects || [] : []);
        } catch (err) {
          console.error('Error fetching subjects:', err.message);
          setConfiguredSubjects([]);
        } finally {
          setSubjectsLoading(false);
        }
      };
      fetchConfiguredSubjects();
    }
  }, [activeMenu, advisorDetails.department, advisorDetails.year, advisorDetails.semester]);

  const handleStudentClick = async (student) => {
    setSelectedStudent(student);
    try {
      const res = await axios.get(`${API_URL}/get-marks`, {
        params: {
          rollno: student.rollno,
          semester: advisorDetails.semester,
          department: advisorDetails.department
        },
        withCredentials: true
      });
      if (res.status === 200) {
        const data = res.data;
        const subjectMap = {};
        data.subjects?.forEach(subj => {
          subjectMap[subj.subject_code] = subj.subject_name;
        });
        const marksTable = Object.keys(subjectMap).map(code => ({
          subjectCode: code,
          subjectName: subjectMap[code],
          cat1: data.CAT1?.[code] || '-',
          cat2: data.CAT2?.[code] || '-',
          semester: data.SEMESTER?.[code] || '-'
        }));
        setSelectedStudent(prev => ({
          ...prev,
          marksTable,
          attendance1: data.attendance1,
          attendance2: data.attendance2,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch marks:', err.message);
      setSelectedStudent((prev) => ({
        ...prev,
        marksTable: [],
        attendance1: null,
        attendance2: null,
      }));
    }
  };
// *** NEW: Function to toggle bulk delete mode ***
const toggleBulkDelete = () => {
    setShowDeleteCheckboxes(prev => !prev);
    setSelectedSubjectsForDeletion([]); // Reset selection when toggling
};

// *** NEW: Function to handle individual checkbox changes ***
const handleSubjectCheckboxChange = (subjectCode) => {
    setSelectedSubjectsForDeletion(prev => 
        prev.includes(subjectCode)
            ? prev.filter(code => code !== subjectCode)
            : [...prev, subjectCode]
    );
};

// *** NEW: Function to handle the "Select All" checkbox ***
const handleSelectAllSubjects = (e) => {
    if (e.target.checked) {
        const allSubjectCodes = configuredSubjects.map(s => s.subject_code);
        setSelectedSubjectsForDeletion(allSubjectCodes);
    } else {
        setSelectedSubjectsForDeletion([]);
    }
};

// *** NEW: Main function to perform the delete operation ***
const performSubjectDelete = async (subjectCodesToDelete) => {
    // Confirmation dialog (உறுதிப்படுத்தல் உரையாடல்)
    const isConfirmed = window.confirm(`Are you sure you want to delete ${subjectCodesToDelete.length} subject(s)? This action cannot be undone.`);
    
    if (!isConfirmed) {
        return;
    }

    try {
        const res = await axios.delete(`${API_URL}/delete-subjects`, {
            data: { subjectCodes: subjectCodesToDelete }, // Pass codes in the request body
            withCredentials: true,
        });

        if (res.data.success) {
            alert(res.data.message);
            // Update the UI by removing the deleted subjects from state
            setConfiguredSubjects(prev =>
                prev.filter(subject => !subjectCodesToDelete.includes(subject.subject_code))
            );
            // Reset the delete UI
            setShowDeleteCheckboxes(false);
            setSelectedSubjectsForDeletion([]);
        } else {
            alert(`❌ Error: ${res.data.message}`);
        }
    } catch (err) {
        console.error('Error deleting subjects:', err);
        alert(`❌ Deletion failed: ${err.response?.data?.message || 'A server error occurred.'}`);
    }
};
  const handleBulkSendMarksWithType = async (examType) => {
    if (!selectedStudentsForMarks.length) {
      alert('Please select at least one student.');
      return;
    }

    const finalExamType = examType === 'SEMESTER' ? 'MODEL' : examType;
    setIsSending(true);
    setSendResults(selectedStudentsForMarks.map(s => ({
      rollno: s.rollno,
      status: 'pending',
      message: 'Sending...'
    })));

    try {
      const payload = {
        marksData: selectedStudentsForMarks.map((s) => ({
          rollno: s.rollno,
          examType: finalExamType,
        })),
      };

      const res = await axios.post(`${API_URL}/send-marks`, payload, { withCredentials: true });

      if (res.data.success) {
        const updatedResults = selectedStudentsForMarks.map(s => ({
          rollno: s.rollno,
          status: 'success',
          message: '✅ Sent'
        }));
        setSendResults(updatedResults);

        setTimeout(() => {
          setIsSending(false);
          alert('✅ All messages sent successfully!');
        }, 3000);
      } else {
        const updatedResults = selectedStudentsForMarks.map(s => ({
          rollno: s.rollno,
          status: 'failed',
          message: '❌ Failed'
        }));
        setSendResults(updatedResults);
        setTimeout(() => setIsSending(false), 3000);
      }
    } catch (err) {
      console.error('🚨 Error sending marks:', err.message);
      const errorResults = selectedStudentsForMarks.map(s => ({
        rollno: s.rollno,
        status: 'failed',
        message: '❌ Error'
      }));
      setSendResults(errorResults);
      setTimeout(() => setIsSending(false), 3000);
      alert('❌ Failed to send messages. Please try again.');
    }
  };

  const renderSubjectsList = () => {
    if (subjectsLoading) return <p className="text-gray-500 italic">Loading subjects...</p>;
    if (!configuredSubjects.length) return <p className="text-gray-500 italic">No subjects configured for this semester.</p>;

    const allSelected = configuredSubjects.length > 0 && selectedSubjectsForDeletion.length === configuredSubjects.length;

    return (
        <div className="mt-4 overflow-x-auto">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold">Subjects</h3>
                {/* Show a "Delete Selected" button only in checkbox mode */}
                {showDeleteCheckboxes && (
                    <button 
                        onClick={() => performSubjectDelete(selectedSubjectsForDeletion)}
                        disabled={selectedSubjectsForDeletion.length === 0}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Delete Selected ({selectedSubjectsForDeletion.length})
                    </button>
                )}
            </div>
            <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2">Subject Code</th>
                        <th className="border border-gray-300 px-4 py-2">Subject Name</th>
                        <th className="border border-gray-300 px-2 py-2 text-center w-24">
                            {/* Action Header: Shows checkbox or bulk delete icon */}
                            {showDeleteCheckboxes ? (
                                <input
                                    type="checkbox"
                                    className="form-checkbox h-5 w-5"
                                    checked={allSelected}
                                    onChange={handleSelectAllSubjects}
                                    title="Select All"
                                />
                            ) : (
                                <button onClick={toggleBulkDelete} title="Delete Multiple Subjects" className="text-gray-600 hover:text-red-500">
                                    {/* Trash icon for bulk delete */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            )}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {configuredSubjects.map((subject, idx) => (
                        <tr key={subject.subject_code} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="border border-gray-300 px-4 py-2">{subject.subject_code}</td>
                            <td className="border border-gray-300 px-4 py-2">{subject.subject_name}</td>
                            <td className="border border-gray-300 px-2 py-2 text-center">
                                {/* Action Cell: Shows checkbox or single delete icon */}
                                {showDeleteCheckboxes ? (
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-5 w-5"
                                        checked={selectedSubjectsForDeletion.includes(subject.subject_code)}
                                        onChange={() => handleSubjectCheckboxChange(subject.subject_code)}
                                    />
                                ) : (
                                    <button onClick={() => performSubjectDelete([subject.subject_code])} title="Delete this subject" className="text-gray-500 hover:text-red-500">
                                        {/* Trash icon for single delete */}
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {/* Button to cancel bulk delete mode */}
            {showDeleteCheckboxes && (
                <button onClick={toggleBulkDelete} className="mt-2 text-sm text-blue-600 hover:underline">
                    Cancel
                </button>
            )}
        </div>
    );
};
  
  const renderMarksTable = () => {
    if (!selectedStudent?.marksTable?.length) {
      return <p className="text-gray-500 italic mt-4">No marks data found for this student yet.</p>;
    }
    return (
      <div className="mt-4 overflow-x-auto">
        <h3 className="text-lg font-bold mb-2">Marks & Attendance</h3>
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2">Subject Code</th>
              <th className="border border-gray-300 px-4 py-2">Subject Name</th>
              <th className="border border-gray-300 px-4 py-2">CAT1</th>
              <th className="border border-gray-300 px-4 py-2">CAT2</th>
              <th className="border border-gray-300 px-4 py-2">SEMESTER</th>
              <th className="border border-gray-300 px-4 py-2">ATTN-1</th>
              <th className="border border-gray-300 px-4 py-2">ATTN-2</th>
            </tr>
          </thead>
          <tbody>
            {selectedStudent.marksTable.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="border border-gray-300 px-4 py-2">{row.subjectCode}</td>
                <td className="border border-gray-300 px-4 py-2">{row.subjectName}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{row.cat1}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{row.cat2}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{row.semester}</td>
                {idx === 0 && (
                  <>
                    <td 
                      className="border border-gray-300 px-4 py-2 text-center align-middle" 
                      rowSpan={selectedStudent.marksTable.length}
                    >
                      {selectedStudent.attendance1 || '-'}
                    </td>
                    <td 
                      className="border border-gray-300 px-4 py-2 text-center align-middle" 
                      rowSpan={selectedStudent.marksTable.length}
                    >
                      {selectedStudent.attendance2 || '-'}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const handleCheckboxChange = (student) => {
    const isSelected = selectedStudentsForMarks.some((s) => s.rollno === student.rollno);
    if (isSelected) {
      setSelectedStudentsForMarks((prev) =>
        prev.filter((s) => s.rollno !== student.rollno)
      );
    } else {
      setSelectedStudentsForMarks((prev) => [...prev, student]);
    }
  };

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    if (!selectAll) {
      setSelectedStudentsForMarks(students);
    } else {
      setSelectedStudentsForMarks([]);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.get(`${appSettings.apiUrl}/api/auth/logout`, { withCredentials: true });
    } finally {
      navigate('/login');
    }
  };

  const openSubjectModal = () => {
    setNumSubjects('');
    setSubjects([]);
    setShowSubjectModal(true);
  };

  const handleNumSubjectsChange = (e) => {
    setNumSubjects(e.target.value);
  };

  const generateSubjectInputs = () => {
    const count = parseInt(numSubjects);
    if (isNaN(count) || count <= 0) {
      alert('Please enter a valid number of subjects.');
      return;
    }
    const newSubjects = Array.from({ length: count }, () => ({
      code: '',
      name: '',
    }));
    setSubjects(newSubjects);
  };

  const handleSubjectChange = (index, field, value) => {
    const updatedSubjects = [...subjects];
    updatedSubjects[index][field] = value;
    setSubjects(updatedSubjects);
  };

  const handleUpdateSubjects = () => {
    if (!subjects.some((subj) => subj.code && subj.name)) {
      alert('Please fill in all subject codes and names.');
      return;
    }
    const payload = {
      subjects,
      department: advisorDetails.department,
      year: advisorDetails.year,
      semester: advisorDetails.semester
    };
    axios
      .post(`${API_URL}/add-subjects`, payload, { withCredentials: true })
      .then((res) => {
        if (res.data.success) {
          alert(res.data.message);
          setShowSubjectModal(false);
        } else {
          alert('❌ Failed to save subjects.');
        }
      })
      .catch((err) => {
        console.error('Error saving subjects:', err.message);
        alert('❌ Error saving subjects. Check console for details.');
      });
  };

  const handleUploadClick = (examType) => {
    setUploadExamType(examType);
    setShowModal(true);
    setUploadSuccess(false);
    setUploadSuccessMessage('');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile) {
      setUploadSuccess(false);
      setUploadSuccessMessage('');
    }
  };

  const handleUploadSubmit = async () => {
    if (!file) {
      alert('Please select a file to upload.');
      return;
    }

    setUploadSuccess(false);
    setUploadSuccessMessage('');
    setUploadLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    const finalExamType = uploadExamType === 'SEMESTER' ? 'MODEL' : uploadExamType;
    formData.append('examType', finalExamType);

    try {
      const res = await axios.post(`${API_URL}/upload-marks`, formData, { withCredentials: true });
      setUploadLoading(false);

      if (res.data.success) {
        setUploadSuccess(true);
        setUploadSuccessMessage(res.data.message);
      } else {
        alert(`Error: ${res.data.message}`);
        setUploadLoading(false);
      }
    } catch (err) {
      setUploadLoading(false);
      console.error('Upload error:', err.message);
      if (err.response) {
        alert(`Upload failed: ${err.response.data.message || err.message}`);
      } else if (err.request) {
        alert(`Upload failed: No response from server.`);
      } else {
        alert(`Upload failed: ${err.message}`);
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setUploadLoading(false);
    setUploadSuccess(false);
    setUploadSuccessMessage('');
    setFile(null);
  };
  
  const handleSendAndStoreAttendance = async (attendanceType) => {
    setShowExamModal(false);
    if (!selectedStudentsForMarks.length) {
        alert('Please select at least one student.');
        return;
    }
    
    setIsSending(true);
    setSendResults(selectedStudentsForMarks.map(s => ({
      rollno: s.rollno,
      status: 'pending',
      message: 'Sending...'
    })));

    try {
        const payload = {
            students: selectedStudentsForMarks.map(s => ({
                rollno: s.rollno,
                whatsapp: s.whatsapp,
            })),
            attendanceType: attendanceType,
        };

        const res = await axios.post(`${API_URL}/send-attendance`, payload, { withCredentials: true });
        if (res.data.success) {
            const updatedResults = selectedStudentsForMarks.map(s => ({
                rollno: s.rollno,
                status: 'success',
                message: '✅ Sent'
            }));
            setSendResults(updatedResults);

            setTimeout(() => {
                setIsSending(false);
                alert('✅ Attendance messages sent successfully!');
            }, 3000);
        } else {
            const updatedResults = selectedStudentsForMarks.map(s => ({
                rollno: s.rollno,
                status: 'failed',
                message: '❌ Failed'
            }));
            setSendResults(updatedResults);
            setTimeout(() => setIsSending(false), 3000);
        }
    } catch (err) {
        console.error('Error sending attendance:', err.message);
        const errorResults = selectedStudentsForMarks.map(s => ({
            rollno: s.rollno,
            status: 'failed',
            message: '❌ Error'
        }));
        setSendResults(errorResults);
        setTimeout(() => setIsSending(false), 3000);
        alert(`❌ Failed to send attendance. ${err.response?.data?.message || 'Please try again.'}`);
    }
  };

  return (
    <>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=Roboto:wght@400;700&display=swap');`}
      </style>
      <div className="flex flex-col min-h-screen bg-gray-100 font-roboto">
        <header className="bg-[#292969] text-white p-4 shadow-md sticky top-0 z-50">
          <div className="container mx-auto flex flex-wrap justify-between items-center">
            <div className="flex items-center space-x-2 mb-2 md:mb-0">
              <img src={require('../assets/eseclogo.jpg')} alt="ESEC Logo" className="w-8 h-8 rounded-full" />
              <div>
                <h1 className="text-xl font-bold">ERODE</h1>
                <p className="text-sm font-bold">SENGUNTHAR ENGINEERING COLLEGE</p>
              </div>
            </div>
            <ul className="flex flex-wrap gap-4 text-white font-medium">
              <li><button onClick={() => setActiveMenu('home')} className={activeMenu === 'home' ? 'underline' : ''}>Home</button></li>
              <li><button onClick={() => setActiveMenu('students')} className={activeMenu === 'students' ? 'underline' : ''}>Students</button></li>
              <li><button onClick={() => setActiveMenu('send')} className={activeMenu === 'send' ? 'underline' : ''}>Send</button></li>
              <li><button onClick={() => setActiveMenu('subjectMarks')} className={activeMenu === 'subjectMarks' ? 'underline' : ''}>Subject & Marks</button></li>
              <li><button onClick={handleLogout} className="hover:text-yellow-200 transition-colors">Logout</button></li>
            </ul>
          </div>
        </header>

        <main className="flex-grow container mx-auto p-4 md:p-6">
          {activeMenu === 'home' && (
            <div className="flex flex-col md:flex-row items-center justify-between p-4 md:p-6 bg-blue-100 rounded-lg shadow-lg space-y-6 md:space-y-0 md:space-x-6">
              <div className="w-full md:w-1/2 flex justify-center">
                <img src={require('../assets/man1.png')} alt="Admin Dashboard" className="w-full max-w-xs md:max-w-sm h-auto rounded-lg shadow-md object-cover" />
              </div>
              <div className="w-full md:w-1/2 text-center md:text-left">
                <h2 className="text-2xl md:text-4xl font-bold text-gray-800 font-caprasimo">Welcome, {advisorDetails.name}!</h2>
                <p className="mt-2 text-base md:text-lg text-gray-700">Department - {advisorDetails.department}</p>
                <p className="mt-1 text-base md:text-lg text-gray-700">Year - {advisorDetails.year}, Semester - {advisorDetails.semester}</p>
                <p className="mt-4 italic text-base md:text-lg text-gray-700 font-caprasimo">"Education is the most powerful weapon which you can use to change the world."<br /><span className="font-semibold">– Nelson Mandela</span></p>
              </div>
            </div>
          )}
          {activeMenu === 'students' && (
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold mb-4">Students</h2>
              {selectedStudent ? (
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-1/4 md:h-[80vh] md:overflow-y-auto bg-white rounded-lg shadow-lg p-4 md:p-6">
                    <h2 className="text-xl font-bold mb-4">Students</h2>
                    <div className="grid grid-cols-1 gap-4">
                      {students.length > 0 ? (
                        students.map((student) => (
                          <div key={student.rollno} className="border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-blue-50 transition-shadow" onClick={() => handleStudentClick(student)}>
                            <h3 className="text-lg font-semibold">{student.name}</h3>
                            <p className="text-sm text-gray-600">Roll No: {student.rollno}</p>
                          </div>
                        ))
                      ) : ( <p>No students found.</p> )}
                    </div>
                  </div>
                  <div className="w-full md:w-3/4 bg-white rounded-lg shadow-lg p-4 md:p-6">
                    <button onClick={() => setSelectedStudent(null)} className='mb-4 bg-gray-200 px-3 py-1 rounded'>&larr; Back</button>
                    <h3 className="text-xl font-bold">{selectedStudent.name}</h3>
                    <table className="min-w-full mt-2 border-collapse border border-gray-300">
                      <tbody>
                        <tr className="bg-gray-100"><td className="border border-gray-300 px-3 py-2 font-semibold">Roll No</td><td className="border border-gray-300 px-3 py-2">{selectedStudent.rollno}</td></tr>
                        <tr className="bg-gray-100"><td className="border border-gray-300 px-3 py-2 font-semibold">Department</td><td className="border border-gray-300 px-3 py-2">{selectedStudent.department}</td></tr>
                        <tr className="bg-gray-100"><td className="border border-gray-300 px-3 py-2 font-semibold">Year</td><td className="border border-gray-300 px-3 py-2">{selectedStudent.year}</td></tr>
                        <tr className="bg-gray-100"><td className="border border-gray-300 px-3 py-2 font-semibold">Class</td><td className="border border-gray-300 px-3 py-2">{selectedStudent.class}</td></tr>
                        <tr className="bg-gray-100"><td className="border border-gray-300 px-3 py-2 font-semibold">Email</td><td className="border border-gray-300 px-3 py-2">{selectedStudent.email}</td></tr>
                        <tr className="bg-gray-100"><td className="border border-gray-300 px-3 py-2 font-semibold">WhatsApp</td><td className="border border-gray-300 px-3 py-2">{selectedStudent.whatsapp}</td></tr>
                        <tr className="bg-gray-100"><td className="border border-gray-300 px-3 py-2 font-semibold">Language</td><td className="border border-gray-300 px-3 py-2">{selectedStudent.language}</td></tr>
                        <tr className="bg-gray-100"><td className="border border-gray-300 px-3 py-2 font-semibold">Semester</td><td className="border border-gray-300 px-3 py-2">{selectedStudent.semester}</td></tr>
                      </tbody>
                    </table>
                    {renderSubjectsList()}
                    {renderMarksTable()}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {students.length > 0 ? (
                    students.map((student) => (
                      <div key={student.rollno} className="border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-blue-50 transition-shadow" onClick={() => handleStudentClick(student)}>
                        <h3 className="text-lg font-semibold">{student.name}</h3>
                        <p className="text-sm text-gray-600">Roll No: {student.rollno}</p>
                      </div>
                    ))
                  ) : ( <p>No students found.</p> )}
                </div>
              )}
            </div>
          )}
          {activeMenu === 'send' && (
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 relative">
              <h2 className="text-xl md:text-2xl font-bold mb-4">Send Marks / Attendance</h2>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <button 
                  onClick={handleSelectAll} 
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  disabled={students.length === 0}
                >
                  {selectAll ? 'Deselect All' : 'Select All'}
                </button>
                <button 
                  onClick={() => { 
                    if (selectedStudentsForMarks.length === 0) { 
                      alert('Please select at least one student.'); 
                      return; 
                    } 
                    setShowExamModal(true); 
                  }} 
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                  disabled={students.length === 0}
                >
                  Send Selected
                </button>
              </div>
              {students.length === 0 ? (
                <p className="text-gray-500 italic">No students found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {students.map((student) => (
                    <div key={student.rollno} className="border border-gray-300 rounded-lg p-4 hover:bg-blue-50 flex justify-between items-center">
                      <div><h3 className="text-lg font-semibold">{student.name}</h3><p className="text-sm text-gray-600">Roll No: {student.rollno}</p></div>
                      <label className="inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedStudentsForMarks.some((s) => s.rollno === student.rollno)} 
                          onChange={() => handleCheckboxChange(student)} 
                          className="form-checkbox h-5 w-5 text-blue-600" 
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {isSending && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-2xl flex flex-col items-center">
                    <ClipLoader color="#292969" size={50} />
                    <p className="mt-4 text-lg font-medium">Sending messages...</p>
                    <div className="mt-6 w-full max-h-60 overflow-y-auto">
                      <h3 className="font-bold mb-2">Send Status:</h3>
                      <div className="space-y-1">
                        {sendResults.map((result, idx) => (
                          <div key={idx} className="flex justify-between py-1 border-b">
                            <span>Roll No: {result.rollno}</span>
                            <span className={result.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                              {result.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeMenu === 'subjectMarks' && (
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl md:text-2xl font-bold">Subject & Marks</h2>
                <button onClick={openSubjectModal} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Add Subjects</button>
              </div>
              {renderSubjectsList()}
              <table className="min-w-full border-collapse border border-gray-300 mt-6">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2">Exams</th>
                    <th className="border border-gray-300 px-4 py-2">Upload Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {examTypes.map((exam, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-4 py-2">{exam}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        <button 
                          onClick={() => handleUploadClick(exam)} 
                          className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                        >
                          Upload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>

        {/* Modals */}
        {showSubjectModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-11/12 md:w-2/3 lg:w-1/2 max-w-3xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Add Subjects</h3>
                <button 
                  onClick={() => setShowSubjectModal(false)} 
                  className="text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <label className="block mb-2">Enter Number of Subjects:</label>
              <input 
                type="number" 
                min="1" 
                value={numSubjects} 
                onChange={handleNumSubjectsChange} 
                className="w-full p-2 border border-gray-300 rounded mb-4" 
                placeholder="e.g., 2" 
              />
              <button 
                onClick={generateSubjectInputs} 
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
              >
                Generate Inputs
              </button>
              {subjects.length > 0 && (
                <div className="mt-4 space-y-3">
                  {subjects.map((_, index) => (
                    <div key={index} className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Subject Code" 
                        value={subjects[index].code} 
                        onChange={(e) => handleSubjectChange(index, 'code', e.target.value)} 
                        className="flex-1 p-2 border border-gray-300 rounded" 
                      />
                      <input 
                        type="text" 
                        placeholder="Subject Name" 
                        value={subjects[index].name} 
                        onChange={(e) => handleSubjectChange(index, 'name', e.target.value)} 
                        className="flex-1 p-2 border border-gray-300 rounded" 
                      />
                    </div>
                  ))}
                  <button 
                    onClick={handleUpdateSubjects} 
                    className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 w-full"
                  >
                    Update
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {showExamModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-80">
              <h3 className="text-lg font-bold mb-4">Select Type</h3>
              {bulkSendTypes.map((type) => (
                <label key={type} className="flex items-center mb-2">
                  <input 
                    type="radio" 
                    name="examType" 
                    value={type} 
                    checked={selectedExamType === type} 
                    onChange={(e) => setSelectedExamType(e.target.value)} 
                    className="mr-2" 
                  />
                  {type}
                </label>
              ))}
              <div className="flex justify-end mt-4 gap-2">
                <button 
                  onClick={() => setShowExamModal(false)} 
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (!selectedExamType) {
                      alert('Please select an exam type.');
                      return;
                    }
                    setShowExamModal(false);
                    if (selectedExamType.includes('ATTN')) {
                      handleSendAndStoreAttendance(selectedExamType);
                    } else {
                      handleBulkSendMarksWithType(selectedExamType);
                    }
                  }} 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-h-[80vh] overflow-auto relative">
              {uploadLoading && (
                <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center rounded-lg z-10">
                  <ClipLoader color={"#292969"} loading={uploadLoading} size={50} />
                  <p className="mt-2 text-gray-700 font-medium">Uploading...</p>
                </div>
              )}
              {uploadSuccess && (
                <div className="absolute inset-0 bg-white bg-opacity-95 flex flex-col items-center justify-center rounded-lg z-10 p-4">
                  <div className="text-green-500 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 text-center mb-4">{uploadSuccessMessage}</p>
                  <button 
                    onClick={closeModal} 
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Close
                  </button>
                </div>
              )}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Upload {uploadExamType} Marks</h3>
                <button 
                  onClick={closeModal} 
                  disabled={uploadLoading || uploadSuccess} 
                  className={`text-gray-500 hover:text-gray-700 focus:outline-none ${(uploadLoading || uploadSuccess) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleUploadSubmit(); }}>
                <label className="block mb-2">Select File:</label>
                <input 
                  type="file" 
                  accept=".csv,.xls,.xlsx" 
                  onChange={handleFileChange} 
                  disabled={uploadLoading || uploadSuccess} 
                  className={`w-full p-2 border border-gray-300 rounded mb-4 ${(uploadLoading || uploadSuccess) ? 'opacity-70 cursor-not-allowed' : ''}`} 
                />
                <button 
                  type="submit" 
                  disabled={uploadLoading || uploadSuccess || !file} 
                  className={`w-full px-4 py-2 rounded flex items-center justify-center ${(uploadLoading || uploadSuccess || !file) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white`}
                >
                  {uploadLoading ? (
                    <>
                      <ClipLoader color={"#ffffff"} loading={uploadLoading} size={20} />
                      <span className="ml-2">Uploading...</span>
                    </>
                  ) : (
                    'Upload'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
        {activeMenu !== 'home' && (
          <footer className="bg-[#292969] text-white py-4 text-center mt-auto">
            <p className="text-sm">© Copyright Reserved to Erode Sengunthar Engineering College</p>
            <p className="text-xs mt-1">Developed By Ajay M - B.Tech</p>
          </footer>
        )}
      </div>
    </>
  );
};

export default AdvisorPage;