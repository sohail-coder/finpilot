import { useState, useRef } from "react";
import type { CsvImportResult } from "../types";
import { uploadCsvImport, extractErrorMessage } from "../lib/api";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CsvImportModal({ onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CsvImportResult | null>(null);

  async function handleUpload() {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const res = await uploadCsvImport(file);
      setResult(res);
      if (res.imported > 0) onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold mb-1">Import Transactions</h3>
        <p className="text-sm text-gray-500 mb-4">
          Upload a CSV file with columns:{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
            date, amount, type, category, description, currency
          </code>
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 mb-3 text-sm">
            {error}
          </div>
        )}

        {/* File picker */}
        {!result && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 transition"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-gray-700">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">
                    Click to select a <strong>.csv</strong> file
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Max 2 MB</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Import"}
              </button>
            </div>
          </>
        )}

        {/* Results */}
        {result && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                <p className="text-xs text-green-600">Imported</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{result.failed}</p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Row Errors</p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 w-16">Row</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.errors.map((e, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-gray-600">{e.row}</td>
                          <td className="px-3 py-2 text-red-600">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
