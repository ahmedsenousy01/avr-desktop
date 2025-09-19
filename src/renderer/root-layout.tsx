import { Link, Outlet } from "@tanstack/react-router";

export function RootLayout() {
  return (
    <div className="flex h-screen">
      <nav className="w-[220px] border-r border-gray-200 p-3">
        <div className="mb-3 font-semibold">AVR GUI</div>
        <ul className="m-0 list-none p-0">
          <li>
            <Link
              to="/providers"
              className="block px-2.5 py-2 font-semibold"
              activeProps={{ className: "text-blue-600" }}
            >
              Providers & Keys
            </Link>
          </li>
          <li>
            <Link
              to="/asterisk"
              className="block px-2.5 py-2 font-semibold"
              activeProps={{ className: "text-blue-600" }}
            >
              Asterisk
            </Link>
          </li>
          <li>
            <Link
              to="/environment"
              className="block px-2.5 py-2 font-semibold"
              activeProps={{ className: "text-blue-600" }}
            >
              Environment
            </Link>
          </li>
          <li>
            <Link
              to="/templates"
              className="block px-2.5 py-2 font-semibold"
              activeProps={{ className: "text-blue-600" }}
            >
              Templates
            </Link>
          </li>
          <li>
            <Link
              to="/deployments"
              className="block px-2.5 py-2 font-semibold"
              activeProps={{ className: "text-blue-600" }}
            >
              Deployments
            </Link>
          </li>
          <li>
            <Link
              to="/composer"
              className="block px-2.5 py-2 font-semibold"
              activeProps={{ className: "text-blue-600" }}
            >
              Composer
            </Link>
          </li>
        </ul>
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
