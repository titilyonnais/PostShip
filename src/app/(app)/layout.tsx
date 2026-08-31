export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-3">
        <span className="font-mono text-sm text-foreground">PostShip</span>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}
