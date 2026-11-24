// SYNTHETIC, disposable stand-in for the historical rlogic AppLayout.
// stand-in only — no private production code copied.
import React from 'react'

export function AppLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar pt-4" role="banner">
        <span className="warehouse-badge" aria-label="Warehouse 01">▦ WH-01</span>
        <span className="brand">WMS Mobile</span>
      </header>
      <main>{children}</main>
    </div>
  )
}
