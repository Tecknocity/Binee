import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowLeft } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6">
          <Search size={40} className="text-white" />
        </div>
        <h1 className="text-7xl font-bold gradient-text mb-4">404</h1>
        <h2 className="text-xl font-semibold text-foreground mb-2">Page not found</h2>
        <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/" className="px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity">
            Go to Dashboard
          </Link>
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted/50 transition-colors">
            <ArrowLeft size={16} />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
