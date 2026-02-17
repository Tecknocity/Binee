import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ErrorPage: React.FC = () => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-24 h-24 rounded-full bg-warning/15 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={40} className="text-warning" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-8">We're working on it. Please try again.</p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-6 py-2.5 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity">
            <RefreshCw size={16} />
            Try Again
          </button>
          <Link to="/" className="px-4 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted/50 transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
