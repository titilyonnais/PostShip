export default function MarketingHomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">PostShip</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Surveillance post-déploiement pour sites et SaaS indie. Après chaque
        deploy, PostShip vérifie vos URLs critiques comme un utilisateur.
      </p>
    </main>
  );
}
