'use client';

import { useState } from 'react';
import { Play, Image as ImageIcon, X, ChevronLeft } from 'lucide-react';

interface PropertyGalleryProps {
    images: string[];
    thumbnail?: string;
}

export default function PropertyGallery({ images = [], thumbnail }: PropertyGalleryProps) {
    // Combine all media
    const allMedia = [
        ...(thumbnail && !images.includes(thumbnail) ? [{ type: 'image', url: thumbnail }] : []),
        ...images.map(url => ({ type: 'image', url })),
    ];

    const [showModal, setShowModal] = useState(false);

    if (allMedia.length === 0) {
        return (
            <div className="aspect-[16/9] bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No images available</p>
                </div>
            </div>
        );
    }

    // Determine grid items (max 5 for the preview)
    const displayMedia = allMedia.slice(0, 5);

    return (
        <>
            {/* Desktop Grid Layout (Hidden on Mobile) */}
            <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[400px] lg:h-[480px] rounded-xl overflow-hidden relative">
                {/* Main Hero Image (Left Half) */}
                <div className="col-span-2 row-span-2 relative group cursor-pointer" onClick={() => setShowModal(true)}>
                    <MediaItem media={displayMedia[0]} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>

                {/* Sub Images (Right Half) */}
                {displayMedia.slice(1).map((media, index) => (
                    <div
                        key={index}
                        className={`relative group cursor-pointer ${index === 2 || index === 3 ? 'hidden lg:block' : ''}`} // Adjust visibility if needed
                        onClick={() => setShowModal(true)}
                    >
                        <MediaItem media={media} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                ))}

                {/* "Show all photos" Button */}
                <button
                    onClick={() => setShowModal(true)}
                    className="absolute bottom-4 right-4 bg-white hover:bg-gray-100 text-gray-900 px-4 py-1.5 rounded-lg text-sm font-medium shadow-sm border border-gray-900 transition-colors flex items-center gap-2"
                >
                    <div className="grid grid-cols-2 gap-0.5">
                        <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                        <div className="w-1 h-1 bg-gray-900 rounded-full"></div>
                    </div>
                    Show all photos
                </button>
            </div>

            {/* Mobile Layout (Simple Carousel/Hero) */}
            <div className="md:hidden relative aspect-[4/3] bg-gray-100">
                <MediaItem media={displayMedia[0]} className="w-full h-full object-cover" />
                <button
                    onClick={() => setShowModal(true)}
                    className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-md text-xs backdrop-blur-md"
                >
                    1 / {allMedia.length}
                </button>
            </div>

            {/* Full Screen Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-white animate-in slide-in-from-bottom-4 duration-300 flex flex-col">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100">
                        <button
                            onClick={() => setShowModal(false)}
                            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="font-medium">All Photos</div>
                        <div className="w-8"></div> {/* Spacer for alignment */}
                    </div>

                    {/* Modal Content - Vertical Scroll */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
                        <div className="max-w-4xl mx-auto space-y-4 md:space-y-8">
                            {allMedia.map((media, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="rounded-xl overflow-hidden bg-gray-50">
                                        <MediaItem
                                            media={media}
                                            className="w-full h-auto max-h-[85vh] object-contain mx-auto"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function MediaItem({ media, className }: { media: { type: string, url: string }, className?: string }) {
    return <img src={media.url} alt="Property" className={className} />;
}
