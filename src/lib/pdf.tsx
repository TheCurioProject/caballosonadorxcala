import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/components/pdf/InvoicePDF';
import { TourInvoicePDF } from '@/components/pdf/TourInvoicePDF';
import React from 'react';

export async function generateInvoicePDFBuffer(props: any): Promise<Buffer> {
  return await renderToBuffer(<InvoicePDF {...props} /> as any);
}

export async function generateTourInvoicePDFBuffer(props: any): Promise<Buffer> {
  return await renderToBuffer(<TourInvoicePDF {...props} /> as any);
}
