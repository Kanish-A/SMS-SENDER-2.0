import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// 1. உங்கள் API முகவரியை மையப்படுத்தப்பட்ட கோப்பிலிருந்து import செய்யவும்
//    இந்த கோப்பு உங்கள் src கோப்புறைக்குள் இருப்பதை உறுதிப்படுத்தவும்
import appSettings from './appsettings'; 

const Login = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 2. நேரடியாக URL-ஐ எழுதுவதற்குப் பதிலாக, appSettings-ஐப் பயன்படுத்தவும்
      const response = await axios.post(
        `${appSettings.apiUrl}/api/auth/login`, // <--- முக்கிய மாற்றம் இங்கே
        formData,
        { withCredentials: true }
      );

      console.log('Login response:', response.data);

      // வெற்றிகரமான பதிலைச் சரிபார்த்து, அடுத்த பக்கத்திற்கு அனுப்பவும்
      if (response.data.redirectUrl) {
        localStorage.setItem('userRole', response.data.userType);
        
        // onLoginSuccess என்பது App.js-ல் இருந்து அனுப்பப்பட்டால், அதை அழைக்கவும்
        if (onLoginSuccess) {
            onLoginSuccess(response.data.userType);
        }

        // replace: true என்பது பிரவுசர் history-ல் லாகின் பக்கத்தை மாற்றியமைக்கும்
        navigate(response.data.redirectUrl, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid username or password');
      console.error('Login error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-poppins">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Login</h2>
        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-600">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-600">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;