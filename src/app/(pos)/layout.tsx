export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // POS layout is fullscreen, without sidebar
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {children}
    </div>
  );
}
