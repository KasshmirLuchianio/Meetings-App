import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Upload, FileAudio, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function UploadAudioCard({ backendUrl, onUploadComplete }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/ogg'];
    const validExtensions = ['.webm', '.wav', '.mp3', '.m4a', '.ogg', '.aac'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    const isValidType = validTypes.includes(file.type) || validExtensions.includes(fileExtension);
    
    if (!isValidType) {
      toast.error('Format audio neacceptat. Folosiți: MP3, WAV, M4A, WEBM, OGG');
      return;
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast.error('Fișierul este prea mare. Mărimea maximă: 100 MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Create meeting placeholder
      const createRes = await fetch(`${backendUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!createRes.ok) throw new Error('Eroare la creare');
      const meeting = await createRes.json();

      // Step 2: Upload audio with progress tracking
      const formData = new FormData();
      formData.append('file', selectedFile);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          toast.success('Fișier încărcat! Se procesează...');
          setSelectedFile(null);
          setUploading(false);
          setUploadProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (onUploadComplete) onUploadComplete();
          
          // Navigate to meeting detail after a short delay
          setTimeout(() => {
            navigate(`/meeting/${meeting._id}`);
          }, 1000);
        } else {
          throw new Error('Eroare la încărcare');
        }
      });

      xhr.addEventListener('error', () => {
        throw new Error('Eroare de rețea');
      });

      xhr.open('POST', `${backendUrl}/api/meetings/${meeting._id}/upload`);
      xhr.send(formData);

    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Eroare la încărcare: ' + err.message);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card className="p-6 rounded-2xl space-y-4" data-testid="upload-audio-card">
      {!selectedFile ? (
        // File selection state
        <div className="text-center space-y-4">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-accent/50 flex items-center justify-center">
            <Upload className="h-8 w-8 text-accent-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-1">Încarcă înregistrare</h3>
            <p className="text-sm text-muted-foreground">
              Selectați un fișier audio înregistrat offline
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.aac"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="audio-file-input"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full h-14 rounded-xl gap-2 text-base border-2 border-primary/30 hover:bg-primary/5"
            data-testid="select-audio-button"
          >
            <FileAudio className="h-5 w-5" />
            Selectează fișier audio
          </Button>
          <p className="text-xs text-muted-foreground">
            Format acceptat: MP3, WAV, M4A, WEBM, OGG • Max 100 MB
          </p>
        </div>
      ) : (
        // File selected / uploading state
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-accent/30">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileAudio className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            {!uploading && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleCancel}
                data-testid="cancel-file-button"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Se încarcă...</span>
                <span className="font-medium text-primary">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" data-testid="upload-progress-bar" />
            </div>
          )}

          {!uploading && (
            <Button
              onClick={handleUpload}
              className="w-full h-14 rounded-xl gap-2 text-base font-semibold"
              data-testid="upload-audio-button"
            >
              <Upload className="h-5 w-5" />
              Încarcă și procesează
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
