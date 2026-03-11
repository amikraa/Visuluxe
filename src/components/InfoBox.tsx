import React from 'react';
import { Info, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';

interface InfoBoxProps {
  type?: 'info' | 'warning' | 'success' | 'tip';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function InfoBox({ type = 'info', title, children, className = '' }: InfoBoxProps) {
  const getStyles = () => {
    switch (type) {
      case 'info':
        return {
          bg: 'bg-blue-900/20',
          border: 'border-blue-500/30',
          text: 'text-blue-300',
          icon: <Info className="w-5 h-5 text-blue-400" />
        };
      case 'warning':
        return {
          bg: 'bg-yellow-900/20',
          border: 'border-yellow-500/30',
          text: 'text-yellow-300',
          icon: <AlertCircle className="w-5 h-5 text-yellow-400" />
        };
      case 'success':
        return {
          bg: 'bg-green-900/20',
          border: 'border-green-500/30',
          text: 'text-green-300',
          icon: <CheckCircle className="w-5 h-5 text-green-400" />
        };
      case 'tip':
        return {
          bg: 'bg-purple-900/20',
          border: 'border-purple-500/30',
          text: 'text-purple-300',
          icon: <Lightbulb className="w-5 h-5 text-purple-400" />
        };
      default:
        return {
          bg: 'bg-blue-900/20',
          border: 'border-blue-500/30',
          text: 'text-blue-300',
          icon: <Info className="w-5 h-5 text-blue-400" />
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {styles.icon}
        </div>
        <div className="flex-1">
          {title && (
            <h4 className={`font-semibold mb-1 ${styles.text}`}>
              {title}
            </h4>
          )}
          <div className={`text-sm ${styles.text} leading-relaxed`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}