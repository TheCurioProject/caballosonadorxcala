import prisma from '@/lib/prisma';
import * as ical from 'node-ical';
import { revalidatePath } from 'next/cache';

export interface SyncFeedResult {
  sourceId: number;
  sourceName: string;
  success: boolean;
  eventsCount?: number;
  blocksAdded?: number;
  error?: string;
}

export interface SyncAllResult {
  success: boolean;
  totalSources: number;
  successCount: number;
  errorCount: number;
  totalBlocks: number;
  results: SyncFeedResult[];
}

/**
 * Descarga y parsea un feed iCal con headers reales y control de timeouts.
 * Valida expresamente que la respuesta NO sea HTML (Cloudflare, Captcha, 403, 404)
 * antes de intentar parsearlo.
 */
export async function fetchAndValidateIcal(url: string): Promise<Record<string, any>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/calendar, text/plain, */*',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Remote server responded with HTTP ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    clearTimeout(timeoutId);
    const trimmed = text.trim();

    // Strict detection of HTML responses (Cloudflare / Captchas / Error pages)
    if (
      trimmed.toLowerCase().startsWith('<!doctype html') ||
      trimmed.toLowerCase().startsWith('<html') ||
      trimmed.includes('<body') ||
      !trimmed.includes('BEGIN:VCALENDAR')
    ) {
      throw new Error('The feed returned an HTML page instead of an iCal (.ics) calendar. Verify the export URL and external platform permissions.');
    }

    const events = ical.parseICS(text);
    return events;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out (20s) while reaching the external calendar server');
    }
    throw error;
  }
}

/**
 * Sincroniza una fuente individual de iCal.
 * Si la descarga o parseo falla, NO borra los bloqueos existentes en base de datos
 * para evitar abrir fechas bloqueadas por accidente (prevención de sobreventas).
 */
export async function syncSingleIcalSource(source: {
  id: number;
  propertyId: number;
  name: string;
  url: string;
}): Promise<SyncFeedResult> {
  try {
    if (!source.url) {
      throw new Error('iCal source URL is not configured');
    }

    const events = await fetchAndValidateIcal(source.url);

    const newBlocks: {
      propertyId: number;
      startDate: Date;
      endDate: Date;
      reason: string;
      source: string;
    }[] = [];

    for (const key in events) {
      const ev = events[key];
      if (ev && ev.type === 'VEVENT') {
        if(String(ev.uid||'').endsWith('@cala.local')||String(ev.uid||'').endsWith('@casacaballosonador.com')||ev.status==='CANCELLED')continue;
        if(ev.rrule)throw new Error('Recurring calendars need explicit occurrence dates. Previous blocks were preserved.');
        const start = new Date(ev.start as Date);
        const end = new Date(ev.end as Date);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end<=start)throw new Error('Invalid calendar interval. Previous blocks were preserved.');

        const summaryText = typeof ev.summary === 'string'
          ? ev.summary
          : (ev.summary?.val || `${source.name} (Reserva Externa)`);

        if (end > start && ev.status !== 'CANCELLED') {
          newBlocks.push({
            propertyId: source.propertyId,
            startDate: start,
            endDate: end,
            reason: summaryText,
            source: `ical-${source.id}`
          });
        }
      }
    }

    // Usar transacción atómica: borrar anteriores e insertar los nuevos sólo tras parsear con éxito
    await prisma.$transaction(async (tx) => {
      await tx.blockedDate.deleteMany({
        where: {
          propertyId: source.propertyId,
          source: `ical-${source.id}`
        }
      });

      if (newBlocks.length > 0) {
        await tx.blockedDate.createMany({
          data: newBlocks
        });
      }

      await tx.icalSource.update({
        where: { id: source.id },
        data: {
          syncStatus: 'success',
          lastSync: new Date(),
          syncError: null
        }
      });
    });

    return {
      sourceId: source.id,
      sourceName: source.name,
      success: true,
      eventsCount: Object.keys(events).length,
      blocksAdded: newBlocks.length
    };
  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown error while syncing feed';
    console.error(`[iCal Sync] Error en fuente #${source.id} (${source.name}):`, errorMsg);

    // Registrar el error en la base de datos sin borrar las fechas bloqueadas previas
    try {
      await prisma.icalSource.update({
        where: { id: source.id },
        data: {
          syncStatus: 'error',
          syncError: errorMsg
        }
      });
    } catch (dbErr) {
      console.error('[iCal Sync] No se pudo actualizar estado de error en DB:', dbErr);
    }

    return {
      sourceId: source.id,
      sourceName: source.name,
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Sincroniza todas las fuentes iCal registradas (o filtradas por propertyId)
 */
export async function syncAllIcalFeeds(targetPropertyId?: number): Promise<SyncAllResult> {
  const whereClause = targetPropertyId ? { propertyId: targetPropertyId } : {};
  const sources = await prisma.icalSource.findMany({
    where: whereClause
  });

  const results: SyncFeedResult[] = [];
  let totalBlocks = 0;

  for (const source of sources) {
    const res = await syncSingleIcalSource(source);
    results.push(res);
    if (res.success && res.blocksAdded) {
      totalBlocks += res.blocksAdded;
    }
  }

  // Revalidar caches del panel de administración
  try {
    revalidatePath('/admin/calendar');
    revalidatePath('/admin/ical');
  } catch (e) {
    // Si se corre fuera de contexto de request Next.js (cron script) se ignora
  }

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  return {
    success: errorCount === 0,
    totalSources: sources.length,
    successCount,
    errorCount,
    totalBlocks,
    results
  };
}
