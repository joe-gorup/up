import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle, CheckCircle, Shield, Calendar, FileCheck, Eraser } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import logoImage from '@assets/1770619921782_1770620005838.png';

type OnboardingStep = 'verify-dob' | 'sign-roi' | 'complete';

export default function OnboardingVerify() {
  const { user, updateRoiStatus, logout } = useAuth();
  const [step, setStep] = useState<OnboardingStep>('verify-dob');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [consentType, setConsentType] = useState<'release_all' | 'no_release' | null>(null);
  const [noReleaseDetails, setNoReleaseDetails] = useState('');

  const [guardianName, setGuardianName] = useState('');
  const [guardianAddress, setGuardianAddress] = useState('');
  const [guardianCityStateZip, setGuardianCityStateZip] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');

  const [hasScrolledROI, setHasScrolledROI] = useState(false);
  const roiScrollRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const isGuardian = user?.role === 'Guardian';

  const getToken = () => {
    const session = localStorage.getItem('golden-scoop-session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.token;
    }
    return null;
  };

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (step === 'sign-roi') {
      setTimeout(initCanvas, 100);
    }
  }, [step, initCanvas]);

  const getPosition = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top
    };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPosition(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getSignatureData = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return null;
    return canvas.toDataURL('image/png');
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

    if (!consentType) {
      setError('Please select one of the authorization options above before signing.');
      return;
    }

    if (consentType === 'no_release') {
      setError('You have chosen not to authorize the release of records. Unfortunately, account setup cannot continue without this authorization. Please contact The Golden Scoop for help.');
      return;
    }

    if (!hasSignature) {
      setError('Please provide your signature before submitting.');
      return;
    }

    if (isGuardian && (!guardianName || !guardianRelationship)) {
      setError('Please fill in your name and relationship to the employee.');
      return;
    }

    setLoading(true);

    try {
      const token = getToken();
      const signatureData = getSignatureData();

      const body: any = {
        signature: signatureData,
        consent_type: consentType,
        date: new Date().toISOString(),
      };

      if (isGuardian) {
        body.guardian_name = guardianName;
        body.guardian_address = guardianAddress;
        body.guardian_city_state_zip = guardianCityStateZip;
        body.guardian_phone = guardianPhone;
        body.guardian_relationship = guardianRelationship;
      }

      const response = await fetch('/api/onboarding/sign-roi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        updateRoiStatus(true);
        setStep('complete');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-4 sm:p-8">
        <div className="text-center mb-4 sm:mb-6">
          <img 
            src={logoImage} 
            alt="Unique Pathway by The Golden Scoop" 
            className="mx-auto w-36 sm:w-48 h-auto mb-3 sm:mb-4"
          />
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Account Verification</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-600">
            Welcome, {user?.name}! Please complete verification to continue.
          </p>
        </div>

        <div className="flex items-center justify-center mb-6 sm:mb-8">
          <div className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full ${
            step === 'verify-dob' ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'
          }`}>
            {step === 'verify-dob' ? '1' : <CheckCircle className="h-5 w-5" />}
          </div>
          <div className={`w-12 sm:w-16 h-1 ${step !== 'verify-dob' ? 'bg-green-500' : 'bg-gray-200'}`} />
          <div className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full ${
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
              <h2 className="text-base sm:text-lg font-medium text-gray-900">Verify Date of Birth</h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
              {isGuardian 
                ? "Please enter your family member's date of birth to verify your identity."
                : "Please enter your date of birth to verify your identity."}
            </p>

            <form onSubmit={handleVerifyDOB} className="space-y-4 sm:space-y-6">
              <div>
                <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-2">
                  {isGuardian ? "Family Member's Date of Birth" : "Date of Birth"}
                </label>
                <input
                  type="date"
                  id="dob"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
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
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
              >
                {loading ? 'Verifying...' : 'Verify Date of Birth'}
              </button>
            </form>
          </div>
        )}

        {step === 'sign-roi' && (
          <div>
            <div className="flex items-center space-x-2 mb-3 sm:mb-4">
              <FileCheck className="h-5 w-5 text-blue-600" />
              <h2 className="text-base sm:text-lg font-medium text-gray-900">
                Authorization For Exchange of Information
              </h2>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm font-semibold text-gray-800">The Golden Scoop</p>
              <p className="text-xs text-gray-500">Authorization For Exchange of Information</p>
            </div>

            <div
              ref={roiScrollRef}
              onScroll={() => {
                const el = roiScrollRef.current;
                if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
                  setHasScrolledROI(true);
                }
              }}
              className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-2 max-h-52 sm:max-h-72 overflow-y-auto text-xs sm:text-sm text-gray-700 space-y-3">
              <p>
                I hereby authorize The Golden Scoop to exchange information, including health and employment information.
              </p>

              <p>
                This release covers all employment records, medical records, including diagnosis, evaluations, assessments, school records, and other information that may be relevant to the parties. This authorization is valid for information to be exchanged in any format, including but not limited to: written, audio/visual, electronic/digital, verbal.
              </p>

              <p>
                I understand the information in my health record may include information relating to sexually transmitted disease, Acquired Immunodeficiency Syndrome (AIDS), or Human Immunodeficiency Virus (HIV). It may also include information about behavioral or mental health services, and treatment for alcohol and drug abuse.
              </p>

              <p>
                I understand that this authorization may be revoked by the person named above and/or their guardian at any time except to the extent the action has already taken place. I understand that if I revoke this authorization I must do so in writing and present my written revocation to leadership or Human Resources. Unless otherwise revoked, this authorization will expire one year from date of signature.
              </p>

              <p>
                I have read the above Authorization for Release of Information / Permission to Obtain and do hereby acknowledge that I am familiar with and fully understand the terms and conditions of this release.
              </p>
            </div>

            {!hasScrolledROI && (
              <p className="text-xs text-amber-600 mb-4 sm:mb-6 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Please scroll through and read the full document above before continuing.
              </p>
            )}
            {hasScrolledROI && (
              <div className="mb-2 sm:mb-4" />
            )}

            <div className={!hasScrolledROI ? 'opacity-40 pointer-events-none select-none' : ''}>

            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Please select one:
              </label>
              <div className="space-y-3">
                <label className="flex items-start space-x-3 p-3 border rounded-xl cursor-pointer transition-colors hover:bg-blue-50"
                  style={{ borderColor: consentType === 'release_all' ? '#3b82f6' : '#e5e7eb', backgroundColor: consentType === 'release_all' ? '#eff6ff' : 'white' }}>
                  <input
                    type="radio"
                    name="consent"
                    value="release_all"
                    checked={consentType === 'release_all'}
                    onChange={() => { setConsentType('release_all'); setError(''); }}
                    className="mt-0.5 h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-800 font-medium">Release of all information</span>
                </label>

                <label className="flex items-start space-x-3 p-3 border rounded-xl cursor-pointer transition-colors hover:bg-blue-50"
                  style={{ borderColor: consentType === 'no_release' ? '#3b82f6' : '#e5e7eb', backgroundColor: consentType === 'no_release' ? '#eff6ff' : 'white' }}>
                  <input
                    type="radio"
                    name="consent"
                    value="no_release"
                    checked={consentType === 'no_release'}
                    onChange={() => { setConsentType('no_release'); setError(''); }}
                    className="mt-0.5 h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-800 font-medium">I do NOT authorize the release of these records</span>
                </label>

                {consentType === 'no_release' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-sm text-amber-800">
                      Selecting this option will prevent you from completing account setup. Authorization is required to continue.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Signature of {isGuardian ? 'Authorized Representative' : 'Employee'}
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Use your finger or stylus to sign below
              </p>
              <div className="relative border-2 border-gray-300 rounded-xl overflow-hidden bg-white" style={{ touchAction: 'none' }}>
                <canvas
                  ref={canvasRef}
                  className="w-full cursor-crosshair"
                  style={{ height: '120px', display: 'block' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasSignature && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-gray-300 text-sm italic">Sign here</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={clearSignature}
                className="mt-2 flex items-center space-x-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
              >
                <Eraser className="h-3 w-3" />
                <span>Clear signature</span>
              </button>
            </div>

            {isGuardian && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="text-sm font-semibold text-blue-800 mb-3">
                  Authorized Representative Information
                </h3>
                <p className="text-xs text-blue-600 mb-4">
                  Please complete this section as a Parent, Guardian, or Authorized Representative.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Printed Name *</label>
                    <input
                      type="text"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={guardianAddress}
                      onChange={(e) => setGuardianAddress(e.target.value)}
                      placeholder="Street address"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">City / State / Zip</label>
                    <input
                      type="text"
                      value={guardianCityStateZip}
                      onChange={(e) => setGuardianCityStateZip(e.target.value)}
                      placeholder="City, State, Zip"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Relationship to Employee *</label>
                    <input
                      type="text"
                      value={guardianRelationship}
                      onChange={(e) => setGuardianRelationship(e.target.value)}
                      placeholder="e.g., Parent, Guardian, Legal Representative"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl mb-4">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSignROI}
              disabled={loading || !hasSignature}
              className="w-full bg-green-600 text-white py-4 px-4 rounded-xl font-medium hover:bg-green-700 focus:ring-4 focus:ring-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {loading ? 'Submitting...' : 'I Agree & Sign'}
            </button>

            <p className="text-xs text-gray-400 text-center mt-3">
              Date: {new Date().toLocaleDateString()}
            </p>

            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-6 sm:py-8">
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 text-green-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Verification Complete!</h2>
            <p className="text-sm text-gray-600 mb-4">
              Thank you for completing the verification process. You will be redirected shortly...
            </p>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        )}

        {step !== 'complete' && (
          <div className="mt-4 sm:mt-6 text-center">
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
