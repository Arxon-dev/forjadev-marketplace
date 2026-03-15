"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Check, Upload, X } from "lucide-react";

interface FileUploadProps {
  onFileSelected: (file: File) => Promise<void>;
  accept?: string;
  maxSize?: number;
  label?: string;
  isLoading?: boolean;
  autoClearOnSuccess?: boolean;
  successMessage?: string;
}

export function FileUpload({
  onFileSelected,
  accept = "*",
  maxSize = Infinity,
  label = "Seleccionar archivo",
  isLoading = false,
  autoClearOnSuccess = true,
  successMessage = "Archivo subido exitosamente",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validateFile = (file: File) => {
    setError("");

    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      setError(`El archivo no debe superar ${maxSizeMB}MB`);
      return false;
    }

    return true;
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setPreview("");
    setProgress(0);
    setSuccess(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    setSelectedFile(file);
    setProgress(0);
    setSuccess(false);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview((event.target?.result as string) || "");
      };
      reader.readAsDataURL(file);
    } else {
      setPreview("");
    }

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }

        return prev + Math.random() * 30;
      });
    }, 200);

    try {
      await onFileSelected(file);
      clearInterval(progressInterval);
      setProgress(100);
      setSuccess(true);

      if (autoClearOnSuccess) {
        setTimeout(() => {
          resetSelection();
        }, 2000);
      }
    } catch (err: unknown) {
      clearInterval(progressInterval);
      const errorMessage = err instanceof Error ? err.message : "Error al subir archivo";
      setError(errorMessage);
      setProgress(0);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          isDragging
            ? "border-blue-400 bg-blue-500/10"
            : "border-white/20 bg-white/5 hover:border-white/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={isLoading}
          className="hidden"
        />

        {!selectedFile ? (
          <>
            <Upload className="mx-auto h-8 w-8 text-white/50" />
            <p className="mt-2 text-sm font-medium text-white">{label}</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">
              o arrastra un archivo aqui
            </p>
          </>
        ) : (
          <>
            {preview ? (
              <Image
                src={preview}
                alt="Preview"
                width={256}
                height={128}
                unoptimized
                className="mx-auto mb-4 max-h-32 rounded-lg object-contain"
              />
            ) : null}
            <p className="text-sm font-medium text-white">{selectedFile.name}</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </>
        )}
      </div>

      {(progress > 0 || isLoading) ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
              style={{ width: `${Math.max(progress, isLoading ? 50 : 0)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--text-soft)]">
            {isLoading ? "Procesando..." : `${Math.round(progress)}%`}
          </p>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <Check className="h-4 w-4" />
          {successMessage}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <span>{error}</span>
          {selectedFile ? (
            <button onClick={resetSelection} className="ml-2 hover:text-red-300" type="button">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      {selectedFile && !error ? (
        <button
          onClick={resetSelection}
          className="text-xs text-[var(--text-soft)] hover:text-white"
          type="button"
        >
          Limpiar seleccion
        </button>
      ) : null}
    </div>
  );
}
