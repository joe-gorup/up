import { useState } from "react";
import type { ReactNode } from "react";
// Simple button component since ui/button doesn't exist
const Button = ({ onClick, className, disabled, children, ...props }: any) => (
  <button
    onClick={onClick}
    className={`px-6 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    disabled={disabled}
    {...props}
  >
    {children}
  </button>
);

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: { successful: Array<{ uploadURL: string }> }) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button and provides a simple file upload interface.
 * 
 * Features:
 * - Renders as a customizable button that opens a file upload interface
 * - Handles file selection and upload progress
 * - Uses direct upload via presigned URLs
 * 
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onGetUploadParameters - Function to get upload parameters (method and URL)
 * @param props.onComplete - Callback function called when upload is complete
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0]; // For now, handle single file
    
    // Validate file size
    if (file.size > maxFileSize) {
      alert(`File size must be less than ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }

    setIsUploading(true);
    
    try {
      // Get upload URL
      const { url } = await onGetUploadParameters();
      
      // Upload file
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      // Call completion handler
      onComplete?.({
        successful: [{ uploadURL: url }]
      });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      // Clear the input
      event.target.value = '';
    }
  };

  return (
    <div>
      <input
        type="file"
        id="file-upload"
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileSelect}
        disabled={isUploading}
        data-testid="input-file-upload"
      />
      <Button 
        onClick={() => document.getElementById('file-upload')?.click()} 
        className={buttonClassName}
        disabled={isUploading}
        data-testid="button-upload-image"
      >
        {isUploading ? 'Uploading...' : children}
      </Button>
    </div>
  );
}