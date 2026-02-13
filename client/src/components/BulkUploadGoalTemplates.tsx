import React, { useState } from "react";
import { Download, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "../lib/auth";

interface UploadResult {
  message: string;
  success: Array<{
    line: number;
    templateId: string;
    name: string;
    stepsCount: number;
  }>;
  errors: string[];
  summary: {
    totalProcessed: number;
    successful: number;
    failed: number;
  };
}

export function BulkUploadGoalTemplates({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      setSelectedFile(file);
      setUploadResult(null);
    } else {
      alert("Please select a CSV file");
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/goal-templates-bulk-upload-template.csv";
    link.download = "goal-templates-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("csvFile", selectedFile);

      const response = await apiRequest("/api/goal-templates/bulk-upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult(result);
        alert(`Upload completed! ${result.summary.successful} templates created successfully`);
        onUploadComplete?.();
      } else {
        alert(result.error || "Failed to process CSV file");
      }
    } catch (error) {
      alert("Failed to upload CSV file");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="bulk-upload-goal-templates">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <Upload className="w-5 h-5" />
            Bulk Upload Goal Templates
          </h2>
          <p className="text-gray-600">
            Upload multiple goal templates at once using a CSV file. Each template can have up to 30+ steps.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
            <div>
              <h4 className="font-medium">Download CSV Template</h4>
              <p className="text-sm text-gray-600">
                Get the properly formatted CSV template with example data
              </p>
            </div>
            <button 
              onClick={downloadTemplate}
              className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors border border-gray-300"
              data-testid="button-download-template"
            >
              <Download className="w-4 h-4" />
              <span>Download Template</span>
            </button>
          </div>

          <div className="space-y-2">
            <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700">Select CSV File</label>
            <input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
              data-testid="input-csv-file"
            />
            {selectedFile && (
              <p className="text-sm text-gray-600">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <button 
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className={`w-full px-4 py-2 rounded-xl font-medium transition-colors ${
              !selectedFile || isUploading
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            data-testid="button-upload-csv"
          >
            {isUploading ? "Uploading..." : "Upload CSV"}
          </button>
        </div>
      </div>

      {uploadResult && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              {uploadResult.summary.failed === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              Upload Results
            </h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {uploadResult.summary.totalProcessed}
                </div>
                <div className="text-sm text-gray-600">Total Processed</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {uploadResult.summary.successful}
                </div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {uploadResult.summary.failed}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
            </div>

            {uploadResult.success.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-green-600">Successfully Created Templates</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {uploadResult.success.map((success) => (
                    <div key={success.templateId} className="text-sm p-2 bg-green-50 rounded border-l-2 border-green-500">
                      <strong>{success.name}</strong> - {success.stepsCount} steps (Line {success.line})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-red-600">Errors</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {uploadResult.errors.map((error, index) => (
                    <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}