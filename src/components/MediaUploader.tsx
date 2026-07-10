'use client';

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { createClient } from '@/lib/supabase/client';
import { X, Loader2, ImagePlus, Star } from 'lucide-react';

// heic2any and browser-image-compression touch `window` at module load, which
// breaks SSR. Import them lazily in the browser only, inside onDrop.

interface MediaUploaderProps {
    onUpload: (urls: string[]) => void;
    existingUrls?: string[];
    bucket?: string;
    folder?: string;
    accept?: Record<string, string[]>;
    maxSizeMB?: number;
    single?: boolean;
    /** The current thumbnail URL (only meaningful when single=false) */
    thumbnail?: string;
    /** Called when user clicks the star icon on an image to set it as thumbnail */
    onThumbnailChange?: (url: string) => void;
}

export default function MediaUploader({
    onUpload,
    existingUrls = [],
    bucket = 'property-media',
    folder = 'uploads',
    accept = {
        'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif']
    },
    maxSizeMB = 10,
    single = false,
    thumbnail,
    onThumbnailChange,
}: MediaUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [urls, setUrls] = useState<string[]>(existingUrls);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);

    // drag-to-reorder state
    const dragItem = useRef<number | null>(null);
    const dragOver = useRef<number | null>(null);

    const supabase = createClient();

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setUploading(true);
        setError('');
        setProgress(0);
        const newUrls: string[] = [];

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error('You must be logged in to upload files.');
            }

            let completed = 0;
            const total = acceptedFiles.length;

            for (const file of acceptedFiles) {
                if (file.size > maxSizeMB * 1024 * 1024) {
                    setError(`File ${file.name} exceeds ${maxSizeMB}MB limit.`);
                    continue;
                }

                let fileToUpload: File = file;
                const isImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
                const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);

                // Convert HEIC/HEIF to JPEG first
                if (isHeic) {
                    try {
                        const heic2any = (await import('heic2any')).default;
                        const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
                        const jpegBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                        fileToUpload = new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
                    } catch (err) {
                        console.warn('HEIC conversion failed:', err);
                        setError('Could not process this image format. Please convert to JPG/PNG first.');
                        continue;
                    }
                }

                if (isImage) {
                    try {
                        const imageCompression = (await import('browser-image-compression')).default;
                        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
                        fileToUpload = await imageCompression(fileToUpload, options);
                    } catch (err) {
                        console.warn('Image compression skipped, using original:', err);
                    }
                }

                const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
                const fileName = `${folder}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

                const { data, error: uploadError } = await supabase.storage
                    .from(bucket)
                    .upload(fileName, fileToUpload);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(fileName);

                newUrls.push(publicUrl);
                completed++;
                setProgress(Math.round((completed / total) * 100));
            }

            let updatedUrls;
            if (single) {
                updatedUrls = [newUrls[newUrls.length - 1]];
            } else {
                updatedUrls = [...urls, ...newUrls];
            }

            setUrls(updatedUrls);
            onUpload(updatedUrls);

        } catch (err: any) {
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

    // ── Drag-to-reorder handlers ──────────────────────────────────────────────
    const handleDragStart = (index: number) => {
        dragItem.current = index;
    };

    const handleDragEnter = (index: number) => {
        dragOver.current = index;
    };

    const handleDragEnd = () => {
        if (dragItem.current === null || dragOver.current === null) return;
        if (dragItem.current === dragOver.current) return;

        const reordered = [...urls];
        const [moved] = reordered.splice(dragItem.current, 1);
        reordered.splice(dragOver.current, 0, moved);

        dragItem.current = null;
        dragOver.current = null;

        setUrls(reordered);
        onUpload(reordered);
    };
    // ─────────────────────────────────────────────────────────────────────────

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
                        <ImagePlus size={24} />
                        <p className="text-sm font-medium">{single ? 'Upload Thumbnail' : 'Click to upload or drag & drop'}</p>
                        <p className="text-xs text-gray-400">
                            {single ? 'Select one image' : 'Images (compressed)'}
                        </p>
                    </div>
                )}
            </div>

            {error && <p className="text-xs text-red-500 mt-2 font-medium bg-red-50 p-2 rounded border border-red-100">{error}</p>}

            {/* Gallery grid with drag-to-reorder + thumbnail picker */}
            {!single && urls.length > 0 && (
                <>
                    {onThumbnailChange && (
                        <p className="text-xs text-gray-400 mt-3 mb-1.5 flex items-center gap-1">
                            <Star size={11} className="text-amber-400 fill-amber-400" />
                            Drag images to reorder · Click <Star size={11} className="inline text-amber-400 fill-amber-400" /> to set as thumbnail
                        </p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
                        {urls.map((url, index) => {
                            const isThumbnail = thumbnail ? url === thumbnail : index === 0;
                            return (
                                <div
                                    key={url + index}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragEnter={() => handleDragEnter(index)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                    className="relative group bg-gray-100 rounded-lg overflow-hidden aspect-video border-2 shadow-sm cursor-grab active:cursor-grabbing select-none transition-all"
                                    style={{
                                        borderColor: isThumbnail ? '#f59e0b' : '#e5e7eb',
                                    }}
                                >
                                    <img src={url} alt="Uploaded" className="w-full h-full object-cover pointer-events-none" />

                                    {/* Thumbnail badge */}
                                    {isThumbnail && (
                                        <div className="absolute top-1 left-1 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow">
                                            <Star size={9} className="fill-white" /> Thumbnail
                                        </div>
                                    )}

                                    {/* Hover overlay with controls */}
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-1.5">
                                        {/* Set as thumbnail star button */}
                                        {onThumbnailChange && !isThumbnail && (
                                            <button
                                                type="button"
                                                title="Set as thumbnail"
                                                onClick={(e) => { e.stopPropagation(); onThumbnailChange(url); }}
                                                className="bg-amber-400 hover:bg-amber-500 text-white rounded-full p-1.5 shadow-lg transition-colors"
                                            >
                                                <Star size={12} strokeWidth={2} />
                                            </button>
                                        )}
                                        {isThumbnail && <span />}

                                        {/* Delete button */}
                                        <button
                                            type="button"
                                            title="Remove image"
                                            onClick={(e) => { e.stopPropagation(); removeUrl(index); }}
                                            className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                                        >
                                            <X size={12} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
