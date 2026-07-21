import ContentAdminClient from './ContentAdminClient';

export const metadata = {
  title: 'Content Manager - Admin',
};

export default function ContentAdminPage() {
  return (
    <div className="flex-1 pt-0 sm:pt-2 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Content Manager (Images)</h2>
      </div>
      <ContentAdminClient />
    </div>
  );
}
