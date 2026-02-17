'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface AddressDisplayProps {
  address: string;
  className?: string;
  showFullOnDesktop?: boolean;
}

export function AddressDisplay({
  address,
  className = '',
  showFullOnDesktop = false
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Mobile: Always show truncated */}
      {/* Desktop: Show full or truncated based on prop */}
      <code className="font-mono text-sm break-all">
        <span className={showFullOnDesktop ? 'hidden sm:inline' : 'hidden'}>
          {address}
        </span>
        <span className={showFullOnDesktop ? 'sm:hidden' : ''}>
          {truncateAddress(address)}
        </span>
      </code>

      <button
        onClick={handleCopy}
        className="p-1.5 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0"
        title="Copy address"
        type="button"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Copy className="w-4 h-4 text-gray-500" />
        )}
      </button>
    </div>
  );
}
