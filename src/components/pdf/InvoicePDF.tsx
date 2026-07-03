import React from 'react';
import { Page, Text, View, Document, StyleSheet, Svg, Path } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    backgroundColor: '#F9F7F4',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 40,
    borderBottom: '2pt solid #9B7E67',
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  logoText: {
    fontSize: 24,
    color: '#23211F',
    marginTop: 10,
    letterSpacing: 1,
  },
  titleContainer: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 28,
    color: '#23211F',
    letterSpacing: 2,
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 30,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#9B7E67',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderBottom: '1pt solid #EEEEEE',
    paddingBottom: 5,
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
  },
  totalSection: {
    marginTop: 20,
    backgroundColor: '#23211F',
    padding: 20,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  totalValue: {
    fontSize: 24,
    color: '#9B7E67',
  },
  rulesSection: {
    marginTop: 30,
  },
  ruleText: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 6,
    lineHeight: 1.4,
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
      
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Svg viewBox="0 0 617 768" style={{ width: 45, height: 56 }}>
            <Path fill="#9B7E67" d="M254.415 260.599C260.823 262.801 263.974 275.624 266.588 281.502C269.642 288.369 274.147 291.736 279.088 297.182C285.349 304.082 290.971 312.267 294.113 321.076C297.405 330.074 298.213 345.424 294.491 354.489C294.069 355.518 293.63 355.743 292.79 356.013C290.7 354.849 290.084 347.198 289.509 344.455C285.927 327.371 280.543 318.811 269.593 305.835C268.931 318.785 263.338 328.67 255.964 338.771C262.117 347.116 268.408 355.942 268.621 366.693C268.986 385.152 255.457 400.017 243.814 412.503C262.458 406.056 282.038 401.439 301.295 397.237C308.834 395.592 317.445 393.85 324.413 390.525C332.471 386.679 338.271 377.836 340.687 369.46C346.781 348.327 332.472 328.793 322.452 311.493C321.787 310.344 320.826 308.582 321.217 307.263C326.815 304.909 344.915 329.117 347.989 334.235C358.595 351.895 358.11 367.257 353.329 386.273C377.659 381.307 400.038 375.387 422.365 365.198C449.494 352.819 459.073 334.55 458.563 305.797C458.514 303.034 458.718 294.551 460.624 292.601L461.28 292.753C465.184 297.859 466.392 313.6 467.128 320.053C469.474 340.602 457.743 360.616 442.144 373.238C432.194 381.287 420.54 386.893 408.979 392.299C383.97 402.672 361.865 406.962 335.605 412.603C302.02 419.949 267.816 425.776 234.907 435.844C209.359 443.661 180.425 454.641 164.472 477.392C162.759 479.83 161.211 482.381 159.839 485.027C158.234 488.126 155.681 495.859 153.167 497.554C152.023 497.51 152.498 497.718 151.688 496.931C151.184 495.556 151.159 494.41 151.315 492.945C153.954 468.175 172.275 447.069 193.079 434.802C199.967 430.74 208.802 428.306 214.892 422.98C220.103 418.422 224.826 412.726 229.456 407.558C239.062 396.836 253.791 385.695 254.868 370.335C255.584 360.122 251.522 354.389 245.302 347.14C221.936 358.702 209.608 357.932 184.688 351.053C179.293 349.563 171.444 348.431 165.808 349.375C151.093 351.791 141.974 365.12 127.528 368.214C124.146 368.938 106.48 369.358 105.589 365.667C107.7 362.113 123.872 360.994 128.627 358.089C137.563 352.63 147.751 340.353 157.919 337.988C179.031 333.077 200.276 343.326 221.814 341.422C252.914 338.674 262.791 307.198 258.737 280.545C257.768 274.205 255.082 267.49 254.46 261.098L254.415 260.599Z" />
          </Svg>
          <Text style={styles.logoText}>CASA DEL CABALLO SOÑADOR</Text>
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>COMPROBANTE</Text>
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
