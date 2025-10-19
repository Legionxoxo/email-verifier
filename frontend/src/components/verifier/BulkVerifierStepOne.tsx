/**
 * Bulk Verifier Step One Component
 * File upload confirmation with naming, preview, and header selection
 */

import { useState } from 'react';
import { CheckCircle2, FileText, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent } from '../ui/Card';
import type { CSVFullDataResult } from '../../lib/csvParser';


// Interface for component props
interface BulkVerifierStepOneProps {
    file: File;
    parsedData: CSVFullDataResult;
    onNext: (listName: string) => Promise<void>;
    onHeaderCheckboxChange: (hasHeader: boolean) => void;
    onCancel: () => void;
    error?: string;
    isProcessing?: boolean;
}


/**
 * Bulk Verifier Step One Component
 * @param props - Component props
 * @returns JSX element
 */
export function BulkVerifierStepOne({
    file,
    parsedData,
    onNext,
    onHeaderCheckboxChange,
    onCancel,
    error,
    isProcessing = false
}: BulkVerifierStepOneProps) {
    const [listName, setListName] = useState<string>(file.name.replace('.csv', ''));
    const [hasHeader, setHasHeader] = useState<boolean>(true);


    const handleHeaderCheckboxChange = (checked: boolean) => {
        setHasHeader(checked);
        onHeaderCheckboxChange(checked);
    };


    const handleUploadCSV = () => {
        try {
            if (!listName.trim()) {
                return;
            }
            onNext(listName.trim());
        } catch (error) {
            console.error('Upload CSV error:', error);
        }
    };


    return (
        <div className="space-y-6">
            {/* Success message */}
            <div className="flex items-center justify-center space-x-2 text-green-600">
                <CheckCircle2 className="h-8 w-8" />
                <p className="text-lg font-medium">Your file is ready to upload!</p>
            </div>

            {/* File naming section */}
            <Card>
                <CardContent className="p-6 space-y-4">
                    <div className="flex items-center space-x-2 text-[#2F327D]">
                        <FileText className="h-5 w-5" />
                        <h3 className="font-semibold">Give your list a name <span className="text-red-500">*</span></h3>
                    </div>

                    <Input
                        value={listName}
                        onChange={(e) => setListName(e.target.value)}
                        placeholder="Enter list name..."
                        className="w-full"
                    />
                </CardContent>
            </Card>

            {/* Preview section */}
            <Card>
                <CardContent className="p-6 space-y-4">
                    <div className="flex items-center space-x-2 text-[#2F327D]">
                        <FileText className="h-5 w-5" />
                        <h3 className="font-semibold">Preview of the first 5 rows</h3>
                    </div>

                    {/* Header checkbox */}
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="hasHeader"
                            checked={hasHeader}
                            onChange={(e) => handleHeaderCheckboxChange(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="hasHeader" className="text-sm font-medium text-gray-700 cursor-pointer">
                            This file contains header
                        </label>
                    </div>

                    {/* Table preview */}
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-blue-50">
                                <tr>
                                    {parsedData.headers.map((header, index) => (
                                        <th
                                            key={index}
                                            className="px-4 py-3 text-left text-sm font-semibold text-[#2F327D]"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {parsedData.preview.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="hover:bg-gray-50">
                                        {parsedData.headers.map((header, colIndex) => (
                                            <td
                                                key={colIndex}
                                                className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap"
                                            >
                                                {row[header] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Warning message */}
                    <div className="flex items-start space-x-2 text-xs text-gray-500 italic">
                        <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <p>
                            *An improperly formatted CSV may lead to the preview not matching the original file.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-red-700">Upload Failed</p>
                                <p className="text-sm text-red-600 mt-1">{error}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Upload button */}
            <div className="flex justify-end space-x-4">
                <Button
                    variant="outline"
                    onClick={onCancel}
                    disabled={isProcessing}
                    className="cursor-pointer"
                >
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={handleUploadCSV}
                    disabled={!listName.trim() || isProcessing}
                    loading={isProcessing}
                    className="cursor-pointer"
                >
                    Upload CSV
                </Button>
            </div>
        </div>
    );
}
