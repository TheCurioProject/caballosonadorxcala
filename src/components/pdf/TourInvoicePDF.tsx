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
    marginBottom: 30,
    backgroundColor: '#2C2927',
    padding: 24,
    borderRadius: 6,
    borderBottom: '3pt solid #9B7E67',
  },
  logoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  logoText: {
    fontSize: 16,
    color: '#F9F7F4',
    marginTop: 8,
    letterSpacing: 2,
    fontFamily: 'Helvetica-Bold',
  },
  titleContainer: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 28,
    color: '#9B7E67',
    letterSpacing: 4,
    fontFamily: 'Helvetica-Bold',
  },
  invoiceNumber: {
    fontSize: 11,
    color: '#D4C3AB',
    marginTop: 4,
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
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 12,
    color: '#D4C3AB',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
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

interface TourInvoiceProps {
  bookingId: number;
  guestName: string;
  tourDestination: string;
  date: string;
  pax: number;
  totalPrice: number;
  currency?: string;
  issueDate: string;
  logoBase64: string;
}

export const TourInvoicePDF = ({ 
  bookingId, 
  guestName, 
  tourDestination, 
  date, 
  pax, 
  totalPrice, 
  currency = 'MXN', 
  issueDate, 
  logoBase64 
}: TourInvoiceProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          {logoBase64 ? (
            <Image 
              src={`data:image/png;base64,${logoBase64}`} 
              style={{ width: 220, height: 'auto' }} 
            />
          ) : (
            <Text style={styles.logoText}>CASA CABALLO SOÑADOR</Text>
          )}
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>TOUR FACTURA</Text>
          <Text style={styles.invoiceNumber}>#TOUR-{bookingId}</Text>
          <Text style={styles.invoiceNumber}>{issueDate}</Text>
        </View>
      </View>

      {/* CLIENT DETAILS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalles del Cliente / Client Details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nombre / Name:</Text>
          <Text style={styles.value}>{guestName}</Text>
        </View>
      </View>

      {/* TOUR DETAILS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalles del Tour / Tour Details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Destino / Destination:</Text>
          <Text style={styles.value}>{tourDestination}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha / Date:</Text>
          <Text style={styles.value}>{date}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Número de Personas / Guests:</Text>
          <Text style={styles.value}>{pax}</Text>
        </View>
      </View>

      {/* TOTAL */}
      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Total Pagado / Total Paid</Text>
        <Text style={styles.totalValue}>
          ${totalPrice.toLocaleString('es-MX')} {currency}
        </Text>
      </View>

      {/* NOTES */}
      <View style={styles.rulesSection}>
        <Text style={styles.sectionTitle}>Notas Importantes / Important Notes</Text>
        <Text style={styles.ruleText}>• Por favor, preséntese 15 minutos antes de la hora programada para su tour.</Text>
        <Text style={styles.ruleText}>• Este comprobante confirma su pago total por el servicio de tour. No es necesario realizar pagos adicionales a menos que solicite servicios extra el día del tour.</Text>
        <Text style={styles.ruleText}>• Las cancelaciones están sujetas a la política de cancelación de Casa Caballo Soñador.</Text>
      </View>
      
      {/* FOOTER */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Casa Caballo Soñador — Chacala, Nayarit, México</Text>
        <Text style={styles.footerText}>Si tiene alguna duda con su tour, contáctenos en reservas@casacaballosonador.com</Text>
      </View>
    </Page>
  </Document>
);
