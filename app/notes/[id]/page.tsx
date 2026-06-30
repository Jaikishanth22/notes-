'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Link2, Copy, Check, Clock, Eye, Trash2, Calendar, FileText } from 'lucide-react';

interface NoteData {
  note: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
  };
  shareLink: {
    token: string;
    shareType: 'ONE_TIME' | 'TIME_BASED';
    accessType: 'PUBLIC' | 'PASSWORD';
    expiresAt: string | null;
    isRevoked: boolean;
    viewCount: number;
  } | null;
}

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NoteData | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchNoteDetails = async () => {
    try {
      const res = await fetch(`/api/notes/${id}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to load note');
      }
      setData(body);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNoteDetails();
  }, [id]);

  const handleRevoke = async () => {
    if (!data?.shareLink) return;
    if (!confirm('Are you sure you want to revoke this link? Anyone with access will lose it immediately.')) {
      return;
    }

    setRevoking(true);
    try {
      const res = await fetch(`/api/share/${data.shareLink.token}/revoke`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to revoke link');
      }
      
      // Reload details
      await fetchNoteDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke link');
    } finally {
      setRevoking(false);
    }
  };

  const copyLink = async () => {
    if (!data?.shareLink) return;
    const shareUrl = `${window.location.origin}/share/${data.shareLink.token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-zinc-950 flex flex-col justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 bg-zinc-950 flex flex-col justify-center items-center min-h-screen p-4">
        <div className="glass max-w-md w-full rounded-2xl border border-zinc-800 p-6 text-center">
          <h2 className="text-xl font-bold text-red-400">Error Loading Note</h2>
          <p className="text-zinc-400 text-sm mt-2">{error || 'Note not found'}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 bg-white text-zinc-950 font-semibold px-4 py-2 rounded-xl text-sm"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { note, shareLink } = data;
  const shareUrl = shareLink ? `${window.location.origin}/share/${shareLink.token}` : '';

  // Calculate link status
  const isExpired = shareLink?.expiresAt ? new Date() > new Date(shareLink.expiresAt) : false;
  const isOneTimeUsed = shareLink?.shareType === 'ONE_TIME' && (shareLink.isRevoked || shareLink.viewCount >= 1);
  const isRevoked = shareLink?.isRevoked ?? false;

  let statusText = 'Active';
  let statusColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30';

  if (isRevoked) {
    statusText = 'Revoked';
    statusColor = 'text-red-400 bg-red-950/40 border-red-900/30';
  } else if (isExpired) {
    statusText = 'Expired';
    statusColor = 'text-amber-400 bg-amber-950/40 border-amber-900/30';
  } else if (isOneTimeUsed) {
    statusText = 'Used (One-Time)';
    statusColor = 'text-purple-400 bg-purple-950/40 border-purple-900/30';
  }

  return (
    <div className="flex-1 bg-zinc-950 min-h-screen py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Note content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-2xl border border-zinc-800 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-zinc-500 text-xs mb-3">
                <FileText className="h-4 w-4" />
                <span>Note</span>
                <span>•</span>
                <span>{new Date(note.createdAt).toLocaleString()}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-6">
                {note.title}
              </h1>
              <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                {note.content}
              </p>
            </div>
          </div>

          {/* Note Link Controls */}
          <div className="space-y-6">
            <div className="glass rounded-2xl border border-zinc-800 p-6">
              <h3 className="text-base font-bold text-white mb-4">Share Link Status</h3>
              
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Status</span>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase ${statusColor}`}>
                    {statusText}
                  </span>
                </div>

                {shareLink && (
                  <>
                    {/* View Count */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" /> View Count
                      </span>
                      <span className="text-sm font-semibold text-white">{shareLink.viewCount}</span>
                    </div>

                    {/* Share Type */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Share Type
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {shareLink.shareType === 'ONE_TIME' ? 'One-Time Link' : 'Time-Based Expiry'}
                      </span>
                    </div>

                    {/* Expiration date */}
                    {shareLink.expiresAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" /> Expires At
                        </span>
                        <span className="text-xs font-semibold text-white">
                          {new Date(shareLink.expiresAt).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Access protection */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Access Protection</span>
                      <span className="text-sm font-semibold text-white">
                        {shareLink.accessType === 'PASSWORD' ? 'Password Lock' : 'Public Link'}
                      </span>
                    </div>

                    {/* Quick Link Copy (If active) */}
                    {!isRevoked && !isExpired && !isOneTimeUsed && (
                      <div className="pt-2">
                        <button
                          onClick={copyLink}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied Link
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" /> Copy Share Link
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Revocation Controls */}
                    {!isRevoked && (
                      <div className="pt-4 border-t border-zinc-900">
                        <button
                          onClick={handleRevoke}
                          disabled={revoking}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 px-3 py-2.5 text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer"
                        >
                          {revoking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-3.5 w-3.5" /> Revoke Share Link
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
