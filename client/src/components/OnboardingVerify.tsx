import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Shield, Calendar, FileCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import logoImage from '@assets/1770619921782_1770620005838.png';

type OnboardingStep = 'verify-dob' | 'sign-roi' | 'complete';

export default function OnboardingVerify() {
  const { user, updateRoiStatus, logout } = useAuth();
  const [step, setStep] = useState<OnboardingStep>('verify-dob');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getToken = () => {
    const session = localStorage.getItem('golden-scoop-session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.token;
    }
    return null;
  };

  const handleVerifyDOB = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = getToken();
      const response = await fetch('/api/onboarding/verify-dob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ date_of_birth: dateOfBirth })
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        setStep('sign-roi');
      } else {
        setError(data.error || 'Date of birth verification failed. Please try again.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignROI = async () => {
    setError('');
    setLoading(true);

    try {
      const token = getToken();
      const response = await fetch('/api/onboarding/sign-roi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        updateRoiStatus(true);
        setStep('complete');
        // Redirect to main app after a brief delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(data.error || 'Failed to sign ROI. Please try again.');
      }
    } catch (err) {
      setError('Failed to sign ROI. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isGuardian = user?.role === 'Guardian';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <img 
            src={logoImage} 
            alt="Unique Pathway by The Golden Scoop" 
            className="mx-auto w-48 h-auto mb-4"
          />
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Account Verification</h1>
          </div>
          <p className="text-sm text-gray-600">
            Welcome, {user?.name}! Please complete verification to continue.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
            step === 'verify-dob' ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'
          }`}>
            {step === 'verify-dob' ? '1' : <CheckCircle className="h-5 w-5" />}
          </div>
          <div className={`w-16 h-1 ${step !== 'verify-dob' ? 'bg-green-500' : 'bg-gray-200'}`} />
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
            step === 'sign-roi' ? 'bg-blue-600 text-white' : 
            step === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {step === 'complete' ? <CheckCircle className="h-5 w-5" /> : '2'}
          </div>
        </div>

        {step === 'verify-dob' && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-medium text-gray-900">Verify Date of Birth</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {isGuardian 
                ? "Please enter your family member's date of birth to verify your identity."
                : "Please enter your date of birth to verify your identity."}
            </p>

            <form onSubmit={handleVerifyDOB} className="space-y-6">
              <div>
                <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-2">
                  {isGuardian ? "Family Member's Date of Birth" : "Date of Birth"}
                </label>
                <input
                  type="date"
                  id="dob"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !dateOfBirth}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify Date of Birth'}
              </button>
            </form>
          </div>
        )}

        {step === 'sign-roi' && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <FileCheck className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-medium text-gray-900">Release of Information</h2>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 max-h-64 overflow-y-auto text-sm text-gray-700">
              <h3 className="font-semibold mb-2">Release of Information Agreement</h3>
              <p className="mb-3">
                By signing below, I authorize The Golden Scoop and its affiliated programs to:
              </p>
              <ul className="list-disc pl-5 space-y-2 mb-3">
                <li>Collect and maintain records related to my development goals and progress</li>
                <li>Share relevant information with authorized staff members for the purpose of providing support and services</li>
                <li>Use anonymized data for program improvement and reporting purposes</li>
                <li>Store assessment records and documentation securely</li>
              </ul>
              <p className="mb-3">
                I understand that:
              </p>
              <ul className="list-disc pl-5 space-y-2 mb-3">
                <li>My information will be kept confidential and only shared with authorized personnel</li>
                <li>I have the right to request access to my records</li>
                <li>I may revoke this authorization at any time by contacting the program administrator</li>
                <li>This authorization remains in effect for the duration of my participation in the program</li>
              </ul>
              <p className="text-xs text-gray-500 mt-4">
                Last updated: February 2026
              </p>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl mb-4">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSignROI}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 focus:ring-4 focus:ring-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing...' : 'I Agree & Sign'}
            </button>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Complete!</h2>
            <p className="text-gray-600 mb-4">
              Thank you for completing the verification process. You will be redirected shortly...
            </p>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        )}

        {step !== 'complete' && (
          <div className="mt-6 text-center">
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Sign out and use a different account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
