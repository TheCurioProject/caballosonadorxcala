import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    borderBottom: '1pt solid #eeeeee',
    paddingBottom: 20,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D2D2D',
  },
  title: {
    fontSize: 20,
    color: '#666666',
  },
  section: {
    marginBottom: 30,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    color: '#666666',
  },
  value: {
    fontSize: 12,
    color: '#000000',
  },
  totalSection: {
    marginTop: 40,
    borderTop: '1pt solid #eeeeee',
    paddingTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 20,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
  }
});

interface InvoiceProps {
  bookingId: number;
  guestName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  date: string;
}

export const InvoicePDF = ({ bookingId, guestName, roomName, checkIn, checkOut, totalPrice, date }: InvoiceProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.logo}>HOTEL SOÑADOR</Text>
        <Text style={styles.title}>INVOICE #{bookingId}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Date:</Text>
          <Text style={styles.value}>{date}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Guest Name:</Text>
          <Text style={styles.value}>{guestName}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 15 }}>Booking Details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Room:</Text>
          <Text style={styles.value}>{roomName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Check-in:</Text>
          <Text style={styles.value}>{checkIn}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Check-out:</Text>
          <Text style={styles.value}>{checkOut}</Text>
        </View>
      </View>

      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Total Amount:</Text>
        <Text style={styles.totalValue}>${totalPrice.toFixed(2)} USD</Text>
      </View>
      
      <View style={{ marginTop: 60, alignItems: 'center' }}>
        <Text style={{ fontSize: 10, color: '#999999', fontStyle: 'italic' }}>
          Thank you for choosing Hotel Soñador. We look forward to hosting you!
        </Text>
      </View>
    </Page>
  </Document>
);
