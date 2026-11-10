'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useDictionary } from '@/i18n/DictionaryContext';
import { useScrollLock } from '@/hooks/useScrollLock';
import { SmoobuBookingWidget } from './SmoobuBookingWidget';

export function SmoobuBookingModal({ isOpen, onClose, smoobuOpenVersion = 0 }: {
  isOpen: boolean;
  onClose: () => void;
  smoobuOpenVersion?: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dict = useDictionary();
  const isEn = dict.nav?.rooms === 'Rooms';

  useScrollLock(isOpen);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto overscroll-contain rounded-3xl border-0 bg-[#F9F7F4] p-0 text-[#23211F] shadow-2xl backdrop:bg-[#23211F]/60 backdrop:backdrop-blur-sm sm:max-h-[90dvh] sm:w-[calc(100%-3rem)]"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div>
        <header className="sticky top-0 z-10 border-b border-[#9B7E67]/15 bg-[#F9F7F4] px-6 py-6 pr-16 sm:px-10 sm:py-8 sm:pr-20">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#9B7E67]">
            {dict.modal?.hotelName || 'Casa Caballo Soñador'}
          </p>
          <h2 id={titleId} className="font-serif text-2xl sm:text-3xl">
            {isEn ? 'Book your stay' : 'Reserva tu estancia'}
          </h2>
          <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-gray-500">
            {isEn
              ? 'Choose your dates and number of guests to check availability and book your stay.'
              : 'Elige tus fechas y el número de huéspedes para consultar disponibilidad y reservar tu estancia.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close reservations' : 'Cerrar reservas'}
            className="absolute right-4 top-5 flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-[#9B7E67]/10 hover:text-[#23211F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B7E67] sm:right-6 sm:top-7"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="p-2 sm:p-6">
          {isOpen && (
            <SmoobuBookingWidget key={smoobuOpenVersion} isEn={isEn} standalone />
          )}
        </div>
      </div>
    </dialog>
  );
}
