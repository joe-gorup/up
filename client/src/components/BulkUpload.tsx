import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download, Target } from 'lucide-react';
import { apiRequest } from '../lib/auth';
import Tabs from './ui/Tabs';

interface UploadResult {
  success: boolean;
  message: string;
  details?: {
    totalRows: number;
    successCount: number;
    errorCount: number;
    errors?: string[];
  };
}

export default function BulkUpload() {
  const [activeTab, setActiveTab] = useState<'assessments' | 'mastered' | 'goal-templates'>('assessments');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setResult(null);
      parseCSVPreview(selectedFile);
    } else {
      alert('Please select a CSV file');
    }
  };

  const parseCSVPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
      const headers = lines[0].split(',').map(h => h.trim());
      
      const preview = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, i) => {
          row[header] = values[i] || '';
        });
        return row;
      });
      
      setPreviewData(preview);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();

      let endpoint: string;
      if (activeTab === 'assessments') {
        formData.append('file', file);
        endpoint = '/api/bulk-upload/assessments';
      } else if (activeTab === 'mastered') {
        formData.append('file', file);
        endpoint = '/api/bulk-upload/mastered-goals';
      } else {
        formData.append('csvFile', file);
        endpoint = '/api/goal-templates/bulk-upload';
      }

      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok) {
        if (activeTab === 'goal-templates') {
          setResult({
            success: true,
            message: data.message || `${data.summary?.successful || 0} templates created successfully!`,
            details: data.summary ? {
              totalRows: data.summary.totalProcessed,
              successCount: data.summary.successful,
              errorCount: data.summary.failed,
              errors: data.errors
            } : undefined
          });
        } else {
          setResult({
            success: true,
            message: data.message || 'Upload successful!',
            details: data.details
          });
        }
        setFile(null);
        setPreviewData([]);
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setResult({
          success: false,
          message: data.error || 'Upload failed',
          details: data.details || (data.errors ? {
            totalRows: 0,
            successCount: 0,
            errorCount: data.errors?.length || 0,
            errors: data.errors
          } : undefined)
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async (type: 'assessments' | 'mastered' | 'goal-templates') => {
    try {
      const response = await apiRequest(`/api/bulk-upload/template/${type}`);
      
      if (!response.ok) {
        throw new Error('Failed to generate template');
      }
      
      const csvContent = await response.text();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-template.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download template:', error);
      alert('Failed to download template. Please try again.');
    }
  };

  const getInstructionTitle = () => {
    switch (activeTab) {
      case 'assessments': return 'Assessment History Format';
      case 'mastered': return 'Mastered Goals Format';
      case 'goal-templates': return 'Goal Templates Format';
    }
  };

  const renderInstructions = () => {
    switch (activeTab) {
      case 'assessments':
        return (
          <>
            <p className="mb-2">Your CSV should have these columns:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Date</strong> - Assessment date (MM/DD/YY format)</li>
              <li><strong>Employee ID</strong> - Employee's unique ID (see reference table in template)</li>
              <li><strong>Manager ID</strong> - Manager's unique ID (optional, see reference table)</li>
              <li><strong>Template ID</strong> - Goal template's unique ID (see reference table in template)</li>
              <li><strong>Step columns</strong> - One column per step with outcomes and notes (in order)</li>
            </ul>
            <p className="mt-2"><strong>Step format:</strong> Enter outcome code, add notes with " - " separator</p>
            <p className="mt-1"><strong>Codes:</strong> 1 = correct, v or x = verbal prompt, n/a = not applicable</p>
            <p className="mt-1"><strong>Examples:</strong></p>
            <ul className="list-disc list-inside text-xs space-y-1 ml-4">
              <li>"1" = Correct (no note)</li>
              <li>"1 - reminded him" = Correct with note</li>
              <li>"v - cue for filling" = Verbal prompt with note</li>
              <li>"x - did not do but..." = Verbal prompt with note</li>
              <li>"n/a" = Not applicable</li>
            </ul>
          </>
        );
      case 'mastered':
        return (
          <>
            <p className="mb-2">Your CSV should have these columns:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Employee ID</strong> - Employee's unique ID (see reference table in template)</li>
              <li><strong>Template ID</strong> - Goal template's unique ID (see reference table in template)</li>
              <li><strong>Mastery Date</strong> (optional) - Date when goal was mastered (MM/DD/YY format)</li>
            </ul>
            <p className="mt-2">Download the template to see the full list of Employee and Template IDs.</p>
          </>
        );
      case 'goal-templates':
        return (
          <>
            <p className="mb-2">Your CSV should have these columns:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Template Name</strong> - Unique name for the goal template</li>
              <li><strong>Goal Statement</strong> - Description of what the employee will achieve</li>
              <li><strong>Duration Number</strong> - Number for the target timeframe (e.g. 3)</li>
              <li><strong>Duration Unit</strong> - days, weeks, months, or years</li>
              <li><strong>Step columns</strong> - One column per step (Step 1, Step 2, etc.) - at least 1 required</li>
            </ul>
            <p className="mt-2">Each template can have up to 30+ steps. Empty step columns at the end are ignored.</p>
          </>
        );
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <Tabs
          tabs={[
            { id: 'assessments', label: 'Assessment History', icon: <FileText className="h-4 w-4" /> },
            { id: 'mastered', label: 'Mastered Goals', icon: <CheckCircle className="h-4 w-4" /> },
            { id: 'goal-templates', label: 'Goal Templates', icon: <Target className="h-4 w-4" /> },
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab as 'assessments' | 'mastered' | 'goal-templates'); setFile(null); setResult(null); setPreviewData([]); }}
          className="mb-6"
        />

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            {getInstructionTitle()}
          </h3>
          <div className="text-sm text-blue-800">
            {renderInstructions()}
          </div>
          <button
            onClick={() => downloadTemplate(activeTab)}
            className="mt-3 flex items-center space-x-2 text-sm text-blue-700 hover:text-blue-900 font-medium"
            data-testid="button-download-template"
          >
            <Download className="h-4 w-4" />
            <span>Download CSV Template</span>
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select CSV File
          </label>
          <div className="flex items-center space-x-4">
            <label className="flex-1 flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 cursor-pointer transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-csv-file"
              />
              <div className="flex items-center space-x-2 text-gray-600">
                <Upload className="h-5 w-5" />
                <span>{file ? file.name : 'Choose CSV file...'}</span>
              </div>
            </label>
            {file && (
              <button
                onClick={() => { setFile(null); setPreviewData([]); }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                data-testid="button-clear-file"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {previewData.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Preview (first 5 rows)</h3>
            <div className="overflow-x-auto border rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(previewData[0]).map(header => (
                      <th key={header} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((value: any, j) => (
                        <td key={j} className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          data-testid="button-upload"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span>Upload and Process</span>
            </>
          )}
        </button>

        {result && (
          <div className={`mt-6 p-4 rounded-xl ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start space-x-3">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className={`font-semibold ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                  {result.message}
                </h4>
                {result.details && (
                  <div className="mt-2 text-sm">
                    <p className={result.success ? 'text-green-800' : 'text-red-800'}>
                      Total Rows: {result.details.totalRows} | 
                      Successful: {result.details.successCount} | 
                      Errors: {result.details.errorCount}
                    </p>
                    {result.details.errors && result.details.errors.length > 0 && (
                      <ul className="mt-2 space-y-1 text-red-700">
                        {result.details.errors.slice(0, 10).map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                        {result.details.errors.length > 10 && (
                          <li>... and {result.details.errors.length - 10} more errors</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
