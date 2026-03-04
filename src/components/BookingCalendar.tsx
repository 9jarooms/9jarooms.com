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
    addDays,
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
    const startPadding = getDay(monthStart);

    // Check if a date is fully booked (middle of a booking, NOT a checkout day)
    const isDateFullyBooked = (date: Date): boolean => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const status = statusMap[dateStr];
        return status === 'booked' || status === 'held' || status === 'maintenance' || status === 'cleaning';
    };

    // Check if a date is a checkout day = the first day AFTER a booking block.
    // In our system: a booking from Mar 17-24 marks dates 17-23 as 'booked'.
    // The checkout day (Mar 24) is NOT in the availability table, so it's already
    // shown as available. We don't need to special-case booked dates.
    // 
    // However, we DO need to identify checkout days for visual styling:
    // A date where the PREVIOUS day is booked but THIS day is available = checkout day.
    const isCheckoutDay = (date: Date): boolean => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const prevDateStr = format(addDays(date, -1), 'yyyy-MM-dd');
        const thisAvailable = !statusMap[dateStr] || statusMap[dateStr] === 'available';
        const prevBooked = statusMap[prevDateStr] === 'booked' || statusMap[prevDateStr] === 'held';
        return thisAvailable && prevBooked;
    };

    // Check if this is the start of a booking block (first booked day in a streak)
    const isCheckinDay = (date: Date): boolean => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const prevDateStr = format(addDays(date, -1), 'yyyy-MM-dd');
        const thisBooked = statusMap[dateStr] === 'booked' || statusMap[dateStr] === 'held';
        const prevAvailable = !statusMap[prevDateStr] || statusMap[prevDateStr] === 'available';
        return thisBooked && prevAvailable;
    };

    const isDatePast = (date: Date): boolean => {
        return isBefore(date, today);
    };

    // Find the next unavailable date that would block checkout selection
    const getNextUnavailableDate = (startDate: Date): Date | null => {
        // Find the next date that's the START of a booking (checkin day)
        // because that's where the guest can check out (on that day, since
        // the other guest checks in later)
        const sortedDates = Object.keys(statusMap)
            .sort()
            .map(d => new Date(d + 'T00:00:00'))
            .filter(d => isAfter(d, startDate) && isDateFullyBooked(d));

        if (sortedDates.length === 0) return null;

        // The first booked date after check-in is the barrier
        // But the user CAN check out on this date (same-day checkout/checkin allowed)
        return sortedDates[0];
    };

    const isDateDisabled = (date: Date): boolean => {
        if (isDatePast(date)) return true;

        const fullyBooked = isDateFullyBooked(date);

        // Selecting CHECK-OUT date
        if (checkIn && !checkOut) {
            // Can't go before check-in
            if (isBefore(date, checkIn)) return true;
            // Same as check-in = cancel
            if (isSameDay(date, checkIn)) return false;

            // If this date is booked, it's not a valid checkout
            if (fullyBooked) return true;

            const nextUnavailable = getNextUnavailableDate(checkIn);

            if (nextUnavailable) {
                // Block anything ON or AFTER the next booked date
                // (The checkout day is the day BEFORE the next booking starts,
                // or the booked date itself is not valid for checkout)
                if (isSameDay(date, nextUnavailable) || isAfter(date, nextUnavailable)) return true;
            }

            // Available dates between check-in and barrier are all valid
            return false;
        }

        // Selecting CHECK-IN date: booked dates are always disabled
        if (fullyBooked) return true;

        return false;
    };

    const handleDateClick = (date: Date) => {
        setFeedback(null);

        if (isDateDisabled(date)) {
            if (isDateFullyBooked(date)) {
                setFeedback({
                    date: date.toISOString(),
                    message: "This date is booked"
                });
                setTimeout(() => setFeedback(null), 2000);
            }
            return;
        }

        if (!checkIn || (checkIn && checkOut)) {
            // Starting a new selection
            if (isDateFullyBooked(date) && !isCheckoutDay(date)) return;

            setCheckIn(date);
            setCheckOut(null);
            onDateSelect?.(date, null as any);
        } else {
            // Selecting check-out
            if (isSameDay(date, checkIn)) {
                // Same day — clear selection
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
            classes.push('calendar-day-disabled');
            if (isDateFullyBooked(date)) classes.push('calendar-day-booked');
            return classes.join(' ');
        }

        if (isSameDay(date, today)) {
            classes.push('calendar-day-today');
        }

        if (checkIn && isSameDay(date, checkIn)) {
            classes.push('calendar-day-selected');
            classes.push('calendar-day-start');
        } else if (checkOut && isSameDay(date, checkOut)) {
            classes.push('calendar-day-selected');
            classes.push('calendar-day-end');
        } else if (isInRange(date)) {
            classes.push('calendar-day-in-range');
        } else if (isDateFullyBooked(date) && isCheckoutDay(date)) {
            // Checkout day — available for new checkin, show with special style
            classes.push('calendar-day-checkout-only');
        } else if (isDateFullyBooked(date)) {
            classes.push('calendar-day-booked');
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
            <div className="grid grid-cols-7 gap-1.5 mb-2">
                {DAYS.map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-400 py-2">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1.5">
                {/* Padding */}
                {Array.from({ length: startPadding }).map((_, i) => (
                    <div key={`pad-${i}`} className="calendar-day min-h-[40px]" />
                ))}

                {days.map((day) => {
                    const disabled = isDateDisabled(day);
                    const booked = isDateFullyBooked(day);
                    const checkoutDay = isCheckoutDay(day);

                    // Allow clicking checkout days even if booked (they're valid for check-in)
                    const isButtonDisabled = disabled && !(booked && checkoutDay);

                    let title = format(day, 'MMM d, yyyy');
                    if (booked && checkoutDay && !disabled) {
                        title = 'Available for check-in (same-day transition)';
                    } else if (booked) {
                        title = 'Booked';
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
