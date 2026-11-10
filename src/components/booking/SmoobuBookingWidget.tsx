'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { ExternalLink, LoaderCircle } from 'lucide-react';

const SMOOBU_BASE_URL = 'https://login.smoobu.com';
const APARTMENT_GROUPS = ['3577956', '3577971', '3577976', '3577981', '3577986', '3577991', '3577996'];
const SMOOBU_ENDPOINT = `${SMOOBU_BASE_URL}/en/booking-tool/iframe/1939851?${APARTMENT_GROUPS.map((id) => `apartmentGroups[]=${id}`).join('&')}`;
const SMOOBU_BOOKING_URL = `https://booking.smoobu.com/9A1939851?${APARTMENT_GROUPS.map((id) => `apartmentGroups=${id}`).join('&')}`;

type ResizableIframe = HTMLIFrameElement & {
  iFrameResizer?: { close: () => void };
};

type SmoobuWindow = Window & {
  iFrameResize?: (
    options: {
      heightCalculationMethod: string;
      tolerance: number;
      waitForLoad: boolean;
      checkOrigin: string[];
    },
    iframe: HTMLIFrameElement,
  ) => void;
};

export function SmoobuBookingWidget({ isEn, standalone = false }: { isEn: boolean; standalone?: boolean }) {
  const iframeHostRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<ResizableIframe>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [resizerReady, setResizerReady] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    const refreshToken = crypto.randomUUID();
    const endpoint = new URL(SMOOBU_ENDPOINT);
    endpoint.searchParams.set('_smoobu_refresh', refreshToken);

    async function loadBookingTool() {
      try {
        // Use the supplied widget endpoint without injecting its HTML or global jQuery.
        // Aborting on unmount also prevents late responses from affecting a reopened modal.
        const response = await fetch(endpoint.href, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Smoobu request failed');

        const data: { success?: boolean; html?: string } = await response.json();
        if (!data.success || typeof data.html !== 'string') throw new Error('Invalid Smoobu response');

        const document = new DOMParser().parseFromString(data.html, 'text/html');
        const src = document.querySelector('iframe')?.getAttribute('src');
        if (!src) throw new Error('Missing Smoobu iframe');
        const bookingUrl = new URL(src);
        if (bookingUrl.origin !== 'https://booking.smoobu.com') {
          throw new Error('Invalid Smoobu iframe');
        }

        // Refresh the booking page too: its own cache controls the guest selector.
        bookingUrl.searchParams.set('_smoobu_refresh', refreshToken);
        if (!controller.signal.aborted) setIframeUrl(bookingUrl.href);
      } catch {
        if (!controller.signal.aborted) setStatus('error');
      }
    }

    void loadBookingTool();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (status !== 'loading') return;
    const timeout = window.setTimeout(() => setStatus('error'), 30000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!iframeUrl || !iframeHostRef.current) return;

    // The resizer owns/removes its iframe, so keep that DOM outside React reconciliation.
    const iframe: ResizableIframe = document.createElement('iframe');
    iframe.id = 'booking-tool-iFrame-allApartments';
    iframe.src = iframeUrl;
    iframe.title = isEn ? 'Casa Caballo Soñador booking form' : 'Formulario de reservas de Casa Caballo Soñador';
    iframe.allowFullscreen = true;
    iframe.height = '600';
    iframe.className = 'block w-full border-0 bg-white';
    iframe.onload = () => setStatus('ready');
    iframe.onerror = () => setStatus('error');
    iframeHostRef.current.appendChild(iframe);
    iframeRef.current = iframe;

    return () => {
      iframe.onload = null;
      iframe.onerror = null;
      iframe.iFrameResizer?.close();
      iframe.remove();
      iframeRef.current = null;
    };
  }, [iframeUrl, isEn]);

  useEffect(() => {
    const iframe = iframeRef.current;
    const resize = (window as SmoobuWindow).iFrameResize;
    if (!resizerReady || !iframeUrl || !iframe || !resize || iframe.iFrameResizer) return;

    // The same resizer used by BookingToolIframe, with messages restricted to Smoobu.
    resize({
      heightCalculationMethod: 'lowestElement',
      tolerance: 34,
      waitForLoad: true,
      checkOrigin: ['https://booking.smoobu.com', SMOOBU_BASE_URL],
    }, iframe);

  }, [iframeUrl, resizerReady, isEn]);

  return (
    <section
      aria-label={isEn ? 'Reservations' : 'Reservas'}
      className={standalone
        ? 'w-full min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm'
        : 'mt-6 w-full shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:rounded-3xl'}
    >
      {!standalone && <div className="border-b border-gray-100 px-5 py-5 md:px-8 md:py-6">
        <h4 className="font-serif text-xl text-[#23211F] md:text-2xl">
          {isEn ? 'Looking for just a room?' : '¿Buscas solo una habitación?'}
        </h4>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          {isEn
            ? 'Choose your dates below to check availability, find your ideal room and book your stay.'
            : 'Selecciona tus fechas en el formulario de abajo para consultar disponibilidad, elegir tu habitación ideal y reservar tu estancia.'}
        </p>
      </div>}

      <div id="apartmentIframeAll" aria-busy={status === 'loading'} className="w-full min-w-0 p-3 md:p-5">
        {status === 'loading' && (
          <p role="status" className="flex items-center justify-center gap-2 py-8 text-center text-sm text-[#9B7E67]">
            <LoaderCircle size={18} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {isEn ? 'Loading reservations…' : 'Cargando reservas…'}
          </p>
        )}
        {status === 'error' && (
          <p role="status" className="px-2 py-6 text-center text-sm text-gray-500">
            {isEn
              ? 'The booking tool could not be loaded. You can open it using the link below.'
              : 'No se pudo cargar el formulario de reservas. Puedes abrirlo con el enlace de abajo.'}
          </p>
        )}
        <div ref={iframeHostRef} className="w-full min-w-0" />
      </div>

      <div className="border-t border-gray-100 px-5 py-4 text-center md:px-8">
        <a
          href={iframeUrl || SMOOBU_BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-xs font-medium text-[#9B7E67] underline-offset-4 transition-colors hover:text-[#23211F] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9B7E67]"
        >
          {isEn ? 'Open reservations in a new tab' : 'Abrir reservas en una nueva pestaña'}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>

      <Script
        id="smoobu-iframe-resizer"
        src="https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/3.5.16/iframeResizer.min.js"
        strategy="afterInteractive"
        onReady={() => setResizerReady(true)}
      />
    </section>
  );
}
