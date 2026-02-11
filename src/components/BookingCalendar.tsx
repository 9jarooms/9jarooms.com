'use client';

import { useState, useMemo } from 'react';
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
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Availability } from '@/types/database';

interface CalendarProps {
    availability: Availability[];
    onDateSelect?: (checkIn: Date, checkOut: Date) => void;
    selectedCheckIn?: Date | null;
    selectedCheckOut?: Date | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BookingCalendar({
    availability,
    onDateSelect,
    selectedCheckIn: externalCheckIn,
    selectedCheckOut: externalCheckOut,
}: CalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [checkIn, setCheckIn] = useState<Date | null>(externalCheckIn || null);
    const [checkOut, setCheckOut] = useState<Date | null>(externalCheckOut || null);
    const [feedback, setFeedback] = useState<{ date: string; message: string } | null>(null);

    const today = startOfDay(new Date());

    // Build a map of date -> status
    const statusMap = useMemo(() => {
        const map: Record<string, string> = {};
        availability.forEach((a) => {
            map[a.date] = a.status;
        });
        return map;
    }, [availability]);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Pad with empty days for alignment
    const startPadding = getDay(monthStart);

    const isDateUnavailable = (date: Date): boolean => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const status = statusMap[dateStr];
        return status === 'booked' || status === 'held' || status === 'maintenance' || status === 'cleaning';
    };

    const isDatePast = (date: Date): boolean => {
        return isBefore(date, today);
    };

    // Helper to find the next unavailable date after the selected check-in
    const getNextUnavailableDate = (startDate: Date): Date | null => {
        const sortedDates = Object.keys(statusMap)
            .sort()
            .map(d => new Date(d))
            .filter(d => isAfter(d, startDate) && statusMap[format(d, 'yyyy-MM-dd')] === 'booked');

        return sortedDates.length > 0 ? sortedDates[0] : null;
    };

    // A date is "checkout only" if it is the check-in date of another booking
    // For simplicity, we treat any booked date as potentially a checkout date 
    // IF the user has a valid check-in selected before it.
    // Visual requirements: "grey but glowing a bit", "not crossed out at first".
    const isCheckoutTarget = (date: Date): boolean => {
        // Is this date booked?
        const dateStr = format(date, 'yyyy-MM-dd');
        return statusMap[dateStr] === 'booked';
    };

    const isDateDisabled = (date: Date): boolean => {
        if (isDatePast(date)) return true;

        // If check-in is selected...
        if (checkIn && !checkOut) {
            // Block dates before check-in
            if (isBefore(date, checkIn)) return true;

            // Block dates AFTER the next unavailable date (barrier)
            const nextUnavailable = getNextUnavailableDate(checkIn);
            if (nextUnavailable && isAfter(date, nextUnavailable)) {
                return true;
            }

            // The barrier date itself is allowed (valid checkout)
            if (nextUnavailable && isSameDay(date, nextUnavailable)) {
                return false;
            }
        }

        // If no check-in is selected, user is picking a Start Date.
        // Start Date cannot be a booked date (even if it's checkout-only for someone else, it's not a valid check-in for me).
        if (!checkIn && isCheckoutTarget(date)) {
            return true;
        }

        // Standard unavailable check
        if (isDateUnavailable(date)) {
            // Exception: If we are picking checkout, and this is the barrier, allow it.
            if (checkIn && !checkOut) {
                const nextUnavailable = getNextUnavailableDate(checkIn);
                if (nextUnavailable && isSameDay(date, nextUnavailable)) {
                    return false;
                }
            }
            return true;
        }

        return false;
    };

    const handleDateClick = (date: Date) => {
        setFeedback(null);

        if (isDateDisabled(date)) {
            // User visual requirement: "shows check out only" when clicked
            if (isCheckoutTarget(date)) {
                setFeedback({
                    date: date.toISOString(),
                    message: "Check-out Only"
                });
                setTimeout(() => setFeedback(null), 2000);
            }
            return;
        }

        if (!checkIn || (checkIn && checkOut)) {
            // Starting a new selection
            // Cannot start on a booked date
            if (isDateUnavailable(date)) return;

            setCheckIn(date);
            setCheckOut(null);
            onDateSelect?.(date, null as any);
        } else {
            // Selecting check-out
            if (isSameDay(date, checkIn)) {
                // Same day — clear
                setCheckIn(null);
                setCheckOut(null);
                onDateSelect?.(null as any, null as any);
                return;
            }

            setCheckOut(date);
            onDateSelect?.(checkIn, date);
        }
    };

    const isInRange = (date: Date): boolean => {
        if (!checkIn || !checkOut) return false;
        return isAfter(date, checkIn) && isBefore(date, checkOut);
    };

    const getDayClass = (date: Date): string => {
        const classes = ['calendar-day'];

        if (!isSameMonth(date, currentMonth)) {
            classes.push('calendar-day-disabled');
            return classes.join(' ');
        }

        if (isDateDisabled(date)) {
            // Distinguish between purely disabled and "booked but maybe checkout"
            // But if disabled, just disabled style
            classes.push('calendar-day-disabled');
            // If it was disabled because it's booked, add booked style too for visibility?
            if (isDateUnavailable(date)) classes.push('calendar-day-booked');
            return classes.join(' ');
        }

        // If not disabled...
        const isUnavailable = isDateUnavailable(date);
        const isTarget = isCheckoutTarget(date);

        if (isSameDay(date, today)) {
            classes.push('calendar-day-today');
        }

        if ((checkIn && isSameDay(date, checkIn))) {
            classes.push('calendar-day-selected');
            classes.push('calendar-day-start');
        } else if ((checkOut && isSameDay(date, checkOut))) {
            classes.push('calendar-day-selected');
            classes.push('calendar-day-end');
        } else if (isInRange(date)) {
            classes.push('calendar-day-in-range');
        } else if (isUnavailable && isTarget) { // It is booked/unavailable AND it's a checkout target.
            // User wants: "not crossed at first", "grey but glowing a bit".
            // We apply a special class for purely booked dates to handle this visual.
            classes.push('calendar-day-checkout-only');
        } else if (isUnavailable) { // It is unavailable but not a checkout target (e.g., held, maintenance)
            classes.push('calendar-day-booked'); // Using 'booked' for general unavailable dates that are not checkout-only
        } else {
            classes.push('calendar-day-available');
        }

        return classes.join(' ');
    };

    return (
        <div className="select-none">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <ChevronLeft size={18} />
                </button>
                <h3 className="font-semibold text-gray-900">
                    {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-gray-400 py-2">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
                {/* Padding */}
                {Array.from({ length: startPadding }).map((_, i) => (
                    <div key={`pad-${i}`} className="calendar-day" />
                ))}

                {days.map((day) => {
                    const isDisabled = isDateDisabled(day);
                    const isBooked = isCheckoutTarget(day);

                    // We allow clicking if it's a checkout target (to show the message), 
                    // even if strictly disabled for *selection* as a start date.
                    const isButtonDisabled = isDisabled && !isBooked;

                    let title = format(day, 'MMM d, yyyy');
                    if (isBooked) {
                        if (checkIn && !checkOut && !isDisabled) {
                            title = 'Check-out Only';
                        } else {
                            title = 'Booked';
                        }
                    } else if (isDateUnavailable(day)) {
                        title = 'Unavailable';
                    }

                    const isFeedbackTarget = feedback?.date === day.toISOString();

                    return (
                        <div key={day.toISOString()} className="relative">
                            <button
                                onClick={() => handleDateClick(day)}
                                className={getDayClass(day)}
                                disabled={isButtonDisabled}
                                title={title}
                            >
                                {format(day, 'd')}
                            </button>
                            {isFeedbackTarget && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 whitespace-nowrap bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg animate-in fade-in zoom-in duration-200">
                                    {feedback.message}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-400" />
                    Selected
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-50 border border-green-200" />
                    Available
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-gray-200" />
                    Unavailable
                </div>
            </div>

            {/* Selection info */}
            {checkIn && (
                <div className="mt-4 p-3 bg-green-50 rounded-xl text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-600">Check-in:</span>
                        <span className="font-semibold text-gray-900">{format(checkIn, 'MMM d, yyyy')}</span>
                    </div>
                    {checkOut && (
                        <>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-gray-600">Check-out:</span>
                                <span className="font-semibold text-gray-900">{format(checkOut, 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1 pt-2 border-t border-green-100">
                                <span className="text-gray-600">Nights:</span>
                                <span className="font-semibold text-green-600">
                                    {Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))}
                                </span>
                            </div>
                        </>
                    )}
                    {!checkOut && (
                        <p className="text-green-600 text-xs mt-2">Select a check-out date</p>
                    )}
                </div>
            )}
        </div>
    );
}
