import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FAFAF8',
    padding: 50,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  title: {
    fontSize: 28,
    color: '#1A1A1A',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  invoiceText: {
    fontSize: 24,
    color: '#1A1A1A',
    textAlign: 'right'
  },
  invoiceSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'right'
  },
  section: {
    marginBottom: 40,
  },
  heading: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12
  },
  label: {
    fontSize: 12,
    color: '#4B5563',
  },
  value: {
    fontSize: 12,
    color: '#1A1A1A',
  },
  billToName: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 4
  },
  billToEmail: {
    fontSize: 12,
    color: '#6B7280'
  },
  totalSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#1A1A1A',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 14,
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  totalValue: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 50,
    right: 50,
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 9,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 20
  }
});

interface InvoiceProps {
  bookingId: number;
  guestName: string;
  guestEmail: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  date: string;
}

export const InvoiceDocument = ({ data }: { data: InvoiceProps }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>HOTEL SOÑADOR</Text>
          <Text style={styles.subtitle}>Un refugio de paz y elegancia</Text>
        </View>
        <View>
          <Text style={styles.invoiceText}>FACTURA</Text>
          <Text style={styles.invoiceSub}>#INV-{data.bookingId}</Text>
          <Text style={styles.invoiceSub}>{data.date}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Facturar a:</Text>
        <Text style={styles.billToName}>{data.guestName}</Text>
        <Text style={styles.billToEmail}>{data.guestEmail}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Detalles de la Reserva:</Text>
        
        <View style={styles.row}>
          <Text style={styles.label}>Habitación</Text>
          <Text style={styles.value}>{data.roomName}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Fecha Check-In</Text>
          <Text style={styles.value}>{data.checkIn}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Fecha Check-Out</Text>
          <Text style={styles.value}>{data.checkOut}</Text>
        </View>
      </View>

      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
        <Text style={styles.totalValue}>${data.totalPrice.toFixed(2)} USD</Text>
      </View>

      <Text style={styles.footer}>
        Gracias por su preferencia. Si tiene alguna duda con su factura, contacte a admin@hotelsonador.com.
      </Text>
      
    </Page>
  </Document>
);
