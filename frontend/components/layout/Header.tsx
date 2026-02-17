'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Menu, X } from 'lucide-react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" onClick={closeMobileMenu}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg"></div>
            <span className="font-bold text-xl">ISM Protocol</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Markets
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Dashboard
            </Link>
            <a
              href="https://docs.ismprotocol.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Docs
            </a>
          </nav>

          {/* Right Side: Connect Button + Mobile Menu Toggle */}
          <div className="flex items-center gap-4">
            {/* Connect Button */}
            <div>
              <ConnectButton />
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 border-t pt-4 space-y-3">
            <Link
              href="/"
              onClick={closeMobileMenu}
              className="block text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
            >
              Markets
            </Link>
            <Link
              href="/dashboard"
              onClick={closeMobileMenu}
              className="block text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
            >
              Dashboard
            </Link>
            <a
              href="https://docs.ismprotocol.xyz"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMobileMenu}
              className="block text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
            >
              Docs
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
