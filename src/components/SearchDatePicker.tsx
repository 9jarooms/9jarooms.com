'use client';

import { useState, useEffect, useRef } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isAfter,
    isBefore,
    addMonths,
    subMonths,
    getDay,
    startOfDay,
    parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface SearchDatePickerProps {
    checkIn: string; // ISO string or empty
    checkOut: string; // ISO string or empty
    onChange: (checkIn: string, checkOut: string) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SearchDatePicker({ checkIn: initialCheckIn, checkOut: initialCheckOut, onChange }: SearchDatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Internal state uses Date objects
    const [checkInDate, setCheckInDate] = useState<Date | null>(initialCheckIn ? parseISO(initialCheckIn) : null);
    const [checkOutDate, setCheckOutDate] = useState<Date | null>(initialCheckOut ? parseISO(initialCheckOut) : null);

    // Sync with props if they change externally
    useEffect(() => {
        setCheckInDate(initialCheckIn ? parseISO(initialCheckIn) : null);
        setCheckOutDate(initialCheckOut ? parseISO(initialCheckOut) : null);
    }, [initialCheckIn, initialCheckOut]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const today = startOfDay(new Date());
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startPadding = getDay(monthStart);

    const handleDateClick = (date: Date) => {
        // Prevent past dates
        if (isBefore(date, today)) return;

        let newCheckIn = checkInDate;
        let newCheckOut = checkOutDate;

        if (!newCheckIn || (newCheckIn && newCheckOut)) {
            // Start new selection
            newCheckIn = date;
            newCheckOut = null;
        } else {
            // Selecting checkout
            if (isSameDay(date, newCheckIn)) {
                // Reset if clicking same day
                newCheckIn = null;
                newCheckOut = null;
            } else if (isBefore(date, newCheckIn)) {
                // If clicking before check-in, treat as new check-in
                newCheckIn = date;
                newCheckOut = null;
            } else {
                newCheckOut = date;
                setIsOpen(false); // Close on complete selection
            }
        }

        setCheckInDate(newCheckIn);
        setCheckOutDate(newCheckOut);

        // Notify parent
        onChange(
            newCheckIn ? format(newCheckIn, 'yyyy-MM-dd') : '',
            newCheckOut ? format(newCheckOut, 'yyyy-MM-dd') : ''
        );
    };

    const isInRange = (date: Date): boolean => {
        if (!checkInDate || !checkOutDate) return false;
        return isAfter(date, checkInDate) && isBefore(date, checkOutDate);
    };

    const getDayClass = (date: Date): string => {
        const classes = [
            'h-9 w-9 rounded-full flex items-center justify-center text-sm transition-all'
        ];

        if (!isSameMonth(date, currentMonth)) return 'h-9 w-9 invisible'; // Hide non-month days? Or just grey

        if (isBefore(date, today)) {
            classes.push('text-gray-300 cursor-not-allowed');
            return classes.join(' ');
        }

        classes.push('hover:bg-gray-100 cursor-pointer text-gray-700');

        if (checkInDate && isSameDay(date, checkInDate)) {
            return 'h-9 w-9 rounded-full flex items-center justify-center text-sm bg-black text-white font-medium hover:bg-gray-800';
        }
        if (checkOutDate && isSameDay(date, checkOutDate)) {
            return 'h-9 w-9 rounded-full flex items-center justify-center text-sm bg-black text-white font-medium hover:bg-gray-800';
        }
        if (isInRange(date)) {
            return 'h-9 w-9 flex items-center justify-center text-sm bg-gray-100 text-gray-900';
        }

        return classes.join(' ');
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors"
            >
                <div className="p-1.5 bg-gray-100 rounded-lg text-gray-500">
                    <CalendarIcon size={16} />
                </div>
                <div className="text-left">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">When</div>
                    <div className="text-sm font-medium text-gray-900">
                        {checkInDate ? (
                            <>
                                {format(checkInDate, 'MMM d')}
                                {checkOutDate ? ` - ${format(checkOutDate, 'MMM d')}` : ' - Add dates'}
                            </>
                        ) : (
                            'Add dates'
                        )}
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-full">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="font-semibold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</span>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-full">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 mb-2">
                        {DAYS.map(day => (
                            <div key={day} className="text-center text-xs font-medium text-gray-400">
                                {day.substr(0, 2)}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-y-1">
                        {Array.from({ length: startPadding }).map((_, i) => (
                            <div key={`pad-${i}`} />
                        ))}
                        {days.map(day => (
                            <div key={day.toISOString()} className="flex justify-center">
                                <button
                                    onClick={() => handleDateClick(day)}
                                    className={getDayClass(day)}
                                >
                                    {format(day, 'd')}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between">
                        <button
                            onClick={() => {
                                setCheckInDate(null);
                                setCheckOutDate(null);
                                onChange('', '');
                            }}
                            className="text-xs font-medium text-gray-500 hover:text-black underline"
                        >
                            Clear dates
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-medium text-white bg-black px-3 py-1.5 rounded-lg"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
