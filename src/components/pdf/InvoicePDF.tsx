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

interface InvoiceProps {
  bookingId: number;
  guestName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  depositPaid?: number;
  depositCurrency?: string;
  date: string;
  logoBase64: string;
  addons?: any[];
}

export const InvoicePDF = ({ bookingId, guestName, roomName, checkIn, checkOut, totalPrice, depositPaid = 0, depositCurrency = 'MXN', date, logoBase64, addons = [] }: InvoiceProps) => (
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

      {/* ADDONS */}
      {addons && addons.filter(a => a.type.startsWith('FOOD')).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Servicios de Comida / Food Services</Text>
          {addons.filter(a => a.type.startsWith('FOOD')).map((addon, i) => {
            let detailsObj: any = {};
            try { if (addon.details) detailsObj = JSON.parse(addon.details); } catch(e) {}
            
            let name = detailsObj.service || detailsObj.plan || detailsObj.name || (addon.type.includes('DISH') ? 'Platillo / Dish' : 'Servicio / Service');
            if (detailsObj.groupSize) {
              name += ` (${detailsObj.groupSize} pax)`;
            }
            if (detailsObj.date) {
              name += ` - ${detailsObj.date}`;
            }

            return (
              <View key={i} style={styles.row}>
                <Text style={styles.label}>{addon.quantity}x {name}</Text>
                <Text style={styles.value}>${addon.price.toLocaleString('es-MX')} {depositCurrency}</Text>
              </View>
            );
          })}
        </View>
      )}

      {addons && addons.filter(a => a.type.startsWith('TOUR')).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tours</Text>
          {addons.filter(a => a.type.startsWith('TOUR')).map((addon, i) => {
            let detailsObj: any = {};
            try { if (addon.details) detailsObj = JSON.parse(addon.details); } catch(e) {}
            const name = detailsObj.destination || detailsObj.name || 'Tour';
            const pax = detailsObj.people || addon.quantity;
            return (
              <View key={i} style={styles.row}>
                <Text style={styles.label}>{pax} pax - {name}</Text>
                <Text style={styles.value}>${addon.price.toLocaleString('es-MX')} {depositCurrency}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* TOTAL */}
      <View style={{ ...styles.section, marginTop: 20 }}>
        <Text style={styles.sectionTitle}>Resumen de Pago / Payment Summary</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total de la reserva / Total amount:</Text>
          <Text style={styles.value}>${totalPrice.toLocaleString('es-MX')} MXN</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Anticipo pagado / Deposit paid:</Text>
          <Text style={styles.value}>${depositPaid.toLocaleString('es-MX')} {depositCurrency}</Text>
        </View>
      </View>

      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Balance Pendiente / Balance Due</Text>
        <Text style={styles.totalValue}>
          {depositCurrency === 'MXN' 
            ? `$${(totalPrice - depositPaid).toLocaleString('es-MX')} MXN`
            : `$${totalPrice.toLocaleString('es-MX')} MXN - $${depositPaid.toLocaleString('es-MX')} ${depositCurrency}`
          }
        </Text>
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
        <Text style={styles.footerText}>Casa Caballo Soñador — Chacala, Nayarit, México</Text>
        <Text style={styles.footerText}>Si tiene alguna duda con su reserva, contáctenos en reservas@casacaballosonador.com</Text>
      </View>
    </Page>
  </Document>
);
