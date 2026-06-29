'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Link2, Copy, Check, ShieldAlert, Lock, Eye, Clock, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export default function NewNotePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [shareType, setShareType] = useState<'ONE_TIME' | 'TIME_BASED'>('ONE_TIME');
  const [accessType, setAccessType] = useState<'PUBLIC' | 'PASSWORD'>('PUBLIC');
  const [expiresAt, setExpiresAt] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expiry custom picker state
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number>(12);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());

  const pickerRef = React.useRef<HTMLDivElement>(null);

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Auto-initialize picker to tomorrow when TIME_BASED is selected
  React.useEffect(() => {
    if (shareType === 'TIME_BASED' && !expiresAt) {
      const d = new Date();
      d.setHours(d.getHours() + 24);
      d.setMinutes(0);
      d.setSeconds(0);
      d.setMilliseconds(0);
      
      setExpiresAt(d.toISOString());
      updatePickerStates(d);
    }
  }, [shareType]);

  // Click outside picker container to close
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  const updatePickerStates = (d: Date) => {
    setSelectedDate(d);
    let hour = d.getHours();
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // 0 becomes 12
    setSelectedHour(hour);
    
    const min = d.getMinutes();
    // Round to nearest 15
    const roundedMin = [0, 15, 30, 45].reduce((prev, curr) => 
      Math.abs(curr - min) < Math.abs(prev - min) ? curr : prev
    );
    setSelectedMinute(roundedMin);
    setSelectedPeriod(period);
    setCalendarMonth(d.getMonth());
    setCalendarYear(d.getFullYear());
  };

  const selectPreset = (hours: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    // Round minutes to nearest 15 for cleanliness
    const min = d.getMinutes();
    const roundedMin = Math.round(min / 15) * 15;
    d.setMinutes(roundedMin);
    d.setSeconds(0);
    d.setMilliseconds(0);
    
    setExpiresAt(d.toISOString());
    updatePickerStates(d);
    setShowPicker(false);
  };

  const handleDateSelect = (day: number) => {
    const d = new Date(calendarYear, calendarMonth, day);
    setSelectedDate(d);
  };

  const prevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const applyCustomDateTime = () => {
    if (!selectedDate) return;
    
    const d = new Date(selectedDate);
    let hr = selectedHour;
    if (selectedPeriod === 'PM' && hr < 12) hr += 12;
    if (selectedPeriod === 'AM' && hr === 12) hr = 0;
    
    d.setHours(hr);
    d.setMinutes(selectedMinute);
    d.setSeconds(0);
    d.setMilliseconds(0);
    
    setExpiresAt(d.toISOString());
    setShowPicker(false);
  };

  const formatDateLabel = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Select date and time...';
      
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      return d.toLocaleString('en-US', options);
    } catch (e) {
      return 'Select date and time...';
    }
  };

  const formatSelectedPreview = () => {
    if (!selectedDate) return 'No date selected';
    const monthStr = MONTHS[selectedDate.getMonth()].slice(0, 3);
    const day = selectedDate.getDate();
    const year = selectedDate.getFullYear();
    const timeStr = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')} ${selectedPeriod}`;
    return `${monthStr} ${day}, ${year} ${timeStr}`;
  };

  const renderDays = () => {
    const days = [];
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`pad-${i}`} className="h-8 w-8" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(calendarYear, calendarMonth, day, 23, 59, 59);
      const isPast = dateObj < today;
      const isSelected = selectedDate && 
        selectedDate.getDate() === day && 
        selectedDate.getMonth() === calendarMonth && 
        selectedDate.getFullYear() === calendarYear;
        
      const isToday = today.getDate() === day && 
        today.getMonth() === calendarMonth && 
        today.getFullYear() === calendarYear;

      days.push(
        <button
          type="button"
          key={day}
          disabled={isPast}
          onClick={() => handleDateSelect(day)}
          className={`h-8 w-8 text-xs rounded-lg transition-all flex items-center justify-center cursor-pointer ${
            isPast 
              ? 'text-zinc-700 cursor-not-allowed'
              : isSelected
                ? 'bg-white text-zinc-950 font-bold shadow-md'
                : isToday
                  ? 'border border-zinc-500 text-white font-semibold'
                  : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
          }`}
        >
          {day}
        </button>
      );
    }
    return days;
  };

  // Modal response state
  const [showModal, setShowModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [plaintextKey, setPlaintextKey] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Date validation
    let expiryVal = null;
    if (shareType === 'TIME_BASED') {
      if (!expiresAt) {
        setError('Please set an expiration date for Time-Based sharing.');
        setLoading(false);
        return;
      }
      expiryVal = new Date(expiresAt).toISOString();
    }

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          shareType,
          accessType,
          expiresAt: expiryVal,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create note');
      }

      // Construct shared link URL
      const shareUrl = `${window.location.origin}/share/${data.token}`;
      setGeneratedLink(shareUrl);
      setPlaintextKey(data.plaintextKey);
      setShowModal(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the note.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, isLink: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      }
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  return (
    <div className="flex-1 bg-zinc-950 min-h-screen py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Notes
        </Link>

        <h1 className="text-3xl font-extrabold text-white tracking-tight gradient-text mb-8">
          Create Secure Note
        </h1>

        <div className="glass rounded-2xl border border-zinc-800 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-zinc-300">
                Title
              </label>
              <input
                type="text"
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 block w-full rounded-xl border-0 py-3 px-4 text-white bg-zinc-900/60 ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-inset focus:ring-zinc-600 sm:text-sm focus:outline-none transition-all"
                placeholder="Enter note title..."
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-semibold text-zinc-300">
                Content
              </label>
              <textarea
                id="content"
                required
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-2 block w-full rounded-xl border-0 py-3 px-4 text-white bg-zinc-900/60 ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-inset focus:ring-zinc-600 sm:text-sm focus:outline-none transition-all resize-none"
                placeholder="Write your secure content here..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Share Type */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-zinc-300">Share Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShareType('ONE_TIME')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                      shareType === 'ONE_TIME'
                        ? 'bg-white text-zinc-950 border-white'
                        : 'bg-zinc-900/40 text-zinc-400 border-zinc-850 hover:bg-zinc-900/80'
                    }`}
                  >
                    <Eye className="h-4 w-4" />
                    One-Time Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareType('TIME_BASED')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                      shareType === 'TIME_BASED'
                        ? 'bg-white text-zinc-950 border-white'
                        : 'bg-zinc-900/40 text-zinc-400 border-zinc-850 hover:bg-zinc-900/80'
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                    Time-Based Expiry
                  </button>
                </div>
              </div>

              {/* Access Type */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-zinc-300">Access Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAccessType('PUBLIC')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                      accessType === 'PUBLIC'
                        ? 'bg-white text-zinc-950 border-white'
                        : 'bg-zinc-900/40 text-zinc-400 border-zinc-850 hover:bg-zinc-900/80'
                    }`}
                  >
                    <Link2 className="h-4 w-4" />
                    Public Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessType('PASSWORD')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                      accessType === 'PASSWORD'
                        ? 'bg-white text-zinc-950 border-white'
                        : 'bg-zinc-900/40 text-zinc-400 border-zinc-850 hover:bg-zinc-900/80'
                    }`}
                  >
                    <Lock className="h-4 w-4" />
                    Password Lock
                  </button>
                </div>
              </div>
            </div>

            {/* Expiry Datetime Picker (Only if TIME_BASED is selected) */}
            {shareType === 'TIME_BASED' && (
              <div className="space-y-2 relative" ref={pickerRef}>
                <div className="flex items-center justify-between">
                  <label htmlFor="expiresAt" className="block text-sm font-semibold text-zinc-300">
                    Expiration Date & Time
                  </label>
                  
                  {/* Preset Shortcuts */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: '+1h', value: 1 },
                      { label: '+6h', value: 6 },
                      { label: '+1d', value: 24 },
                      { label: '+3d', value: 72 },
                      { label: '+7d', value: 168 },
                    ].map((p) => (
                      <button
                        type="button"
                        key={p.label}
                        onClick={() => selectPreset(p.value)}
                        className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[10px] font-semibold text-zinc-400 hover:text-white transition-all cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  id="expiresAt"
                  onClick={() => setShowPicker(!showPicker)}
                  className="mt-2 flex w-full items-center justify-between rounded-xl border-0 py-3 px-4 text-white bg-zinc-900/60 ring-1 ring-inset ring-zinc-800 focus:ring-2 focus:ring-inset focus:ring-zinc-600 sm:text-sm focus:outline-none transition-all hover:bg-zinc-900/80 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                    {expiresAt ? formatDateLabel(expiresAt) : 'Select date and time...'}
                  </span>
                  <Clock className="h-4 w-4 text-zinc-400" />
                </button>

                {showPicker && (
                  <div className="absolute left-0 right-0 sm:right-auto mt-2 z-50 w-full sm:w-[480px] bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl p-4 sm:p-5 text-white flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row gap-5">
                      {/* Calendar Side */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <button
                            type="button"
                            onClick={prevMonth}
                            className="p-1 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-sm font-semibold select-none">
                            {MONTHS[calendarMonth]} {calendarYear}
                          </span>
                          <button
                            type="button"
                            onClick={nextMonth}
                            className="p-1 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* Days of Week */}
                        <div className="grid grid-cols-7 text-center text-xs font-semibold text-zinc-500 mb-1.5 select-none">
                          <span>Su</span>
                          <span>Mo</span>
                          <span>Tu</span>
                          <span>We</span>
                          <span>Th</span>
                          <span>Fr</span>
                          <span>Sa</span>
                        </div>
                        
                        {/* Days grid */}
                        <div className="grid grid-cols-7 gap-1 text-center text-sm">
                          {renderDays()}
                        </div>
                      </div>
                      
                      {/* Divider */}
                      <div className="hidden sm:block w-[1px] bg-zinc-800 self-stretch" />
                      
                      {/* Clock Side */}
                      <div className="w-full sm:w-[160px] flex flex-col justify-between">
                        <div>
                          <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 select-none">
                            Select Time
                          </span>
                          
                          {/* Hours */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 block mb-1 select-none">Hour</span>
                            <div className="grid grid-cols-4 gap-1">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                                <button
                                  type="button"
                                  key={h}
                                  onClick={() => setSelectedHour(h)}
                                  className={`py-1 text-xs rounded-lg transition-all cursor-pointer ${
                                    selectedHour === h
                                      ? 'bg-white text-zinc-950 font-bold'
                                      : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300'
                                  }`}
                                >
                                  {h}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Minutes */}
                          <div className="space-y-1 mt-3.5">
                            <span className="text-[10px] text-zinc-500 block mb-1 select-none">Minute</span>
                            <div className="grid grid-cols-4 gap-1">
                              {[0, 15, 30, 45].map((m) => (
                                <button
                                  type="button"
                                  key={m}
                                  onClick={() => setSelectedMinute(m)}
                                  className={`py-1 text-xs rounded-lg transition-all cursor-pointer ${
                                    selectedMinute === m
                                      ? 'bg-white text-zinc-950 font-bold'
                                      : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300'
                                  }`}
                                >
                                  {m.toString().padStart(2, '0')}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* AM / PM */}
                          <div className="grid grid-cols-2 gap-1.5 mt-3.5">
                            {['AM', 'PM'].map((p) => (
                              <button
                                type="button"
                                key={p}
                                onClick={() => setSelectedPeriod(p as 'AM' | 'PM')}
                                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                  selectedPeriod === p
                                    ? 'bg-white text-zinc-950'
                                    : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Bar */}
                    <div className="flex items-center justify-between border-t border-zinc-900 pt-3 mt-1">
                      <span className="text-xs text-zinc-400 font-mono select-none">
                        {formatSelectedPreview()}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPicker(false);
                            if (expiresAt) {
                              updatePickerStates(new Date(expiresAt));
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-zinc-900 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!selectedDate}
                          onClick={applyCustomDateTime}
                          className="px-3.5 py-1.5 rounded-xl bg-white text-zinc-950 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-950/40 border border-red-900/50 p-3">
                <p className="text-sm text-red-400 font-medium text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="button-glow flex w-full justify-center items-center gap-2 rounded-xl bg-white px-3 py-3.5 text-sm font-bold text-zinc-950 shadow-sm hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Generate Secure Share Link'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Share Link Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
          <div className="glass max-w-lg w-full rounded-2xl border border-zinc-850 p-6 sm:p-8 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white mb-2">Secure Link Generated</h2>
            <p className="text-zinc-400 text-sm mb-6">
              Anyone with this link will be able to unlock the contents of this note, subject to constraints.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Share URL
                </label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 p-2.5">
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="bg-transparent border-0 p-0 text-sm text-white focus:ring-0 w-full focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedLink, true)}
                    className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {plaintextKey && (
                <div className="rounded-xl border border-amber-950/30 bg-amber-950/10 p-4">
                  <div className="flex gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-400">Save access password now!</h4>
                      <p className="text-xs text-amber-500 mt-0.5">
                        This password is cryptographically hashed and is only shown <strong className="text-amber-400">once</strong>. It cannot be recovered.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between rounded-lg bg-zinc-900/80 border border-zinc-800 p-2">
                    <code className="text-sm text-white font-mono pl-2 tracking-widest">{plaintextKey}</code>
                    <button
                      onClick={() => copyToClipboard(plaintextKey, false)}
                      className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-850 transition-colors"
                    >
                      {copiedKey ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  router.push('/');
                }}
                className="bg-white text-zinc-950 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-zinc-200 transition-all cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
