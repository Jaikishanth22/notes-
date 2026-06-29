'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { KeyRound, ShieldAlert, Loader2, FileText, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

interface LinkMetadata {
  accessType: 'PUBLIC' | 'PASSWORD';
  shareType: 'ONE_TIME' | 'TIME_BASED';
  expiresAt: string | null;
  isRevoked: boolean;
  viewCount: number;
  isValid: boolean;
  lockedUntil: string | null;
  failedAttempts: number;
}

interface NoteData {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export default function ShareLandingPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<LinkMetadata | null>(null);
  const [note, setNote] = useState<NoteData | null>(null);

  // Password submission state
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Fetch metadata on mount
  const fetchMetadata = async () => {
    try {
      const res = await fetch(`/api/share/${token}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to fetch link details');
      }
      setMeta(body);

      // If PUBLIC and VALID, unlock right away
      if (body.isValid && body.accessType === 'PUBLIC') {
        await handleUnlock();
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [token]);

  const handleUnlock = async (submittedPassword?: string) => {
    setUnlocking(true);
    setPasswordError(null);
    try {
      const res = await fetch(`/api/share/${token}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: submittedPassword }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to unlock note');
      }

      setNote(body.note);
    } catch (err: any) {
      if (submittedPassword) {
        setPasswordError(err.message || 'Invalid password');
      } else {
        setError(err.message || 'Failed to unlock note');
      }
    } finally {
      setUnlocking(false);
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setPasswordError('Please enter the password');
      return;
    }
    handleUnlock(password);
  };

  if (loading) {
    return (
      <div className="flex-1 bg-zinc-950 flex flex-col justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  // Compute descriptive error details
  let errorTitle = 'Link Expired or Revoked';
  let errorMessage = error || 'This link has expired, been revoked, or the one-time access has already been consumed.';

  if (meta && !meta.isValid) {
    const isExpired = meta.expiresAt ? new Date() > new Date(meta.expiresAt) : false;
    const isOneTimeUsed = meta.shareType === 'ONE_TIME' && (meta.isRevoked || meta.viewCount >= 1);
    const isLocked = meta.lockedUntil ? new Date() < new Date(meta.lockedUntil) : false;

    if (isLocked) {
      errorTitle = 'Link Temporarily Locked';
      const minutesLeft = meta.lockedUntil ? Math.ceil((new Date(meta.lockedUntil).getTime() - Date.now()) / 60000) : 15;
      errorMessage = `This share link is temporarily locked due to too many failed password attempts. Please try again in ${minutesLeft} minute(s).`;
    } else if (isOneTimeUsed) {
      errorTitle = 'Link Already Used';
      errorMessage = 'This one-time share link has already been used and is now permanently destroyed.';
    } else if (meta.isRevoked) {
      errorTitle = 'Link Revoked';
      errorMessage = 'This share link has been revoked by the owner.';
    } else if (isExpired) {
      errorTitle = 'Link Expired';
      errorMessage = 'This share link has expired and is no longer available.';
    } else {
      errorTitle = 'Link Invalid';
      errorMessage = 'This share link is invalid or no longer available.';
    }
  } else if (error === 'Share link not found') {
    errorTitle = 'Link Not Found';
    errorMessage = 'This share link does not exist or is invalid.';
  }

  // Handle case where metadata failed or token is completely invalid (revoked / expired / one-time-used / locked)
  if (error || (meta && !meta.isValid)) {
    return (
      <div className="flex-1 bg-zinc-950 flex flex-col justify-center items-center min-h-screen p-4">
        <div className="glass max-w-md w-full rounded-2xl border border-red-900/30 bg-red-950/5 p-6 text-center">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">{errorTitle}</h2>
          <p className="text-zinc-400 text-sm mt-3">
            {errorMessage}
          </p>
          <div className="mt-6 pt-4 border-t border-zinc-900 flex justify-center gap-1.5 text-xs text-zinc-500">
            <span>Secure note delivery by aass notes</span>
          </div>
        </div>
      </div>
    );
  }

  // Handle Note fully unlocked and ready to display
  if (note) {
    return (
      <div className="flex-1 bg-zinc-950 min-h-screen py-16 flex flex-col justify-center px-4">
        <div className="max-w-2xl mx-auto w-full">
          {meta?.shareType === 'ONE_TIME' && (
            <div className="mb-6 rounded-xl border border-purple-950 bg-purple-950/20 p-4 flex gap-3 text-purple-400">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">One-time share link destroyed</h4>
                <p className="text-xs text-purple-300 mt-0.5">
                  This note was configured as a one-time view. Closing this window or refreshing the page will permanently delete access.
                </p>
              </div>
            </div>
          )}

          <div className="glass rounded-2xl border border-zinc-800 p-6 sm:p-8">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-3">
              <FileText className="h-4 w-4" />
              <span>Decrypted Content</span>
              <span>•</span>
              <span>Unlocked</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-6">
              {note.title}
            </h1>

            <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed text-sm sm:text-base border-t border-zinc-900 pt-6">
              {note.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle password entry page
  if (meta && meta.accessType === 'PASSWORD') {
    return (
      <div className="flex-1 bg-zinc-950 flex flex-col justify-center items-center min-h-screen p-4">
        <div className="glass max-w-md w-full rounded-2xl border border-zinc-800 p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-300">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-white mt-4">Password Required</h2>
            <p className="text-zinc-400 text-sm mt-1">
              This shared note is encrypted. Please enter the password to decrypt it.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter decryption password"
                className="block w-full rounded-xl border-0 py-3 px-4 text-white bg-zinc-900/60 ring-1 ring-inset ring-zinc-800 focus:ring-2 focus:ring-inset focus:ring-zinc-600 sm:text-sm focus:outline-none transition-all text-center tracking-widest placeholder:tracking-normal"
              />
            </div>

            {passwordError && (
              <p className="text-xs text-red-400 text-center font-medium bg-red-950/20 py-2 rounded-lg border border-red-900/30">
                {passwordError}
              </p>
            )}

            <button
              type="submit"
              disabled={unlocking}
              className="button-glow flex w-full justify-center items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-bold text-zinc-950 shadow-sm hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {unlocking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Decrypt Note'
              )}
            </button>
          </form>

          {meta.shareType === 'ONE_TIME' && (
            <p className="text-[10px] text-zinc-500 text-center mt-6">
              ⚠️ Warning: This is a ONE-TIME access link. Successful decryption consumes the link permanently.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Fallback (e.g. if public, waiting for decrypt redirect to trigger)
  return (
    <div className="flex-1 bg-zinc-950 flex flex-col justify-center items-center min-h-screen">
      <Loader2 className="h-8 w-8 text-zinc-500 animate-spin" />
    </div>
  );
}
