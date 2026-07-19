import ContentAdminClient from './ContentAdminClient';

export const metadata = {
  title: 'Gestor de Contenido - Administración',
};

export default function ContentAdminPage() {
  return (
    <div className="flex-1 p-8 pt-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Gestor de Contenido (Imágenes)</h2>
      </div>
      <ContentAdminClient />
    </div>
  );
}
