import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './ui/Modal';

interface SessionWarningProps {
  show: boolean;
  timeRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
}

export default function SessionWarning({ show, timeRemaining, onExtend, onLogout }: SessionWarningProps) {
  const [countdown, setCountdown] = useState(timeRemaining);

  useEffect(() => {
    if (!show) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [show, onLogout]);

  useEffect(() => {
    setCountdown(timeRemaining);
  }, [timeRemaining]);

  if (!show) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <Modal isOpen={true} onClose={onLogout} title="Session Expiring Soon" titleIcon={<AlertTriangle className="h-6 w-6 text-yellow-500" />} size="md" showCloseButton={false}>
        <p className="text-gray-600 mb-4">
          Your session will expire in{' '}
          <span className="font-bold text-red-600">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
          {' '}due to inactivity. Would you like to extend your session?
        </p>
        
        <div className="flex space-x-3">
          <button
            onClick={onExtend}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center"
            data-testid="button-extend-session"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Extend Session
          </button>
          
          <button
            onClick={onLogout}
            className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-400 transition-colors flex items-center justify-center"
            data-testid="button-logout-session"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log Out
          </button>
        </div>
    </Modal>
  );
}