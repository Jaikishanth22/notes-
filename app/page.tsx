import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWT } from '../server/auth-utils';
import { db, notes, shareLinks } from '../db';
import { eq, desc } from 'drizzle-orm';
import { FileText, Plus, LogOut, Share2, Lock, Clock, Eye } from 'lucide-react';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  return verifyJWT(token);
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // Fetch notes for the user, and include details about shareLinks
  const userNotes = await db
    .select({
      id: notes.id,
      title: notes.title,
      createdAt: notes.createdAt,
      shareType: shareLinks.shareType,
      accessType: shareLinks.accessType,
      viewCount: shareLinks.viewCount,
      isRevoked: shareLinks.isRevoked,
      expiresAt: shareLinks.expiresAt,
    })
    .from(notes)
    .leftJoin(shareLinks, eq(notes.id, shareLinks.noteId))
    .where(eq(notes.userId, session.userId))
    .orderBy(desc(notes.createdAt));

  return (
    <div className="flex-1 bg-zinc-950 flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-bold tracking-tight text-white text-lg">VaultShare</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400 hidden sm:inline">{session.email}</span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-all cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Notes</h1>
            <p className="text-zinc-400 text-sm mt-1">Manage your secure notes and temporary share links.</p>
          </div>
          <Link
            href="/notes/new"
            className="flex items-center gap-2 bg-white text-zinc-950 font-semibold px-4 py-2.5 rounded-xl shadow-lg hover:bg-zinc-200 transition-all text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Note</span>
          </Link>
        </div>

        {userNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl p-16 text-center bg-zinc-900/10">
            <FileText className="h-12 w-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-semibold text-white">No notes found</h3>
            <p className="text-zinc-500 text-sm mt-1 max-w-sm">
              Create a secure note to share with temporary access codes or self-destruct mechanism.
            </p>
            <Link
              href="/notes/new"
              className="mt-5 inline-flex items-center gap-2 bg-zinc-900 text-white border border-zinc-800 font-medium px-4 py-2 rounded-xl hover:bg-zinc-800 transition-all text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Create your first note</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userNotes.map((note) => {
              const isExpired = note.expiresAt ? new Date() > note.expiresAt : false;
              const isUsedOneTime = note.shareType === 'ONE_TIME' && (note.isRevoked || (note.viewCount ?? 0) >= 1);
              const isActive = !note.isRevoked && !isExpired && !isUsedOneTime;

              let statusText = 'Active';
              let statusColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30';
              if (note.isRevoked) {
                statusText = 'Revoked';
                statusColor = 'text-red-400 bg-red-950/40 border-red-900/30';
              } else if (isExpired) {
                statusText = 'Expired';
                statusColor = 'text-amber-400 bg-amber-950/40 border-amber-900/30';
              } else if (isUsedOneTime) {
                statusText = 'Used (One-Time)';
                statusColor = 'text-purple-400 bg-purple-950/40 border-purple-900/30';
              }

              return (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="glass flex flex-col justify-between p-6 rounded-2xl border border-zinc-800 hover:border-zinc-700 hover:scale-[1.01] transition-all group duration-200"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wider uppercase ${statusColor}`}>
                        {statusText}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-white group-hover:text-zinc-200 line-clamp-1 transition-colors">
                      {note.title}
                    </h2>
                  </div>

                  <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      {note.accessType === 'PASSWORD' ? (
                        <Lock className="h-3.5 w-3.5 text-zinc-500" />
                      ) : (
                        <Share2 className="h-3.5 w-3.5 text-zinc-500" />
                      )}
                      <span>{note.accessType === 'PASSWORD' ? 'Password' : 'Public'}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{note.shareType === 'ONE_TIME' ? '1-Time' : 'Timed'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{note.viewCount} views</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
