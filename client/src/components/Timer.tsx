import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Edit2, Check, X } from 'lucide-react';

interface TimerProps {
  onTimeChange: (timeInSeconds: number, manuallyEntered: boolean) => void;
  initialTime?: number;
  isManuallyEntered?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function Timer({ 
  onTimeChange, 
  initialTime = 0, 
  isManuallyEntered = false,
  disabled = false,
  className = '' 
}: TimerProps) {
  const [timeSeconds, setTimeSeconds] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMinutes, setEditMinutes] = useState('0');
  const [editSeconds, setEditSeconds] = useState('0');
  const [manualEntry, setManualEntry] = useState(isManuallyEntered);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update timer every second when running
  useEffect(() => {
    if (isRunning && !disabled) {
      intervalRef.current = setInterval(() => {
        setTimeSeconds(prev => {
          const newTime = prev + 1;
          onTimeChange(newTime, false);
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, disabled, onTimeChange]);

  const handleStart = () => {
    if (!disabled) {
      setIsRunning(true);
      setManualEntry(false);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeSeconds(0);
    setManualEntry(false);
    onTimeChange(0, false);
  };

  const handleEditClick = () => {
    if (!disabled) {
      const minutes = Math.floor(timeSeconds / 60);
      const seconds = timeSeconds % 60;
      setEditMinutes(minutes.toString());
      setEditSeconds(seconds.toString());
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    const mins = parseInt(editMinutes) || 0;
    const secs = parseInt(editSeconds) || 0;
    const totalSeconds = (mins * 60) + secs;
    
    setTimeSeconds(totalSeconds);
    setManualEntry(true);
    setIsEditing(false);
    setIsRunning(false);
    onTimeChange(totalSeconds, true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  if (disabled) {
    return (
      <div className={`flex items-center space-x-2 p-3 bg-gray-50 rounded-lg ${className}`}>
        <div className="text-gray-500 text-sm">Timer disabled</div>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-3 p-3 bg-gray-50 rounded-lg ${className}`}>
      {/* Timer Display */}
      <div className="flex items-center space-x-2">
        {isEditing ? (
          <div className="flex items-center space-x-1">
            <input
              type="number"
              value={editMinutes}
              onChange={(e) => setEditMinutes(e.target.value)}
              className="w-12 px-1 py-1 text-center border border-gray-300 rounded text-sm"
              placeholder="MM"
              min="0"
              max="99"
              data-testid="input-edit-minutes"
            />
            <span className="text-lg font-mono">:</span>
            <input
              type="number"
              value={editSeconds}
              onChange={(e) => setEditSeconds(e.target.value)}
              className="w-12 px-1 py-1 text-center border border-gray-300 rounded text-sm"
              placeholder="SS"
              min="0"
              max="59"
              data-testid="input-edit-seconds"
            />
            <button
              onClick={handleSaveEdit}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              data-testid="button-save-edit"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              data-testid="button-cancel-edit"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <div className="text-lg font-mono font-medium" data-testid="text-timer-display">
              {formatTime(timeSeconds)}
            </div>
            <button
              onClick={handleEditClick}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
              title="Edit time manually"
              data-testid="button-edit-time"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {manualEntry && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Manual
              </span>
            )}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      {!isEditing && (
        <div className="flex items-center space-x-1">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="flex items-center justify-center p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Start timer"
              data-testid="button-start-timer"
            >
              <Play className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Stop timer"
              data-testid="button-stop-timer"
            >
              <Pause className="h-4 w-4 fill-current" />
            </button>
          )}
          
          <button
            onClick={handleReset}
            className="flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Reset timer"
            data-testid="button-reset-timer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}