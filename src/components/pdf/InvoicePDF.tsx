import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
    borderBottom: '2pt solid #23211F',
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  logoText: {
    fontSize: 20,
    color: '#23211F',
    marginTop: 10,
    letterSpacing: 2,
    fontFamily: 'Helvetica-Bold',
  },
  titleContainer: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 32,
    color: '#23211F',
    letterSpacing: 4,
    fontFamily: 'Helvetica-Bold',
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666666',
    marginTop: 6,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 30,
    backgroundColor: '#F9F7F4',
    padding: 20,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#23211F',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 2,
    borderBottom: '1pt solid #D4C3AB',
    paddingBottom: 5,
    fontFamily: 'Helvetica-Bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontSize: 12,
    color: '#23211F',
    fontFamily: 'Helvetica-Bold',
  },
  totalSection: {
    marginTop: 20,
    backgroundColor: '#23211F',
    padding: 20,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontFamily: 'Helvetica-Bold',
  },
  totalValue: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
  },
  rulesSection: {
    marginTop: 30,
  },
  ruleText: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 6,
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 50,
    right: 50,
    textAlign: 'center',
    borderTop: '1pt solid #EEEEEE',
    paddingTop: 15,
  },
  footerText: {
    fontSize: 9,
    color: '#999999',
    marginBottom: 4,
    letterSpacing: 1,
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
  logoBase64: string;
}

export const InvoicePDF = ({ bookingId, guestName, roomName, checkIn, checkOut, totalPrice, date, logoBase64 }: InvoiceProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          {logoBase64 && (
            <Image 
              src={`data:image/png;base64,${logoBase64}`} 
              style={{ width: 60, height: 'auto', marginBottom: 5 }} 
            />
          )}
          <Text style={styles.logoText}>CASA DEL CABALLO SOÑADOR</Text>
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>INVOICE</Text>
          <Text style={styles.invoiceNumber}>#RES-{bookingId}</Text>
          <Text style={styles.invoiceNumber}>{date}</Text>
        </View>
      </View>

      {/* CLIENT DETAILS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalles del Cliente</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nombre:</Text>
          <Text style={styles.value}>{guestName}</Text>
        </View>
      </View>

      {/* BOOKING DETAILS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalles de la Reserva</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Propiedad:</Text>
          <Text style={styles.value}>{roomName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Check-in:</Text>
          <Text style={styles.value}>{checkIn} a partir de las 15:00 hrs</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Check-out:</Text>
          <Text style={styles.value}>{checkOut} hasta las 11:00 hrs</Text>
        </View>
      </View>

      {/* TOTAL */}
      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Total Pagado</Text>
        <Text style={styles.totalValue}>${totalPrice.toLocaleString('es-MX')} MXN</Text>
      </View>

      {/* RULES */}
      <View style={styles.rulesSection}>
        <Text style={styles.sectionTitle}>Reglas de la Casa</Text>
        <Text style={styles.ruleText}>• Horario de silencio: 10:00 PM - 8:00 AM.</Text>
        <Text style={styles.ruleText}>• Prohibido fumar dentro de las instalaciones y habitaciones.</Text>
        <Text style={styles.ruleText}>• No se permiten fiestas o eventos no autorizados previamente.</Text>
        <Text style={styles.ruleText}>• Las mascotas deben ser declaradas al momento de la reserva.</Text>
        <Text style={styles.ruleText}>• Por favor, cuide el consumo de energía y agua en apoyo al medio ambiente local.</Text>
      </View>
      
      {/* FOOTER */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Casa del Caballo Soñador — Chacala, Nayarit, México</Text>
        <Text style={styles.footerText}>Si tiene alguna duda con su reserva, contáctenos en reservas@casacaballosonador.com</Text>
      </View>
    </Page>
  </Document>
);
