'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { createClient } from '@/lib/supabase/client';
import imageCompression from 'browser-image-compression';
import { X, Upload, Loader2, ImagePlus } from 'lucide-react';

interface MediaUploaderProps {
    onUpload: (urls: string[]) => void;
    existingUrls?: string[];
    bucket?: string;
    folder?: string;
    accept?: Record<string, string[]>;
    maxSizeMB?: number;
    single?: boolean;
}

export default function MediaUploader({
    onUpload,
    existingUrls = [],
    bucket = 'property-media',
    folder = 'uploads',
    accept = {
        'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxSizeMB = 10,
    single = false
}: MediaUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [urls, setUrls] = useState<string[]>(existingUrls);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);

    const supabase = createClient();

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setUploading(true);
        setError('');
        setProgress(0);
        const newUrls: string[] = [];

        console.log('MediaUploader: Files dropped:', acceptedFiles.map(f => `${f.name} (${f.type}, ${f.size} bytes)`));

        try {
            // Check session first
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                console.error('MediaUploader: No active session. Upload blocked.');
                throw new Error('You must be logged in to upload files.');
            }

            let completed = 0;
            const total = acceptedFiles.length;

            for (const file of acceptedFiles) {
                console.log(`MediaUploader: Processing ${file.name}...`);

                // Check size
                if (file.size > maxSizeMB * 1024 * 1024) {
                    setError(`File ${file.name} exceeds ${maxSizeMB}MB limit.`);
                    continue;
                }

                let fileToUpload = file;
                const isImage = file.type.startsWith('image/');

                // Compress images
                if (isImage) {
                    try {
                        console.log(`Compressing ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
                        const options = {
                            maxSizeMB: 1, // Compress to ~1MB
                            maxWidthOrHeight: 1920,
                            useWebWorker: true,
                        };
                        fileToUpload = await imageCompression(file, options);
                        console.log(`Compressed to ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
                    } catch (err) {
                        console.error('Compression failed, using original:', err);
                    }
                }

                // Upload to Supabase
                const fileExt = file.name.split('.').pop();
                const fileName = `${folder}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

                console.log(`MediaUploader: Uploading ${file.name} to ${bucket}/${fileName}...`);

                const { data, error: uploadError } = await supabase.storage
                    .from(bucket)
                    .upload(fileName, fileToUpload);

                if (uploadError) {
                    console.error('MediaUploader: Supabase Upload Error:', uploadError);
                    throw uploadError;
                }

                console.log('MediaUploader: Upload successful:', data);

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(fileName);

                console.log('MediaUploader: Public URL:', publicUrl);

                newUrls.push(publicUrl);
                completed++;
                setProgress(Math.round((completed / total) * 100));
            }

            let updatedUrls;
            if (single) {
                updatedUrls = [newUrls[newUrls.length - 1]]; // Keep only the last uploaded
            } else {
                updatedUrls = [...urls, ...newUrls];
            }

            setUrls(updatedUrls);
            onUpload(updatedUrls);

        } catch (err: any) {
            console.error('Upload error catch block:', err);
            setError(err.message || 'Failed to upload files');
        } finally {
            setUploading(false);
        }
    }, [bucket, folder, maxSizeMB, onUpload, urls, supabase, single]);

    const removeUrl = (indexToRemove: number) => {
        const updated = urls.filter((_, i) => i !== indexToRemove);
        setUrls(updated);
        onUpload(updated);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept,
        maxSize: maxSizeMB * 1024 * 1024,
        multiple: !single,
    });

    return (
        <div className="w-full">
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors relative overflow-hidden
                    ${isDragActive ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'}
                    ${single && urls.length > 0 ? 'border-none p-0 h-40' : ''}`}
            >
                <input {...getInputProps()} />

                {single && urls.length > 0 && !uploading ? (
                    <div className="w-full h-full relative group">
                        <img src={urls[0]} alt="Thumbnail" className="w-full h-full object-cover rounded-lg" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <span className="text-xs font-medium bg-black/50 px-2 py-1 rounded">Click to Replace</span>
                        </div>
                    </div>
                ) : uploading ? (
                    <div className="flex flex-col items-center justify-center text-gray-500 py-4 px-2">
                        <Loader2 className="animate-spin mb-2 text-green-600" />
                        <p className="text-sm font-medium text-gray-700">Uploading...</p>
                        <p className="text-xs text-gray-400 mt-1 text-center max-w-[200px] truncate">
                            {progress > 0 && progress < 100 ? `${progress}% (Finishing up...)` : 'Sending data...'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-500 py-2">
                        {single ? <ImagePlus size={24} /> : <ImagePlus size={24} />}
                        <p className="text-sm font-medium">{single ? 'Upload Thumbnail' : 'Click to upload or drag & drop'}</p>
                        <p className="text-xs text-gray-400">
                            {single ? 'Select one image' : 'Images (compressed)'}
                        </p>
                    </div>
                )}
            </div>

            {error && <p className="text-xs text-red-500 mt-2 font-medium bg-red-50 p-2 rounded border border-red-100">{error}</p>}

            {!single && urls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    {urls.map((url, index) => {
                        return (
                            <div key={index} className="relative group bg-gray-100 rounded-lg overflow-hidden aspect-video border border-gray-200 shadow-sm">
                                <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeUrl(index); }}
                                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    type="button"
                                >
                                    <X size={12} strokeWidth={2.5} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
