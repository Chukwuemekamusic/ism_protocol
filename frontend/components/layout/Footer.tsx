export default function Footer() {
  return (
    <footer className="border-t bg-gray-50 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="font-semibold mb-3">ISM Protocol</h3>
            <p className="text-sm text-gray-600">
              Isolated lending markets on Base. Supply assets to earn interest or borrow against
              collateral.
            </p>
          </div>

          {/* Protocol */}
          <div>
            <h3 className="font-semibold mb-3">Protocol</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <a href="/" className="hover:text-gray-900 transition-colors">
                  Markets
                </a>
              </li>
              <li>
                <a href="/dashboard" className="hover:text-gray-900 transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-900 transition-colors">
                  Analytics
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-3">Resources</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <a href="#" className="hover:text-gray-900 transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-900 transition-colors">
                  GitHub
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-900 transition-colors">
                  Audits
                </a>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="font-semibold mb-3">Community</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <a href="#" className="hover:text-gray-900 transition-colors">
                  Twitter
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-900 transition-colors">
                  Discord
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-900 transition-colors">
                  Blog
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t text-center text-sm text-gray-600">
          <p>&copy; {new Date().getFullYear()} ISM Protocol. Built on Base.</p>
        </div>
      </div>
    </footer>
  );
}
