import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center px-4">
        <div className="text-7xl font-bold text-[#854DF9]">404</div>
        <h1 className="text-2xl font-semibold text-[#F0F0F5]">Page not found</h1>
        <p className="text-[#A0A0B5] max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#854DF9] hover:bg-[#9D6FFA] text-white font-medium transition-colors"
        >
          Go to Chat
        </Link>
      </div>
    </div>
  );
}
