import React from 'react';

export interface NoteNotificationData {
  dealId?: string;
  note: string;
}

interface NoteNotificationCardProps {
  note: NoteNotificationData;
}

export default function NoteNotificationCard({ note }: NoteNotificationCardProps) {
  return (
    <div className="w-full rounded-[6px] border border-[rgba(125,170,255,0.35)] bg-[#2b323a] px-2.5 py-2 text-[#d7dde8]">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] leading-none text-[#a6b2c4]">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[rgba(125,170,255,0.5)] text-[10px] text-[#8eb4ff]">
          📝
        </span>
        <span>Nota interna do bot</span>
      </div>
      <div className="whitespace-pre-wrap break-words text-[12px] text-[#ecf2ff]">
        {note.note}
      </div>
    </div>
  );
}
