"use client";

import React, { useRef, useState } from "react";
import { Upload, FileCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  accept?: string;
  maxSizeBytes?: number;
  label?: string;
  hint?: string;
  onFileSelect: (file: File) => void;
  selectedFile?: { name: string; size: number } | null;
  className?: string;
}

export function FileDropzone({
  accept = "application/pdf,.pdf",
  maxSizeBytes = 50 * 1024 * 1024, // 50 MB
  label = "Upload PDF Document",
  hint = "PDF format only, up to 50 MB",
  onFileSelect,
  selectedFile,
  className,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = (file: File) => {
    setErrorMessage(null);

    // Validate type
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setErrorMessage("Only PDF documents are accepted.");
      return;
    }

    // Validate size
    if (file.size > maxSizeBytes) {
      setErrorMessage(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 50 MB limit.`
      );
      return;
    }

    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        tabIndex={0}
        role="button"
        aria-label={label}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-[3px] border-2 border-dashed p-6 md:p-8 text-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
          isDragOver
            ? "border-accent bg-accent-bg/30"
            : selectedFile
            ? "border-success/40 bg-success-bg/20"
            : "border-rule bg-paper-alt hover:bg-paper-alt/80 hover:border-muted/40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              validateAndSelect(e.target.files[0]);
            }
          }}
          className="sr-only"
          aria-hidden="true"
        />

        {selectedFile ? (
          <div className="flex flex-col items-center space-y-2">
            <FileCheck className="h-8 w-8 text-success" />
            <div className="text-sm font-medium text-ink break-all max-w-xs">
              {selectedFile.name}
            </div>
            <div className="text-xs text-muted">
              {(selectedFile.size / 1024).toFixed(0)} KB • Click or drop another to replace
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <Upload className="h-8 w-8 text-muted" />
            <div className="text-sm font-medium text-ink">{label}</div>
            <div className="text-xs text-muted">{hint}</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Choose File
            </Button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-danger" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
